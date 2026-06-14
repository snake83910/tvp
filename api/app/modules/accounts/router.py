import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import Order
from app.schemas.order import OrderDetail, OrderItemDetail, OrderSummary
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import Address, User
from app.schemas.auth import AddressIn, AddressOut, UserOut

router = APIRouter(prefix="/me", tags=["account"])


@router.get("/profile", response_model=UserOut)
async def get_profile(user: User = Depends(get_current_user)):
    return user


@router.get("/addresses", response_model=list[AddressOut])
async def list_addresses(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.scalars(
        select(Address).where(Address.user_id == user.id)
    )
    return list(rows)


@router.post("/addresses", response_model=AddressOut, status_code=201)
async def add_address(
    data: AddressIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    addr = Address(user_id=user.id, **data.model_dump())
    if addr.is_default:
        # une seule adresse par défaut
        existing = await db.scalars(
            select(Address).where(
                Address.user_id == user.id, Address.is_default.is_(True)
            )
        )
        for a in existing:
            a.is_default = False
    db.add(addr)
    await db.commit()
    await db.refresh(addr)
    return addr


@router.put("/addresses/{address_id}", response_model=AddressOut)
async def update_address(
    address_id: uuid.UUID,
    data: AddressIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    addr = await db.scalar(
        select(Address).where(Address.id == address_id, Address.user_id == user.id)
    )
    if addr is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Adresse introuvable")
    if data.is_default:
        others = await db.scalars(
            select(Address).where(
                Address.user_id == user.id,
                Address.is_default.is_(True),
                Address.id != address_id,
            )
        )
        for a in others:
            a.is_default = False
    for field, value in data.model_dump().items():
        setattr(addr, field, value)
    await db.commit()
    await db.refresh(addr)
    return addr


@router.patch("/addresses/{address_id}/default", response_model=AddressOut)
async def set_default_address(
    address_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    addr = await db.scalar(
        select(Address).where(Address.id == address_id, Address.user_id == user.id)
    )
    if addr is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Adresse introuvable")
    others = await db.scalars(
        select(Address).where(
            Address.user_id == user.id, Address.is_default.is_(True)
        )
    )
    for a in others:
        a.is_default = False
    addr.is_default = True
    await db.commit()
    await db.refresh(addr)
    return addr


@router.delete("/addresses/{address_id}", status_code=204)
async def delete_address(
    address_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    addr = await db.scalar(
        select(Address).where(Address.id == address_id, Address.user_id == user.id)
    )
    if addr is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Adresse introuvable")
    await db.delete(addr)
    await db.commit()

@router.get("/orders", response_model=list[OrderSummary])
async def list_my_orders(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Liste des commandes du client connecté, plus récentes en premier."""
    rows = (
        await db.scalars(
            select(Order)
            .where(Order.user_id == user.id)
            .order_by(Order.created_at.desc())
            .options(selectinload(Order.items))
        )
    ).all()

    return [
        OrderSummary(
            order_number=o.order_number,
            status=o.status.value,
            created_at=o.created_at,
            total_ttc=o.total_ttc_cents / 100,
            item_count=sum(i.quantity for i in o.items),
        )
        for o in rows
    ]


@router.get("/orders/{order_number}", response_model=OrderDetail)
async def get_my_order(
    order_number: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Détail d'une commande.

    Sécurité : on vérifie que la commande appartient au caller. Pas
    moyen de lire la commande de quelqu'un d'autre en devinant un
    order_number.
    """
    order = await db.scalar(
        select(Order)
        .where(Order.order_number == order_number)
        .options(selectinload(Order.items))
    )
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    items_detail = []
    articles_ht_cents = 0
    articles_ttc_cents = 0
    for it in order.items:
        unit_ht = it.unit_price_ht_cents / 100
        vat_mult = 1 + it.vat_rate / 100
        unit_ttc = round(unit_ht * vat_mult, 2)
        line_ttc = round(unit_ttc * it.quantity, 2)
        line_ht_cents = it.unit_price_ht_cents * it.quantity
        articles_ht_cents += line_ht_cents
        articles_ttc_cents += round(line_ht_cents * vat_mult)

        items_detail.append(OrderItemDetail(
            supplier_ref=it.supplier_ref,
            label=it.label_snapshot,
            quantity=it.quantity,
            unit_price_ht=unit_ht,
            unit_price_ttc=unit_ttc,
            line_total_ttc=line_ttc,
        ))

    return OrderDetail(
        order_number=order.order_number,
        status=order.status.value,
        created_at=order.created_at,
        paid_at=order.paid_at,
        delivery_mode=order.delivery_mode,
        shipping_address=order.shipping_address,
        invoice_number=order.invoice_number,
        tracking_number=order.tracking_number,
        carrier=order.carrier,
        tracking_url=order.tracking_url,
        items=items_detail,
        articles_ht=articles_ht_cents / 100,
        articles_ttc=articles_ttc_cents / 100,
        shipping_ht=order.shipping_ht_cents / 100,
        shipping_ttc=(order.shipping_ht_cents + order.shipping_vat_cents) / 100,
        total_ht=order.total_ht_cents / 100,
        total_vat=order.total_vat_cents / 100,
        total_ttc=order.total_ttc_cents / 100,
    )


@router.get("/orders/{order_number}/invoice")
async def download_invoice(
    order_number: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Télécharge la facture PDF d'une commande (réservé au propriétaire)."""
    order = await db.scalar(
        select(Order)
        .where(Order.order_number == order_number)
        .options(selectinload(Order.items))
    )
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    from app.modules.orders.invoice import generate_invoice_pdf
    pdf_bytes = generate_invoice_pdf(order, user)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="facture-{order_number}.pdf"'
        },
    )