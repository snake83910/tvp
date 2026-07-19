"""
Espace administration — réservé aux users avec role=admin.

Endpoints :
  GET  /admin/stats                         Indicateurs globaux
  GET  /admin/orders                        Liste toutes les commandes
  GET  /admin/orders/{order_number}         Détail + infos client
  PATCH /admin/orders/{order_number}/status Changement de statut + email auto
"""
import uuid
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
from app.models.promo import PromoCode
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
    PromoCodeIn,
    PromoCodeOut,
    PromoCodeUpdate,
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
        billing_address=order.billing_address or order.shipping_address,
        invoice_number=order.invoice_number,
        promo_code=order.promo_code,
        discount_ttc=order.discount_ttc_cents / 100,
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
        admin_note=order.admin_note,
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

    # 30 jours précédents (jours -60 à -30) pour comparatif
    prev_start = today - timedelta(days=60)
    prev_end = today - timedelta(days=30)
    prev_row = (await db.execute(
        select(func.count(Order.id), func.sum(Order.total_ttc_cents))
        .where(
            Order.created_at >= prev_start,
            Order.created_at < prev_end,
            Order.status.in_(paid_statuses),
        )
    )).first()
    orders_prev30 = prev_row[0] or 0
    revenue_prev30 = (prev_row[1] or 0) / 100

    # Top 5 produits sur 30 jours
    from app.models.order import OrderItem
    top_rows = (await db.execute(
        select(
            OrderItem.supplier_ref,
            OrderItem.label_snapshot,
            func.sum(OrderItem.quantity).label("qty"),
            # TTC calculé avec le vat_rate de CHAQUE ligne (pas un 20 %
            # codé en dur, faux dès qu'un autre taux existera : DOM, export…)
            func.sum(
                OrderItem.quantity
                * OrderItem.unit_price_ht_cents
                * (1 + OrderItem.vat_rate / 100)
            ).label("rev_ttc"),
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
            "revenue_ttc": round((r.rev_ttc or 0) / 100, 2),
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
        orders_prev30=orders_prev30,
        revenue_prev30_ttc=revenue_prev30,
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
    from datetime import date as _date, datetime as _dt, timedelta, timezone

    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    )
    if from_date:
        # Début de journée UTC
        start = _dt.combine(_date.fromisoformat(from_date), _dt.min.time(), tzinfo=timezone.utc)
        stmt = stmt.where(Order.created_at >= start)
    if to_date:
        # Fin de journée inclusive = début du jour suivant en UTC
        end = _dt.combine(_date.fromisoformat(to_date) + timedelta(days=1), _dt.min.time(), tzinfo=timezone.utc)
        stmt = stmt.where(Order.created_at < end)

    orders = list(await db.scalars(stmt))

    # Charger les emails clients en une seule requête séparée
    user_ids = {o.user_id for o in orders}
    emails: dict = {}
    if user_ids:
        for uid, email in (await db.execute(
            select(User.id, User.email).where(User.id.in_(user_ids))
        )).all():
            emails[uid] = email

    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow([
        "order_number", "status", "created_at", "paid_at",
        "customer_email", "invoice_number",
        "total_ht_eur", "total_vat_eur", "total_ttc_eur",
        "item_count",
    ])
    for order in orders:
        w.writerow([
            order.order_number,
            order.status.value,
            order.created_at.isoformat() if order.created_at else "",
            order.paid_at.isoformat() if order.paid_at else "",
            emails.get(order.user_id, ""),
            order.invoice_number or "",
            f"{(order.total_ht_cents or 0) / 100:.2f}",
            f"{((order.total_ttc_cents or 0) - (order.total_ht_cents or 0)) / 100:.2f}",
            f"{(order.total_ttc_cents or 0) / 100:.2f}",
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
    from_date: str | None = Query(None, description="YYYY-MM-DD"),
    to_date: str | None = Query(None, description="YYYY-MM-DD"),
    min_amount: float | None = Query(None, ge=0),
    max_amount: float | None = Query(None, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    from datetime import date as _date, datetime as _dt, timedelta, timezone as _tz

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
    if from_date:
        start = _dt.combine(_date.fromisoformat(from_date), _dt.min.time(), tzinfo=_tz.utc)
        stmt = stmt.where(Order.created_at >= start)
    if to_date:
        end = _dt.combine(_date.fromisoformat(to_date) + timedelta(days=1), _dt.min.time(), tzinfo=_tz.utc)
        stmt = stmt.where(Order.created_at < end)
    if min_amount is not None:
        stmt = stmt.where(Order.total_ttc_cents >= int(min_amount * 100))
    if max_amount is not None:
        stmt = stmt.where(Order.total_ttc_cents <= int(max_amount * 100))

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


# ── Note interne admin ─────────────────────────────────────────────

@router.patch("/orders/{order_number}/note", response_model=AdminOrderDetail)
async def update_note(
    order_number: str,
    payload: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
):
    order = await _load_order(order_number, db)
    user = await db.get(User, order.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Client introuvable")
    note = (payload.get("admin_note") or "").strip()
    if len(note) > 2000:
        raise HTTPException(status_code=422, detail="Note trop longue (2000 max)")
    order.admin_note = note or None
    await audit(
        db, user=admin, action="order.note_update",
        target_type="order", target_id=order.order_number,
        payload={"length": len(note)}, request=request,
    )
    await db.commit()
    await db.refresh(order)
    return _order_to_detail(order, user)


# ── Historique audit par commande ──────────────────────────────────

@router.get("/orders/{order_number}/audit")
async def order_audit(
    order_number: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    from app.models.audit import AuditLog
    rows = await db.scalars(
        select(AuditLog)
        .where(AuditLog.target_type == "order", AuditLog.target_id == order_number)
        .order_by(AuditLog.created_at.desc())
        .limit(50)
    )
    return [
        {
            "id": str(r.id),
            "actor_email": r.actor_email,
            "action": r.action,
            "target_type": r.target_type,
            "target_id": r.target_id,
            "payload": r.payload,
            "ip": r.ip,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# ── Widget "à traiter / retards" ───────────────────────────────────

@router.get("/orders-attention")
async def orders_attention(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    from datetime import datetime as _dt, timedelta, timezone as _tz
    now = _dt.now(_tz.utc)

    # À expédier : paid (paiement OK, pas encore envoyé fournisseur)
    to_ship_rows = (await db.execute(
        select(Order, User)
        .join(User, User.id == Order.user_id)
        .options(selectinload(Order.items))
        .where(Order.status == OrderStatus.paid)
        .order_by(Order.paid_at.asc())
        .limit(10)
    )).all()

    # Retards : sent_to_supplier depuis > 48h
    threshold = now - timedelta(hours=48)
    late_rows = (await db.execute(
        select(Order, User)
        .join(User, User.id == Order.user_id)
        .options(selectinload(Order.items))
        .where(
            Order.status == OrderStatus.sent_to_supplier,
            Order.paid_at < threshold,
        )
        .order_by(Order.paid_at.asc())
        .limit(10)
    )).all()

    def serialize(rows):
        return [
            {
                "order_number": o.order_number,
                "status": o.status.value,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "total_ttc": (o.total_ttc_cents or 0) / 100,
                "item_count": sum(i.quantity for i in o.items),
                "customer_email": u.email,
                "customer_name": " ".join(filter(None, [u.first_name, u.last_name])) or None,
            }
            for o, u in rows
        ]

    return {
        "to_ship": serialize(to_ship_rows),
        "late": serialize(late_rows),
    }


# ── Sparkline 30 jours ─────────────────────────────────────────────

@router.get("/stats/sparkline")
async def stats_sparkline(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    from datetime import datetime as _dt, timedelta, timezone as _tz
    from sqlalchemy import cast, Date as _Date

    now = _dt.now(_tz.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start = now - timedelta(days=29)

    paid = [
        OrderStatus.paid, OrderStatus.sent_to_supplier,
        OrderStatus.shipped, OrderStatus.delivered,
    ]
    rows = (await db.execute(
        select(
            cast(Order.created_at, _Date).label("day"),
            func.count(Order.id).label("cnt"),
            func.sum(Order.total_ttc_cents).label("rev"),
        )
        .where(Order.created_at >= start, Order.status.in_(paid))
        .group_by("day")
    )).all()
    by_day = {r.day.isoformat(): (r.cnt or 0, (r.rev or 0) / 100) for r in rows}

    days = []
    revenue = []
    orders = []
    for i in range(30):
        d = (start + timedelta(days=i)).date().isoformat()
        days.append(d)
        cnt, rev = by_day.get(d, (0, 0))
        revenue.append(rev)
        orders.append(cnt)
    return {"days": days, "revenue": revenue, "orders": orders}


# ── Bulk email custom ──────────────────────────────────────────────

@router.post("/bulk-email")
async def bulk_email(
    payload: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
):
    """Envoie un email ad-hoc aux clients des commandes sélectionnées.

    Body : {order_numbers: [...], subject: "...", body: "..."}
    Dedupe par email avant envoi.
    """
    from app.modules.mailer import get_mailer
    from app.modules.mailer.base import fire_and_forget

    nums = payload.get("order_numbers") or []
    subject = (payload.get("subject") or "").strip()
    body = (payload.get("body") or "").strip()
    if not nums or not subject or not body:
        raise HTTPException(422, "order_numbers + subject + body requis")
    if len(nums) > 200:
        raise HTTPException(422, "Trop de destinataires (max 200)")

    rows = (await db.execute(
        select(Order, User)
        .join(User, User.id == Order.user_id)
        .where(Order.order_number.in_(nums))
    )).all()
    emails = {u.email for _, u in rows}

    mailer = get_mailer()
    for em in emails:
        fire_and_forget(mailer.send_template(
            to=em, subject=subject,
            template="bulk_admin.html",
            civilite="Bonjour",
            site_url="https://tousvospneus.com",
            body_text=body,
        ))

    await audit(
        db, user=admin, action="bulk.email_sent",
        target_type="bulk", target_id=None,
        payload={"recipients": len(emails), "subject": subject},
        request=request,
    )
    await db.commit()
    return {"sent": len(emails)}


# ── Codes promo ────────────────────────────────────────────────────

@router.get("/promo-codes", response_model=list[PromoCodeOut])
async def list_promo_codes(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
):
    """Liste des codes promo avec leur nombre d'utilisations
    (commandes non annulées portant le code)."""
    promos = list(await db.scalars(
        select(PromoCode).order_by(PromoCode.created_at.desc())
    ))
    uses_rows = await db.execute(
        select(Order.promo_code, func.count())
        .where(
            Order.promo_code.is_not(None),
            Order.status != OrderStatus.cancelled,
        )
        .group_by(Order.promo_code)
    )
    uses = dict(uses_rows.all())
    out = []
    for p in promos:
        item = PromoCodeOut.model_validate(p)
        item.uses = uses.get(p.code, 0)
        out.append(item)
    return out


@router.post("/promo-codes", response_model=PromoCodeOut, status_code=201)
async def create_promo_code(
    data: PromoCodeIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
):
    existing = await db.scalar(
        select(PromoCode).where(PromoCode.code == data.code)
    )
    if existing:
        raise HTTPException(status_code=409, detail="Ce code existe déjà")

    promo = PromoCode(**data.model_dump())
    db.add(promo)
    await audit(
        db, user=admin, action="promo.created",
        target_type="promo_code", target_id=data.code,
        payload=data.model_dump(mode="json"),
        request=request,
    )
    await db.commit()
    await db.refresh(promo)
    return PromoCodeOut.model_validate(promo)


@router.patch("/promo-codes/{promo_id}", response_model=PromoCodeOut)
async def update_promo_code(
    promo_id: uuid.UUID,
    data: PromoCodeUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
):
    promo = await db.get(PromoCode, promo_id)
    if promo is None:
        raise HTTPException(status_code=404, detail="Code promo introuvable")

    changes = data.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(promo, k, v)
    await audit(
        db, user=admin, action="promo.updated",
        target_type="promo_code", target_id=promo.code,
        payload={k: (str(v) if v is not None else None) for k, v in changes.items()},
        request=request,
    )
    await db.commit()
    await db.refresh(promo)
    return PromoCodeOut.model_validate(promo)


@router.delete("/promo-codes/{promo_id}", status_code=204)
async def delete_promo_code(
    promo_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(_admin),
):
    promo = await db.get(PromoCode, promo_id)
    if promo is None:
        raise HTTPException(status_code=404, detail="Code promo introuvable")
    code = promo.code
    await db.delete(promo)
    await audit(
        db, user=admin, action="promo.deleted",
        target_type="promo_code", target_id=code,
        request=request,
    )
    await db.commit()
    return None
