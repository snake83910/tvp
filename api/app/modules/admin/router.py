"""
Espace administration — réservé aux users avec role=admin.

Endpoints :
  GET  /admin/stats                         Indicateurs globaux
  GET  /admin/orders                        Liste toutes les commandes
  GET  /admin/orders/{order_number}         Détail + infos client
  PATCH /admin/orders/{order_number}/status Changement de statut + email auto
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fastapi import Request

from app.core.audit import audit
from app.core.deps import get_db, require_role
from app.models.order import ALLOWED_TRANSITIONS, Order, OrderStatus
from app.models.user import User, UserRole
from app.modules.mailer.service import (
    send_order_cancelled,
    send_order_delivered,
    send_order_shipped,
)
from app.schemas.order import (
    AdminOrderDetail,
    AdminOrderSummary,
    AdminStats,
    OrderItemDetail,
    StatusUpdateIn,
)

router = APIRouter(prefix="/admin", tags=["admin"])

_admin = require_role(UserRole.admin)


# ── Helpers ────────────────────────────────────────────────────────

def _order_to_detail(order: Order, user: User) -> AdminOrderDetail:
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

    allowed = [s.value for s in ALLOWED_TRANSITIONS.get(order.status, set())]

    full_name = " ".join(filter(None, [user.first_name, user.last_name])) or None

    return AdminOrderDetail(
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
        customer_email=user.email,
        customer_name=full_name,
        allowed_transitions=allowed,
    )


async def _load_order(order_number: str, db: AsyncSession) -> Order:
    order = await db.scalar(
        select(Order)
        .where(Order.order_number == order_number)
        .options(selectinload(Order.items))
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    return order


# ── Stats ──────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    result = await db.execute(
        select(Order.status, func.count(Order.id).label("cnt"))
        .group_by(Order.status)
    )
    by_status: dict[str, int] = {row.status.value: row.cnt for row in result}

    paid_statuses = [
        OrderStatus.paid,
        OrderStatus.sent_to_supplier,
        OrderStatus.shipped,
        OrderStatus.delivered,
    ]
    rev = await db.scalar(
        select(func.sum(Order.total_ttc_cents)).where(Order.status.in_(paid_statuses))
    )

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_row = await db.execute(
        select(func.count(Order.id), func.sum(Order.total_ttc_cents))
        .where(Order.created_at >= today, Order.status.in_(paid_statuses))
    )
    t = today_row.first()

    # 30 derniers jours
    from datetime import timedelta
    last30 = today - timedelta(days=30)
    row30 = (await db.execute(
        select(func.count(Order.id), func.sum(Order.total_ttc_cents))
        .where(Order.created_at >= last30, Order.status.in_(paid_statuses))
    )).first()
    orders_30d = row30[0] or 0
    revenue_30d = (row30[1] or 0) / 100
    avg_cart = (revenue_30d / orders_30d) if orders_30d else 0.0

    # Top 5 produits sur 30 jours
    from app.models.order import OrderItem
    top_rows = (await db.execute(
        select(
            OrderItem.supplier_ref,
            OrderItem.label_snapshot,
            func.sum(OrderItem.quantity).label("qty"),
            func.sum(OrderItem.quantity * OrderItem.unit_price_ht_cents).label("rev"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.created_at >= last30, Order.status.in_(paid_statuses))
        .group_by(OrderItem.supplier_ref, OrderItem.label_snapshot)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
    )).all()
    top_products = [
        {
            "ref": r.supplier_ref,
            "label": r.label_snapshot,
            "qty": int(r.qty or 0),
            "revenue_ttc": round((r.rev or 0) * 1.20 / 100, 2),
        }
        for r in top_rows
    ]

    return AdminStats(
        orders_by_status=by_status,
        revenue_total_ttc=(rev or 0) / 100,
        orders_today=t[0] or 0,
        revenue_today_ttc=(t[1] or 0) / 100,
        orders_30d=orders_30d,
        revenue_30d_ttc=revenue_30d,
        avg_cart_ttc=round(avg_cart, 2),
        top_products=top_products,
    )


@router.get("/orders/export.csv")
async def export_orders_csv(
    from_date: str | None = Query(None, description="YYYY-MM-DD"),
    to_date: str | None = Query(None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    """Export CSV des commandes pour la comptabilité."""
    import csv
    import io
    from datetime import date as _date

    stmt = (
        select(Order, User.email)
        .join(User, User.id == Order.user_id)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    )
    if from_date:
        stmt = stmt.where(Order.created_at >= _date.fromisoformat(from_date))
    if to_date:
        stmt = stmt.where(Order.created_at <= _date.fromisoformat(to_date))

    rows = (await db.execute(stmt)).all()

    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow([
        "order_number", "status", "created_at", "paid_at",
        "customer_email", "invoice_number",
        "total_ht_eur", "total_vat_eur", "total_ttc_eur",
        "item_count",
    ])
    for order, email in rows:
        w.writerow([
            order.order_number,
            order.status.value,
            order.created_at.isoformat() if order.created_at else "",
            order.paid_at.isoformat() if order.paid_at else "",
            email,
            order.invoice_number or "",
            f"{order.total_ht_cents / 100:.2f}",
            f"{(order.total_ttc_cents - order.total_ht_cents) / 100:.2f}",
            f"{order.total_ttc_cents / 100:.2f}",
            sum(it.quantity for it in order.items),
        ])

    csv_bytes = buf.getvalue().encode("utf-8-sig")  # BOM pour Excel
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="commandes.csv"',
        },
    )


# ── Liste commandes ────────────────────────────────────────────────

@router.get("/orders", response_model=list[AdminOrderSummary])
async def list_orders(
    status: str | None = Query(None),
    q: str | None = Query(None, description="Recherche par n° commande ou email"),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    stmt = (
        select(Order, User)
        .join(User, User.id == Order.user_id)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    )
    if status:
        try:
            stmt = stmt.where(Order.status == OrderStatus(status))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Statut inconnu : {status}")
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            Order.order_number.ilike(pattern) | User.email.ilike(pattern)
        )

    offset = (page - 1) * per_page
    stmt = stmt.offset(offset).limit(per_page)

    rows = (await db.execute(stmt)).all()

    return [
        AdminOrderSummary(
            order_number=order.order_number,
            status=order.status.value,
            created_at=order.created_at,
            total_ttc=order.total_ttc_cents / 100,
            item_count=sum(i.quantity for i in order.items),
            customer_email=user.email,
            customer_name=" ".join(filter(None, [user.first_name, user.last_name])) or None,
        )
        for order, user in rows
    ]


# ── Détail commande ────────────────────────────────────────────────

@router.get("/orders/{order_number}", response_model=AdminOrderDetail)
async def get_order(
    order_number: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    order = await _load_order(order_number, db)
    user = await db.get(User, order.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Client introuvable")
    return _order_to_detail(order, user)


# ── Changement de statut ───────────────────────────────────────────

@router.get("/orders/{order_number}/invoice")
async def download_invoice_admin(
    order_number: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    """Télécharge la facture PDF d'une commande (admin)."""
    order = await _load_order(order_number, db)
    user = await db.get(User, order.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Client introuvable")

    from app.modules.orders.invoice import generate_invoice_pdf
    pdf_bytes = generate_invoice_pdf(order, user)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="facture-{order_number}.pdf"'
        },
    )


@router.patch("/orders/{order_number}/status", response_model=AdminOrderDetail)
async def update_status(
    order_number: str,
    data: StatusUpdateIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
):
    order = await _load_order(order_number, db)
    user = await db.get(User, order.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Client introuvable")

    try:
        target = OrderStatus(data.status)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Statut inconnu : {data.status}")

    previous_status = order.status.value

    try:
        order.transition_to(target)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if target == OrderStatus.shipped:
        order.tracking_number = data.tracking_number or order.tracking_number
        order.carrier = data.carrier or order.carrier
        order.tracking_url = data.tracking_url or order.tracking_url
        send_order_shipped(order, user, data.tracking_number, data.carrier)
    elif target == OrderStatus.delivered:
        send_order_delivered(order, user)
    elif target == OrderStatus.cancelled:
        send_order_cancelled(order, user, data.cancel_reason)

    await audit(
        db, user=admin,
        action="order.status_change",
        target_type="order", target_id=order.order_number,
        payload={
            "from": previous_status, "to": target.value,
            "tracking_number": data.tracking_number,
            "cancel_reason": data.cancel_reason,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(order)
    return _order_to_detail(order, user)
