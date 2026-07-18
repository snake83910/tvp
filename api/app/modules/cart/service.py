"""
Logique panier + checkout.

Choix actés :
- Panier anonyme (session_token) fusionné dans le panier user à la connexion.
- Prix FIGÉ à l'ajout. Au checkout, revalidation contre Maxityre :
  si écart, on signale explicitement (price_changes) au lieu de facturer
  un prix différent de celui vu = anti-litige.
- Lignes du panier FUSIONNÉES par référence : si on ajoute deux fois le
  même pneu, c'est UNE ligne avec quantité cumulée (correctif e-commerce
  standard ; sinon le client se retrouve avec des doublons illisibles).
- Toute fonction qui renvoie un Cart doit le faire AVEC items pré-chargés
  (eager load via selectinload) : la sérialisation route appelle ensuite
  _serialize(cart) qui itère cart.items, et en SQLAlchemy async un lazy
  load après commit lève MissingGreenlet.
"""
import asyncio
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import delete, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.cache import get_redis
from app.models.order import Cart, CartItem, Order, OrderItem, OrderStatus
from app.models.user import Address, ProProfile, User
from app.modules.catalog.service import connector as _connector
from app.modules.catalog.service import load_detail, load_dimension_catalog
from app.modules.pricing.engine import compute_price
from app.modules.shipping.rules import compute_home_shipping


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


async def _resolve_stock(match: dict) -> int | None:
    """Stock d'une référence : celui de la liste si présent, sinon
    celui de la fiche détaillée (la recherche liste Maxityre ne renvoie
    pas toujours les offres — sans ce fallback, stock inconnu = aucun
    contrôle et « 1 restant » laissait commander 2 pneus)."""
    stock = match.get("stock")
    if stock is not None:
        return stock
    ref = match.get("supplier_ref")
    if not ref:
        return None
    try:
        detail = await load_detail(str(ref))
    except Exception:
        return None  # fiche indisponible : on ne bloque pas la vente
    return detail.get("stock") if detail else None


async def _load_cart_with_items(
    db: AsyncSession, cart_id: uuid.UUID
) -> Cart | None:
    """Recharge un panier AVEC ses items en eager load.

    À utiliser après chaque commit qui modifie le panier, avant de le
    renvoyer à la route : sans ça, _serialize() itère cart.items en
    lazy load et plante avec MissingGreenlet en async.

    populate_existing : OBLIGATOIRE. La session est en
    expire_on_commit=False ; sans cette option, le SELECT renvoie
    l'objet déjà présent dans l'identity map avec sa collection items
    PÉRIMÉE (l'item ajouté via db.add(CartItem(...)) n'est pas dans la
    relation). Symptôme réel : le 2e article ajouté n'apparaissait pas
    dans la réponse — panier et total figés sur le 1er article.
    """
    return await db.scalar(
        select(Cart)
        .where(Cart.id == cart_id)
        .options(selectinload(Cart.items))
        .execution_options(populate_existing=True)
    )


async def _get_or_create_cart(
    db: AsyncSession,
    user: User | None,
    session_token: str | None,
) -> Cart:
    if user is not None:
        cart = await db.scalar(
            select(Cart)
            .where(Cart.user_id == user.id)
            .options(selectinload(Cart.items))
        )
        if cart is None:
            cart = Cart(user_id=user.id)
            db.add(cart)
            await db.flush()
        return cart

    if session_token:
        cart = await db.scalar(
            select(Cart)
            .where(Cart.session_token == session_token)
            .options(selectinload(Cart.items))
        )
        if cart:
            return cart

    cart = Cart(session_token=session_token or new_session_token())
    db.add(cart)
    await db.flush()
    return cart


async def merge_anonymous_cart(
    db: AsyncSession, user: User, session_token: str
) -> None:
    """À la connexion : déverse le panier anonyme dans celui du user.

    UPDATE direct (pas via la relation ORM) pour contourner la cascade
    delete-orphan qui supprimait les items.
    Et si une référence existe déjà dans le panier user, on fusionne
    les quantités au lieu de garder des doublons.
    """
    anon = await db.scalar(
        select(Cart).where(Cart.session_token == session_token)
    )
    if anon is None:
        return

    user_cart = await _get_or_create_cart(db, user, None)
    if anon.id == user_cart.id:
        return

    anon_items = (
        await db.scalars(
            select(CartItem).where(CartItem.cart_id == anon.id)
        )
    ).all()

    user_items = {
        it.supplier_ref: it
        for it in (
            await db.scalars(
                select(CartItem).where(CartItem.cart_id == user_cart.id)
            )
        ).all()
    }

    for ai in anon_items:
        existing = user_items.get(ai.supplier_ref)
        if existing is not None:
            existing.quantity += ai.quantity
            await db.execute(
                delete(CartItem).where(CartItem.id == ai.id)
            )
        else:
            await db.execute(
                update(CartItem)
                .where(CartItem.id == ai.id)
                .values(cart_id=user_cart.id)
            )

    await db.execute(delete(Cart).where(Cart.id == anon.id))
    await db.commit()


