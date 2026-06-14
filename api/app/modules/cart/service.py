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
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import delete, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.integrations.maxityre import MaxityreConnector
from app.models.order import Cart, CartItem, Order, OrderItem, OrderStatus
from app.models.user import Address, ProProfile, User
from app.modules.pricing.engine import compute_price
from app.modules.shipping.rules import compute_home_shipping

_connector = MaxityreConnector()


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


async def _load_cart_with_items(
    db: AsyncSession, cart_id: uuid.UUID
) -> Cart | None:
    """Recharge un panier AVEC ses items en eager load.

    À utiliser après chaque commit qui modifie le panier, avant de le
    renvoyer à la route : sans ça, _serialize() itère cart.items en
    lazy load et plante avec MissingGreenlet en async.
    """
    return await db.scalar(
        select(Cart)
        .where(Cart.id == cart_id)
        .options(selectinload(Cart.items))
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

    tyres = await _connector.search_by_dimension(width, ratio, diameter)
    match = next(
        (t for t in tyres if t.supplier_ref == supplier_ref), None
    )
    if match is None:
        raise ValueError("Référence introuvable chez le fournisseur")

    priced = await compute_price(
        db,
        purchase_ht=match.price_ht,
        account_type=account_type,
        price_tier=price_tier,
        brand=match.brand,
    )

    db.add(
        CartItem(
            cart_id=cart.id,
            supplier_ref=supplier_ref,
            label_snapshot=f"{match.brand} {match.model} {match.raw_dimension}",
            quantity=quantity,
            price_ht_snapshot=priced.sale_ht,
            price_ttc_snapshot=priced.sale_ttc,
            product_data={
                "width": width,
                "ratio": ratio,
                "diameter": diameter,
                "brand": match.brand,
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
) -> tuple[Order | None, list[PriceChange]]:
    """
    Transforme le panier en commande.
    - Revalide chaque prix contre Maxityre (anti-litige).
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

    for it in cart.items:
        pd = it.product_data
        tyres = await _connector.search_by_dimension(
            pd["width"], pd["ratio"], pd["diameter"]
        )
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
        return None, changes

    articles_ht = sum(
        round(ht * 100) * it.quantity for it, ht, _ in revalidated
    )
    articles_ttc = sum(
        round(ttc * 100) * it.quantity for it, _, ttc in revalidated
    )

    line_quantities = [it.quantity for it, _, _ in revalidated]
    ship = compute_home_shipping(line_quantities)

    total_ht = articles_ht + ship.ht_cents
    total_ttc = articles_ttc + ship.ttc_cents

    n = (await db.execute(text("SELECT nextval('order_number_seq')"))).scalar()
    year = datetime.now(timezone.utc).year
    order = Order(
        order_number=f"CMD-{year}-{n:06d}",
        user_id=user.id,
        status=OrderStatus.pending_payment,
        account_type_snapshot=account_type,
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