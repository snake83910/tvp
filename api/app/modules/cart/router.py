"""
Routes panier & checkout.

Panier anonyme : le client reçoit un X-Cart-Session à renvoyer ensuite.
À la connexion, le front appelle /cart/merge pour fusionner.
"""
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.models.order import Cart
from app.models.user import User
from app.modules.cart import service
from app.schemas.order import (
    AddItemIn,
    CartItemOut,
    CartOut,
    CheckoutIn,
    CheckoutResult,
    PromoValidateIn,
    PromoValidateOut,
    UpdateQtyIn,
)

router = APIRouter(prefix="/cart", tags=["cart"])


def _serialize(cart: Cart) -> CartOut:
    def _dimension(pd: dict) -> str | None:
        w, r, d = pd.get("width"), pd.get("ratio"), pd.get("diameter")
        return f"{w}/{r} R{d}" if w and r and d else None

    items = [
        CartItemOut(
            id=i.id,
            supplier_ref=i.supplier_ref,
            label=i.label_snapshot,
            quantity=i.quantity,
            price_ht=i.price_ht_snapshot,
            price_ttc=i.price_ttc_snapshot,
            dimension=_dimension(i.product_data or {}),
            image_url=(i.product_data or {}).get("image_url"),
            season=(i.product_data or {}).get("season"),
            category=(i.product_data or {}).get("category", "auto"),
        )
        for i in cart.items
    ]
    total_ht = round(sum(i.price_ht * i.quantity for i in items), 2)
    total_ttc = round(sum(i.price_ttc * i.quantity for i in items), 2)

    # Frais de port : calculés ici (règles serveur) pour que le front
    # n'ait pas à dupliquer la logique « gratuit si toutes lignes >= 2 ».
    from app.modules.shipping.rules import compute_home_shipping
    if items:
        ship = compute_home_shipping(
            [(i.category, i.quantity) for i in items]
        )
        shipping_ht = ship.ht_cents / 100
        shipping_ttc = ship.ttc_cents / 100
    else:
        shipping_ht = shipping_ttc = 0.0

    return CartOut(
        id=cart.id,
        session_token=cart.session_token,
        items=items,
        total_ht=total_ht,
        total_ttc=total_ttc,
        shipping_ht=shipping_ht,
        shipping_ttc=shipping_ttc,
        free_shipping=bool(items) and shipping_ttc == 0,
        grand_total_ttc=round(total_ttc + shipping_ttc, 2),
    )


@router.post("/items", response_model=CartOut)
async def add_item(
    data: AddItemIn,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
    x_cart_session: str | None = Header(default=None),
):
    try:
        cart = await service.add_item(
            db, user, x_cart_session,
            data.supplier_ref, data.width, data.ratio,
            data.diameter, data.quantity, data.category,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _serialize(cart)


@router.get("", response_model=CartOut)
async def get_cart(
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
    x_cart_session: str | None = Header(default=None),
):
    if user is not None:
        cart = await db.scalar(
            select(Cart).where(Cart.user_id == user.id)
            .options(selectinload(Cart.items))
        )
    elif x_cart_session:
        cart = await db.scalar(
            select(Cart).where(Cart.session_token == x_cart_session)
            .options(selectinload(Cart.items))
        )
    else:
        cart = None
    if cart is None:
        return CartOut(id=None, session_token=None, items=[], total_ht=0, total_ttc=0)
    return _serialize(cart)


@router.patch("/items/{item_id}", response_model=CartOut)
async def update_item(
    item_id: str,
    data: UpdateQtyIn,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
    x_cart_session: str | None = Header(default=None),
):
    try:
        cart = await service.update_item_quantity(
            db, user, x_cart_session, item_id, data.quantity
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _serialize(cart)


@router.delete("/items/{item_id}", response_model=CartOut)
async def delete_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
    x_cart_session: str | None = Header(default=None),
):
    try:
        cart = await service.remove_item(
            db, user, x_cart_session, item_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _serialize(cart)


@router.post("/merge", response_model=CartOut)
async def merge_cart(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    x_cart_session: str | None = Header(default=None),
):
    if x_cart_session:
        await service.merge_anonymous_cart(db, user, x_cart_session)
    cart = await db.scalar(
        select(Cart).where(Cart.user_id == user.id)
        .options(selectinload(Cart.items))
    )
    if cart is None:
        raise HTTPException(status_code=404, detail="Panier vide")
    return _serialize(cart)


@router.post("/promo/validate", response_model=PromoValidateOut)
async def validate_promo_code(
    data: PromoValidateIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Aperçu de la remise d'un code promo sur le panier actuel.

    Purement informatif (UX) : le checkout re-valide de son côté.
    Renvoie toujours 200, avec valid=False + raison si refus."""
    cart = await db.scalar(
        select(Cart).where(Cart.user_id == user.id)
        .options(selectinload(Cart.items))
    )
    if cart is None or not cart.items:
        return PromoValidateOut(valid=False, reason="Panier vide")

    articles_ttc_cents = sum(
        round(i.price_ttc_snapshot * 100) * i.quantity for i in cart.items
    )
    from app.modules.promo.service import validate_promo
    try:
        promo, discount = await validate_promo(
            db, data.code, user.id, articles_ttc_cents
        )
    except ValueError as e:
        return PromoValidateOut(valid=False, reason=str(e))
    return PromoValidateOut(
        valid=True,
        code=promo.code,
        description=promo.description,
        discount_ttc=discount / 100,
    )


@router.post("/checkout", response_model=CheckoutResult)
async def checkout(
    data: CheckoutIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Finalise le panier en commande.
 
    - Exige acceptation explicite des CGV (obligation légale e-commerce FR).
    - Adresse de livraison et mode passés au service, qui figera tout
      dans la commande créée.
    - Si les prix Maxityre ont changé depuis l'ajout au panier, on ne
      crée PAS la commande : on renvoie les écarts pour confirmation
      explicite côté frontend (anti-litige).
    """
    if not data.accept_terms:
        raise HTTPException(
            status_code=400,
            detail="Vous devez accepter les conditions générales de vente",
        )
    try:
        order, changes = await service.checkout(
            db, user, data.address_id, data.delivery_mode,
            promo_code=data.promo_code,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
 
    if order is None:
        # Prix modifiés : commande non créée, on renvoie les écarts
        return CheckoutResult(
            price_changes=[
                {
                    "supplier_ref": c.supplier_ref,
                    "label": c.label,
                    "old_ttc": c.old_ttc,
                    "new_ttc": c.new_ttc,
                }
                for c in changes
            ]
        )
    return CheckoutResult(
        order_number=order.order_number,
        status=order.status.value,
        total_ttc=order.total_ttc_cents / 100,
    )
