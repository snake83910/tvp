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


@router.post("/password", status_code=204)
async def change_password(
    payload: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change le mot de passe du compte courant.
    Vérifie l'ancien mot de passe avant d'appliquer le nouveau."""
    from app.core.security import hash_password, verify_password

    old_pwd = payload.get("old_password") or ""
    new_pwd = payload.get("new_password") or ""
    if len(new_pwd) < 8:
        raise HTTPException(status_code=422, detail="Mot de passe trop court (8 caractères minimum)")
    if len(new_pwd) > 128:
        raise HTTPException(status_code=422, detail="Mot de passe trop long")
    if not verify_password(old_pwd, user.password_hash):
        raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect")
    user.password_hash = hash_password(new_pwd)
    # Toute autre session (autre appareil, token volé) est déconnectée :
    # changer son mot de passe doit invalider l'existant.
    from app.modules.auth.service import revoke_all_refresh_tokens
    await revoke_all_refresh_tokens(db, user.id)
    await db.commit()
    return None


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


@router.post("/orders/{order_number}/cancel")
async def cancel_my_order(
    order_number: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Annule une commande EN ATTENTE DE PAIEMENT (et uniquement ce
    statut : une commande payée passe par le SAV / remboursement).

    Cas d'usage : le client a quitté la page de paiement (retour
    navigateur) — sans ce bouton, la commande restait bloquée en
    attente jusqu'à l'annulation automatique à J+7.
    """
    from app.models.order import OrderStatus
    from app.modules.mailer.service import send_order_cancelled

    order = await db.scalar(
        select(Order).where(Order.order_number == order_number)
    )
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if order.status != OrderStatus.pending_payment:
        raise HTTPException(
            status_code=400,
            detail=(
                "Seule une commande en attente de paiement peut être "
                f"annulée ici (statut actuel : {order.status.value})"
            ),
        )

    order.transition_to(OrderStatus.cancelled)
    await db.commit()
    send_order_cancelled(order, user, "Annulée à votre demande")
    return {"status": "cancelled", "order_number": order.order_number}


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


# ---------- RGPD : export et suppression du compte ----------

@router.get("/export")
async def export_personal_data(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Droit à la portabilité (RGPD art. 20) : export JSON des données du compte."""
    addresses = list(
        await db.scalars(select(Address).where(Address.user_id == user.id))
    )
    orders = list(
        await db.scalars(
            select(Order)
            .where(Order.user_id == user.id)
            .options(selectinload(Order.items))
        )
    )

    data = {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "account_type": user.account_type.value,
            "created_at": user.created_at.isoformat(),
        },
        "addresses": [
            {
                "label": a.label, "line1": a.line1, "line2": a.line2,
                "postal_code": a.postal_code, "city": a.city,
                "country": a.country, "is_default": a.is_default,
            } for a in addresses
        ],
        "orders": [
            {
                "order_number": o.order_number,
                "status": o.status.value,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "total_ht_cents": o.total_ht_cents,
                "items": [
                    {
                        "supplier_ref": it.supplier_ref,
                        "label": it.label_snapshot,
                        "quantity": it.quantity,
                        "unit_price_ht_cents": it.unit_price_ht_cents,
                    } for it in o.items
                ],
            } for o in orders
        ],
    }
    return data


@router.delete("/account", status_code=204)
async def delete_account(
    payload: dict | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Re-auth : exige un token frais (obtenu via POST /auth/reauth)
    from app.core.security import decode_token
    from jose import JWTError
    reauth = (payload or {}).get("reauth_token") or ""
    try:
        rt = decode_token(reauth)
        if rt.get("type") != "reauth" or rt.get("sub") != str(user.id):
            raise ValueError
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Veuillez re-saisir votre mot de passe via /auth/reauth",
        )
    """Droit à l'effacement (RGPD art. 17).

    On anonymise plutôt que supprimer : les commandes/factures doivent
    être conservées 10 ans (obligation comptable). On supprime ce qui
    est strictement personnel et on rend le compte inutilisable.
    """
    from datetime import datetime, timezone
    anon_email = f"deleted-{user.id}@anonymized.tousvospneus.com"
    user.email = anon_email
    user.password_hash = "DELETED"
    user.first_name = None
    user.last_name = None
    user.phone = None
    user.is_active = False
    user.email_verified = False

    # Supprimer les adresses (pas requises pour la compta — elles sont
    # déjà figées dans Order.shipping_address en snapshot JSON)
    await db.execute(
        Address.__table__.delete().where(Address.user_id == user.id)
    )
    await db.commit()
    return Response(status_code=204)