async def add_item(
    db: AsyncSession,
    user: User | None,
    session_token: str | None,
    supplier_ref: str,
    width: int,
    ratio: int,
    diameter: int,
    quantity: int,
) -> Cart:
    """Ajoute un pneu au panier.

    Si la référence existe DÉJÀ dans le panier, on cumule les quantités
    sur la ligne existante. Le prix figé reste celui de l'ajout initial.
    """
    cart = await _get_or_create_cart(db, user, session_token)

    existing = await db.scalar(
        select(CartItem).where(
            CartItem.cart_id == cart.id,
            CartItem.supplier_ref == supplier_ref,
        )
    )

    # Même cache Redis que la recherche : le client vient de voir ce pneu
    # dans les résultats, inutile de re-paginer Maxityre pour le retrouver.
    raw_items = await load_dimension_catalog(width, ratio, diameter)
    match = next(
        (t for t in raw_items if t.get("supplier_ref") == supplier_ref),
        None,
    )
    if match is None:
        raise ValueError("Référence introuvable chez le fournisseur")

    # STOCK : refuser de mettre au panier plus que le disponible
    # fournisseur (cumul ligne existante + ajout). Sans ce contrôle,
    # « 1 restant » n'empêchait pas de commander 2 pneus.
    stock = await _resolve_stock(match)
    already = existing.quantity if existing is not None else 0
    if stock is not None and already + quantity > stock:
        raise ValueError(
            f"Stock insuffisant : il ne reste que {stock} pneu"
            f"{'s' if stock > 1 else ''} pour cette référence"
            + (f" (vous en avez déjà {already} dans le panier)" if already else "")
        )

    if existing is not None:
        existing.quantity += quantity
        await db.commit()
        reloaded = await _load_cart_with_items(db, cart.id)
        return reloaded if reloaded is not None else cart

    account_type = user.account_type.value if user else "particulier"
    price_tier = None
    if user and account_type == "pro":
        prof = await db.scalar(
            select(ProProfile).where(ProProfile.user_id == user.id)
        )
        price_tier = prof.price_tier if prof else None

    priced = await compute_price(
        db,
        purchase_ht=match["price_ht"],
        account_type=account_type,
        price_tier=price_tier,
        brand=match.get("brand", ""),
    )

    db.add(
        CartItem(
            cart_id=cart.id,
            supplier_ref=supplier_ref,
            label_snapshot=(
                f"{match.get('brand', '')} {match.get('model', '')} "
                f"{match.get('raw_dimension', '')}"
            ).strip(),
            quantity=quantity,
            price_ht_snapshot=priced.sale_ht,
            price_ttc_snapshot=priced.sale_ttc,
            product_data={
                "width": width,
                "ratio": ratio,
                "diameter": diameter,
                "brand": match.get("brand", ""),
                # Affichage panier : vignette + saison sans re-fetch
                "image_url": match.get("image_url"),
                "season": match.get("season"),
            },
        )
    )
    await db.commit()
    reloaded = await _load_cart_with_items(db, cart.id)
    return reloaded if reloaded is not None else cart


async def update_item_quantity(
    db: AsyncSession,
    user: User | None,
    session_token: str | None,
    item_id: uuid.UUID,
    new_quantity: int,
) -> Cart:
    """Met à jour la quantité d'une ligne. <= 0 -> suppression."""
    if new_quantity < 1:
        return await remove_item(db, user, session_token, item_id)

    item = await db.get(CartItem, item_id)
    if item is None:
        raise ValueError("Article introuvable dans le panier")

    cart = await db.get(Cart, item.cart_id)
    if cart is None:
        raise ValueError("Panier introuvable")

    if user is not None:
        if cart.user_id != user.id:
            raise ValueError("Article introuvable dans le panier")
    else:
        if not session_token or cart.session_token != session_token:
            raise ValueError("Article introuvable dans le panier")

    # STOCK : borne aussi les hausses de quantité depuis le panier
    pd = item.product_data or {}
    if pd.get("width") and new_quantity > item.quantity:
        raw_items = await load_dimension_catalog(
            pd["width"], pd["ratio"], pd["diameter"]
        )
        m = next(
            (t for t in raw_items if t.get("supplier_ref") == item.supplier_ref),
            None,
        )
        stock = await _resolve_stock(m) if m else None
        if stock is not None and new_quantity > stock:
            raise ValueError(
                f"Stock insuffisant : il ne reste que {stock} pneu"
                f"{'s' if stock > 1 else ''} pour cette référence"
            )

    item.quantity = new_quantity
    await db.commit()
    reloaded = await _load_cart_with_items(db, cart.id)
    return reloaded if reloaded is not None else cart


