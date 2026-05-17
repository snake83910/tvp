"""
Paiement.

SÉCURITÉ : la commande passe à 'paid' UNIQUEMENT via le webhook IPN
serveur, signature vérifiée. Le retour navigateur n'a aucune valeur
probante (l'utilisateur peut fermer l'onglet, rejouer l'URL...).

Idempotence : un même IPN rejoué ne doit pas créer 2 paiements ni
re-déclencher la transmission fournisseur.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import get_current_user
from app.integrations.payment import get_payment_provider
from app.models.order import Order, OrderStatus, Payment
from app.models.user import User
from app.schemas.order import PaymentInitOut

router = APIRouter(prefix="/payment", tags=["payment"])


@router.post("/init/{order_number}", response_model=PaymentInitOut)
async def init_payment(
    order_number: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    order = await db.scalar(
        select(Order).where(Order.order_number == order_number)
    )
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if order.status != OrderStatus.pending_payment:
        raise HTTPException(
            status_code=400,
            detail=f"Commande non payable (statut {order.status.value})",
        )

    provider = get_payment_provider()
    init = await provider.init_payment(
        str(order.id), order.total_ttc_cents
    )
    db.add(
        Payment(
            order_id=order.id,
            provider=init.provider,
            provider_ref=init.provider_ref,
            amount_cents=init.amount_cents,
            status="initialised",
        )
    )
    await db.commit()
    return PaymentInitOut(
        provider=init.provider,
        provider_ref=init.provider_ref,
        form_token=init.form_token,
        amount_cents=init.amount_cents,
    )


@router.post("/ipn")
async def payment_ipn(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    x_signature: str | None = Header(default=None),
):
    """Webhook serveur. Aucune authentification utilisateur : c'est la
    signature HMAC qui fait foi."""
    provider = get_payment_provider()
    result = provider.verify_ipn(payload, x_signature)

    if not result.signature_ok:
        raise HTTPException(status_code=400, detail="Signature invalide")

    payment = await db.scalar(
        select(Payment).where(
            Payment.provider_ref == result.provider_ref
        )
    )
    if payment is None:
        raise HTTPException(status_code=404, detail="Paiement inconnu")

    # Idempotence : déjà traité -> on renvoie OK sans rejouer
    if payment.status == "captured":
        return {"status": "already_processed"}

    payment.ipn_payload = result.raw
    payment.ipn_signature_ok = True

    order = await db.get(Order, payment.order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    if result.success:
        payment.status = "captured"
        # Transition contrôlée : lève si l'état ne le permet pas
        if order.status == OrderStatus.pending_payment:
            order.transition_to(OrderStatus.paid)
            order.paid_at = datetime.now(timezone.utc)
        # NOTE phase suivante : déclencher ici la transmission fournisseur
        # (order.transition_to(sent_to_supplier)) via une tâche asynchrone.
    else:
        payment.status = "failed"

    await db.commit()
    return {"status": "ok", "order_status": order.status.value}
