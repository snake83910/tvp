"""
Paiement.

SÉCURITÉ : la commande passe à 'paid' UNIQUEMENT via le webhook IPN
serveur, signature vérifiée. Le retour navigateur n'a aucune valeur
probante (l'utilisateur peut fermer l'onglet, rejouer l'URL...).

Idempotence : un même IPN rejoué ne doit pas créer 2 paiements ni
re-déclencher la transmission fournisseur.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings

from app.db.session import get_db
from app.core.deps import get_current_user
from app.integrations.payment import get_payment_provider
from app.models.order import Order, OrderStatus, Payment
from app.models.user import User
from app.modules.mailer.service import send_order_confirmation
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
        public_key=init.public_key,
    )


@router.post("/ipn")
async def payment_ipn(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_signature: str | None = Header(default=None),
):
    """Webhook serveur. Aucune authentification utilisateur : c'est la
    signature HMAC qui fait foi.

    Sogecommerce envoie application/x-www-form-urlencoded avec kr-answer
    et kr-hash. La simulation envoie du JSON. On gère les deux.
    """
    content_type = request.headers.get("content-type", "")
    if "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        payload = dict(form)
    else:
        payload = await request.json()

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

    newly_paid = False
    if result.success:
        payment.status = "captured"
        if order.status == OrderStatus.pending_payment:
            order.transition_to(OrderStatus.paid)
            order.paid_at = datetime.now(timezone.utc)
            order.invoice_number = (await db.execute(text("SELECT nextval('invoice_number_seq')"))).scalar()
            newly_paid = True
        # NOTE phase suivante : déclencher ici la transmission fournisseur
        # (order.transition_to(sent_to_supplier)) via une tâche asynchrone.
    else:
        payment.status = "failed"

    await db.commit()

    if newly_paid:
        order_full = await db.scalar(
            select(Order)
            .where(Order.id == order.id)
            .options(selectinload(Order.items))
        )
        order_user = await db.get(User, order.user_id)
        if order_full and order_user:
            send_order_confirmation(order_full, order_user)

    return {"status": "ok", "order_status": order.status.value}

@router.post("/simulate/{order_number}")
async def simulate_payment(
    order_number: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Simulation de paiement réussi (UNIQUEMENT en mode simulated).
    Permet de tester le tunnel complet en local sans Sogecommerce réel.
    Refusé en production : le passage à 'paid' doit venir d'un IPN
    bancaire signé, jamais d'un appel client.
    """
    if settings.payment_provider != "simulated":
        raise HTTPException(
            status_code=403,
            detail="Simulation interdite en mode paiement réel",
        )

    order = await db.scalar(
        select(Order).where(Order.order_number == order_number)
    )
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if order.status != OrderStatus.pending_payment:
        return {
            "status": "already_processed",
            "order_status": order.status.value,
        }

    payment = await db.scalar(
        select(Payment).where(Payment.order_id == order.id)
    )
    if payment is None:
        raise HTTPException(
            status_code=400,
            detail="Initialiser le paiement d'abord",
        )

    payment.status = "captured"
    payment.ipn_signature_ok = True
    payment.ipn_payload = {"simulated": True}
    order.transition_to(OrderStatus.paid)
    order.paid_at = datetime.now(timezone.utc)
    order.invoice_number = (await db.execute(text("SELECT nextval('invoice_number_seq')"))).scalar()
    await db.commit()

    order_full = await db.scalar(
        select(Order)
        .where(Order.id == order.id)
        .options(selectinload(Order.items))
    )
    if order_full:
        send_order_confirmation(order_full, user)

    return {"status": "ok", "order_status": order.status.value}


@router.post("/sync/{order_number}")
async def sync_payment(
    order_number: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Synchronise le statut d'une commande avec Sogecommerce via l'API Order/Get.
    Utile en développement local quand l'IPN ne peut pas être reçu (pas de ngrok).
    Sécurisé : vérifie le statut côté banque, n'accepte jamais la parole du navigateur.
    """
    if settings.payment_provider != "sogecommerce":
        raise HTTPException(
            status_code=400,
            detail="sync uniquement disponible avec le provider sogecommerce",
        )

    order = await db.scalar(
        select(Order).where(Order.order_number == order_number)
    )
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    if order.status != OrderStatus.pending_payment:
        return {"status": "already_processed", "order_status": order.status.value}

    payment = await db.scalar(
        select(Payment).where(Payment.order_id == order.id)
    )
    if payment is None:
        raise HTTPException(status_code=400, detail="Aucun paiement initialisé")

    from app.integrations.payment import SogecommercePayment
    soge = SogecommercePayment()
    try:
        answer = await soge.get_order_status(payment.provider_ref)
    except Exception as exc:
        # Order/Get API not enabled on this shop (PSP_100) — sync indisponible.
        # L'IPN serveur mettra à jour le statut ; on retourne 200 pour ne pas bloquer le frontend.
        return {"status": "unavailable", "detail": str(exc), "order_status": order.status.value}

    order_status_soge = answer.get("orderStatus", "UNPAID")
    if order_status_soge != "PAID":
        return {
            "status": "not_paid_yet",
            "sogecommerce_status": order_status_soge,
            "order_status": order.status.value,
        }

    transactions = answer.get("transactions") or []
    payment.status = "captured"
    payment.ipn_signature_ok = True
    payment.ipn_payload = answer
    order.transition_to(OrderStatus.paid)
    order.paid_at = datetime.now(timezone.utc)
    order.invoice_number = (
        await db.execute(text("SELECT nextval('invoice_number_seq')"))
    ).scalar()
    await db.commit()

    order_full = await db.scalar(
        select(Order).where(Order.id == order.id).options(selectinload(Order.items))
    )
    if order_full:
        send_order_confirmation(order_full, user)

    return {"status": "synced", "order_status": OrderStatus.paid.value}