async def remove_item(
    db: AsyncSession,
    user: User | None,
    session_token: str | None,
    item_id: uuid.UUID,
) -> Cart:
    """Supprime une ligne du panier."""
    item = await db.get(CartItem, item_id)
    if item is None:
        raise ValueError("Article introuvable dans le panier")

    cart_id = item.cart_id
    cart = await db.get(Cart, cart_id)
    if cart is None:
        raise ValueError("Panier introuvable")

    if user is not None:
        if cart.user_id != user.id:
            raise ValueError("Article introuvable dans le panier")
    else:
        if not session_token or cart.session_token != session_token:
            raise ValueError("Article introuvable dans le panier")

    await db.execute(delete(CartItem).where(CartItem.id == item_id))
    await db.commit()
    reloaded = await _load_cart_with_items(db, cart_id)
    return reloaded if reloaded is not None else cart


@dataclass
class PriceChange:
    supplier_ref: str
    label: str
    old_ttc: float
    new_ttc: float


async def checkout(
    db: AsyncSession,
    user: User,
    address_id: uuid.UUID,
    delivery_mode: str = "home",
    promo_code: str | None = None,
) -> tuple[Order | None, list[PriceChange]]:
    """
    Transforme le panier en commande.
    - Revalide chaque prix ET le stock contre Maxityre (anti-litige).
    - Applique le code promo (revalidé ici, source de vérité).
    - Calcule les frais de port selon les quantités PAR LIGNE :
      gratuit seulement si toutes les références sont >= 2.
    - Fige l'adresse de livraison dans la commande.
    """
    address = await db.get(Address, address_id)
    if address is None or address.user_id != user.id:
        raise ValueError("Adresse de livraison introuvable")

    if delivery_mode != "home":
        raise ValueError(
            "Seule la livraison à domicile est disponible pour l'instant"
        )

    cart = await db.scalar(
        select(Cart)
        .where(Cart.user_id == user.id)
        .options(selectinload(Cart.items))
    )
    if cart is None or not cart.items:
        raise ValueError("Panier vide")

    account_type = user.account_type.value
    price_tier = None
    if account_type == "pro":
        prof = await db.scalar(
            select(ProProfile).where(ProProfile.user_id == user.id)
        )
        price_tier = prof.price_tier if prof else None

    changes: list[PriceChange] = []
    revalidated: list[tuple[CartItem, float, float]] = []

    # Revalidation FRAÎCHE (pas le cache Redis : anti-litige, on veut le
    # prix fournisseur du moment). Une seule recherche par dimension
    # distincte, lancées en parallèle — pas une par ligne en série.
    dims = list({
        (it.product_data["width"], it.product_data["ratio"],
         it.product_data["diameter"])
        for it in cart.items
    })
    results = await asyncio.gather(
        *[_connector.search_by_dimension(w, r, d) for w, r, d in dims]
    )
    tyres_by_dim = dict(zip(dims, results))

    for it in cart.items:
        pd = it.product_data
        tyres = tyres_by_dim[(pd["width"], pd["ratio"], pd["diameter"])]
        match = next(
            (t for t in tyres if t.supplier_ref == it.supplier_ref), None
        )
        if match is None:
            changes.append(
                PriceChange(
                    it.supplier_ref, it.label_snapshot,
                    it.price_ttc_snapshot, 0.0,
                )
            )
            continue

        # STOCK frais : dernier verrou avant création de la commande.
        # La recherche liste ne renvoie pas toujours le stock : on
        # interroge alors la fiche détaillée en direct.
        stock = match.stock
        if stock is None:
            try:
                full = await _connector.get_by_ref(it.supplier_ref)
                stock = full.stock if full else None
            except Exception:
                stock = None  # fiche indisponible : on ne bloque pas
        if stock is not None and it.quantity > stock:
            raise ValueError(
                f"Stock insuffisant pour « {it.label_snapshot} » : "
                f"{stock} restant{'s' if stock > 1 else ''}. "
                "Ajustez la quantité dans votre panier."
            )

        priced = await compute_price(
            db,
            purchase_ht=match.price_ht,
            account_type=account_type,
            price_tier=price_tier,
            brand=match.brand,
        )
        if round(priced.sale_ttc, 2) != round(it.price_ttc_snapshot, 2):
            changes.append(
                PriceChange(
                    it.supplier_ref,
                    it.label_snapshot,
                    it.price_ttc_snapshot,
                    priced.sale_ttc,
                )
            )
        revalidated.append((it, priced.sale_ht, priced.sale_ttc))

    if changes:
        # ALIGNER le panier sur les nouveaux prix avant de retourner les
        # écarts. Sans ça, les snapshots gardaient l'ancien prix : chaque
        # nouvelle tentative re-détectait les mêmes écarts et le checkout
        # bloquait en boucle infinie. L'anti-litige est préservé : la
        # commande n'est PAS créée à ce tour, le client voit le tableau
        # avant/après et doit re-valider explicitement aux nouveaux prix.
        changed_refs = {c.supplier_ref for c in changes}
        for it, ht, ttc in revalidated:
            if it.supplier_ref in changed_refs:
                it.price_ht_snapshot = ht
                it.price_ttc_snapshot = ttc
        # Références devenues introuvables chez le fournisseur
        # (new_ttc == 0) : on les retire du panier, sinon elles
        # bloqueraient définitivement le checkout.
        unavailable = {
            c.supplier_ref for c in changes if c.new_ttc == 0.0
        }
        if unavailable:
            await db.execute(
                delete(CartItem).where(
                    CartItem.cart_id == cart.id,
                    CartItem.supplier_ref.in_(unavailable),
                )
            )
        await db.commit()

        # Le cache catalogue est PROUVÉ périmé pour ces dimensions (la
        # revalidation vient de trouver un autre prix) : on l'invalide
        # pour que la recherche et les fiches produit affichent
        # immédiatement les nouveaux prix, sans attendre le TTL.
        all_changed = changed_refs | unavailable
        stale_keys = [
            f"maxityre:detail:{ref}" for ref in all_changed
        ]
        stale_keys += [
            f"maxityre:dim:{pd['width']}:{pd['ratio']}:{pd['diameter']}"
            for it in cart.items
            if it.supplier_ref in all_changed
            for pd in [it.product_data or {}]
            if pd.get("width")
        ]
        if stale_keys:
            try:
                await get_redis().delete(*set(stale_keys))
            except Exception:
                pass  # cache indisponible : non bloquant, le TTL fera foi

        return None, changes

    articles_ht = sum(
        round(ht * 100) * it.quantity for it, ht, _ in revalidated
    )
    articles_ttc = sum(
        round(ttc * 100) * it.quantity for it, _, ttc in revalidated
    )

    line_quantities = [it.quantity for it, _, _ in revalidated]
    ship = compute_home_shipping(line_quantities)

    # Code promo : revalidation faisant foi (l'aperçu /cart/promo/validate
    # n'engage rien). ValueError -> 400 avec message affichable.
    promo_code_final: str | None = None
    discount_ttc = 0
    discount_ht = 0
    if promo_code and promo_code.strip():
        from app.modules.promo.service import split_discount, validate_promo
        promo, discount_ttc = await validate_promo(
            db, promo_code, user.id, articles_ttc
        )
        promo_code_final = promo.code
        discount_ht, _ = split_discount(discount_ttc)

    total_ht = articles_ht - discount_ht + ship.ht_cents
    total_ttc = articles_ttc - discount_ttc + ship.ttc_cents

    n = (await db.execute(text("SELECT nextval('order_number_seq')"))).scalar()
    year = datetime.now(timezone.utc).year
    order = Order(
        order_number=f"CMD-{year}-{n:06d}",
        user_id=user.id,
        status=OrderStatus.pending_payment,
        account_type_snapshot=account_type,
        promo_code=promo_code_final,
        discount_ttc_cents=discount_ttc,
        delivery_mode=ship.mode,
        shipping_address={
            "label": address.label,
            "line1": address.line1,
            "line2": address.line2,
            "postal_code": address.postal_code,
            "city": address.city,
            "country": address.country,
        },
        shipping_ht_cents=ship.ht_cents,
        shipping_vat_cents=ship.vat_cents,
        total_ht_cents=total_ht,
        total_vat_cents=total_ttc - total_ht,
        total_ttc_cents=total_ttc,
    )
    db.add(order)
    await db.flush()

    for it, ht, _ in revalidated:
        db.add(
            OrderItem(
                order_id=order.id,
                supplier_ref=it.supplier_ref,
                label_snapshot=it.label_snapshot,
                quantity=it.quantity,
                unit_price_ht_cents=round(ht * 100),
            )
        )

    await db.delete(cart)
    await db.commit()
    await db.refresh(order)
    return order, []