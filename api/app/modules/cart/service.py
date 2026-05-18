"""
Logique panier + checkout.

Choix actés :
- Panier anonyme (session_token) fusionné dans le panier user à la connexion.
- Prix FIGÉ à l'ajout. Au checkout, revalidation contre Maxityre :
  si écart, on signale explicitement (price_changes) au lieu de facturer
  un prix différent de celui vu = anti-litige.
"""
import secrets
import uuid
from dataclasses import dataclass

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.integrations.maxityre import MaxityreConnector
from app.models.order import Cart, CartItem, Order, OrderItem, OrderStatus
from app.models.user import ProProfile, User
from app.modules.pricing.engine import compute_price

_connector = MaxityreConnector()


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


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

    On fait un UPDATE SQL direct du cart_id des items, sans passer par
    la relation ORM Cart.items : cette relation a une cascade
    delete-orphan qui supprimait les items dès qu'on les détachait du
    panier anonyme (bug constaté : panier vidé à la connexion). Le
    UPDATE direct contourne entièrement la cascade.
    """
    anon = await db.scalar(
        select(Cart).where(Cart.session_token == session_token)
    )
    if anon is None:
        return

    user_cart = await _get_or_create_cart(db, user, None)
    if anon.id == user_cart.id:
        return

    # Transfert des lignes par UPDATE direct (pas via la relation ORM)
    await db.execute(
        update(CartItem)
        .where(CartItem.cart_id == anon.id)
        .values(cart_id=user_cart.id)
    )
    # Le panier anonyme est maintenant sans items : suppression directe
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
    cart = await _get_or_create_cart(db, user, session_token)

    # Prix figé à l'ajout : on récupère le produit live + on calcule
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
    # Rechargement explicite avec les items : le lazy-load relationnel
    # est interdit en async (MissingGreenlet).
    cart = await db.scalar(
        select(Cart)
        .where(Cart.id == cart.id)
        .options(selectinload(Cart.items))
    )
    return cart


async def _load_cart(
    db: AsyncSession, user: User | None, session_token: str | None
) -> Cart | None:
    if user is not None:
        return await db.scalar(
            select(Cart)
            .where(Cart.user_id == user.id)
            .options(selectinload(Cart.items))
        )
    if session_token:
        return await db.scalar(
            select(Cart)
            .where(Cart.session_token == session_token)
            .options(selectinload(Cart.items))
        )
    return None


async def update_item_quantity(
    db: AsyncSession,
    user: User | None,
    session_token: str | None,
    item_id,
    quantity: int,
) -> Cart:
    cart = await _load_cart(db, user, session_token)
    if cart is None:
        raise ValueError("Panier introuvable")
    item = next((i for i in cart.items if str(i.id) == str(item_id)), None)
    if item is None:
        raise ValueError("Article introuvable dans le panier")
    if quantity < 1:
        raise ValueError("Quantité invalide")
    item.quantity = quantity
    await db.commit()
    return await _load_cart(db, user, session_token)


async def remove_item(
    db: AsyncSession,
    user: User | None,
    session_token: str | None,
    item_id,
) -> Cart:
    cart = await _load_cart(db, user, session_token)
    if cart is None:
        raise ValueError("Panier introuvable")
    item = next((i for i in cart.items if str(i.id) == str(item_id)), None)
    if item is None:
        raise ValueError("Article introuvable dans le panier")
    await db.delete(item)
    await db.commit()
    return await _load_cart(db, user, session_token)


@dataclass
class PriceChange:
    supplier_ref: str
    label: str
    old_ttc: float
    new_ttc: float


async def checkout(
    db: AsyncSession, user: User
) -> tuple[Order | None, list[PriceChange]]:
    """
    Transforme le panier en commande.
    Revalide chaque prix contre Maxityre. Si un prix a changé, on NE crée
    PAS la commande : on renvoie la liste des changements pour confirmation
    explicite du client (anti-litige).
    """
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
            # Produit disparu : traité comme un changement bloquant
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
        # On ne crée pas la commande tant que le client n'a pas confirmé.
        return None, changes

    # Tous les prix sont stables -> on crée la commande (montants en centimes)
    total_ht = sum(
        round(ht * 100) * it.quantity for it, ht, _ in revalidated
    )
    total_ttc = sum(
        round(ttc * 100) * it.quantity for it, _, ttc in revalidated
    )
    order = Order(
        order_number=f"TVP-{uuid.uuid4().hex[:8].upper()}",
        user_id=user.id,
        status=OrderStatus.pending_payment,
        account_type_snapshot=account_type,
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

    # Le panier est consommé
    await db.delete(cart)
    await db.commit()
    await db.refresh(order)
    return order, []
