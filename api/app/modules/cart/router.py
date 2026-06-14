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
    UpdateQtyIn,
)

router = APIRouter(prefix="/cart", tags=["cart"])


def _serialize(cart: Cart) -> CartOut:
    items = [
        CartItemOut(
            id=i.id,
            supplier_ref=i.supplier_ref,
            label=i.label_snapshot,
            quantity=i.quantity,
            price_ht=i.price_ht_snapshot,
            price_ttc=i.price_ttc_snapshot,
        )
        for i in cart.items
    ]
    return CartOut(
        id=cart.id,
        session_token=cart.session_token,
        items=items,
        total_ht=round(
            sum(i.price_ht * i.quantity for i in items), 2
        ),
        total_ttc=round(
            sum(i.price_ttc * i.quantity for i in items), 2
        ),
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
            data.diameter, data.quantity,
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
            db, user, data.address_id, data.delivery_mode
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
