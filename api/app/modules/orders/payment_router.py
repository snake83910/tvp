"""
Paiement.

SÉCURITÉ : la commande passe à 'paid' UNIQUEMENT via le webhook IPN
serveur, signature vérifiée. Le retour navigateur n'a aucune valeur
probante (l'utilisateur peut fermer l'onglet, rejouer l'URL...).

Idempotence : un même IPN rejoué ne doit pas créer 2 paiements ni
re-déclencher la transmission fournisseur.
"""
import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request
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
        str(order.id), order.total_ttc_cents, customer_email=user.email
    )
    # Un seul Payment par commande : si un init précédent existe (retour
    # arrière, double-clic), on le met à jour au lieu d'empiler des lignes
    # (les lookups par order_id prendraient une ligne arbitraire).
    payment = await db.scalar(
        select(Payment).where(Payment.order_id == order.id)
    )
    if payment is None:
        payment = Payment(order_id=order.id)
        db.add(payment)
    payment.provider = init.provider
    payment.provider_ref = init.provider_ref
    payment.amount_cents = init.amount_cents
    payment.status = "initialised"
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

    # Un IPN "PAID" dont le montant ne correspond pas au total de la
    # commande (paiement partiel, montant altéré côté PSP) ne doit
    # JAMAIS valider la commande.
    if result.success and result.amount_cents != order.total_ttc_cents:
        payment.status = "amount_mismatch"
        await db.commit()
        raise HTTPException(
            status_code=400,
            detail=(
                f"Montant IPN ({result.amount_cents}) différent du total "
                f"commande ({order.total_ttc_cents})"
            ),
        )

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

    # Même règle que l'IPN : montant payé == total commande, sinon refus.
    transactions = answer.get("transactions") or [{}]
    paid_amount = int(transactions[0].get("amount") or 0)
    if paid_amount != order.total_ttc_cents:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Montant payé ({paid_amount}) différent du total "
                f"commande ({order.total_ttc_cents})"
            ),
        )

    # Re-lit le statut : l'IPN a pu passer la commande à paid pendant
    # l'appel Sogecommerce ci-dessus (sinon on re-consommerait un
    # numéro de facture et re-enverrait l'email de confirmation).
    await db.refresh(order)
    if order.status != OrderStatus.pending_payment:
        return {"status": "already_processed", "order_status": order.status.value}

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


@router.post("/verify-kr-answer/{order_number}")
async def verify_kr_answer(
    order_number: str,
    kr_answer: Annotated[str, Body()],
    kr_hash: Annotated[str, Body()],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Vérifie le kr-answer Sogecommerce reçu par le navigateur après paiement.
    Sécurisé par HMAC-SHA256 : si la signature est invalide, on refuse.
    Ne nécessite pas WS_REST_GET (Order/Get).
    """
    if settings.payment_provider != "sogecommerce":
        raise HTTPException(status_code=400, detail="sogecommerce uniquement")

    hmac_key = settings.sogecommerce_hmac_key
    if not hmac_key:
        raise HTTPException(status_code=500, detail="SOGECOMMERCE_HMAC_KEY non configurée")

    computed = hmac.new(
        hmac_key.encode(),
        kr_answer.encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(computed, kr_hash):
        raise HTTPException(status_code=400, detail="Signature kr-answer invalide")

    try:
        answer = json.loads(kr_answer)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="kr-answer malformé")

    order = await db.scalar(
        select(Order).where(Order.order_number == order_number)
    )
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    # ANTI-REJEU : le kr-answer est signé, mais il faut vérifier qu'il
    # concerne BIEN cette commande. Sans ce contrôle, le kr-answer d'une
    # commande payée à 50 € pourrait valider n'importe quelle autre
    # commande en attente. L'orderId Sogecommerce = notre UUID interne.
    answer_order_id = (answer.get("orderDetails") or {}).get("orderId")
    if answer_order_id != str(order.id):
        raise HTTPException(
            status_code=400,
            detail="kr-answer ne correspond pas à cette commande",
        )

    if answer.get("orderStatus") != "PAID":
        return {"status": "not_paid", "order_status": answer.get("orderStatus")}

    # Montant payé == total commande, sinon refus (paiement partiel/altéré).
    txns = answer.get("transactions") or [{}]
    paid_amount = int(txns[0].get("amount") or 0)
    if paid_amount != order.total_ttc_cents:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Montant payé ({paid_amount}) différent du total "
                f"commande ({order.total_ttc_cents})"
            ),
        )

    if order.status == OrderStatus.paid:
        return {"status": "already_paid", "order_status": order.status.value}

    payment = await db.scalar(
        select(Payment).where(Payment.order_id == order.id)
    )
    if payment is None:
        raise HTTPException(status_code=400, detail="Aucun paiement initialisé")

    if order.status != OrderStatus.pending_payment:
        # Paiement encaissé sur une commande qui n'est plus payable
        # (ex. annulée entre-temps par la relance automatique). On
        # enregistre l'encaissement pour traitement manuel (remboursement)
        # au lieu de lever une transition invalide -> 500.
        payment.status = "captured_after_" + order.status.value
        payment.ipn_signature_ok = True
        payment.ipn_payload = answer
        await db.commit()
        import logging
        logging.getLogger(__name__).error(
            "Paiement capturé sur commande %s au statut %s : "
            "remboursement manuel requis",
            order.order_number, order.status.value,
        )
        return {
            "status": "paid_but_order_not_pending",
            "order_status": order.status.value,
        }

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

    return {"status": "ok", "order_status": OrderStatus.paid.value}