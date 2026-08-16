"""Réconciliation d'une commande avec la banque.

Le passage à `paid` vient normalement de l'IPN Sogecommerce. Mais un IPN
peut se perdre : nginx qui redémarre pendant le POST, coupure réseau,
API indisponible au moment où la banque réessaie. Le client est alors
débité et sa commande reste en `pending_payment` — il reçoit des
relances « votre commande attend votre paiement », puis au bout de sept
jours son achat est annulé. L'argent est parti, les pneus ne viendront
jamais.

Ce module demande à la banque ce qu'elle sait, avec exactement les
mêmes contrôles que l'IPN (statut PAID **et** montant identique au total
de la commande). Il sert deux appelants :

  - `POST /payment/sync/{order}`, déclenché par le client depuis la page
    de paiement ;
  - le job `/cron/dunning`, qui l'utilise avant de décider d'annuler.

Le verdict est CONSERVÉ sur la commande (`payment_check_result`) : c'est
lui qui autorise — ou interdit — l'annulation automatique. Dans le
doute, on n'annule pas.
"""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.order import Order, OrderStatus, Payment
from app.models.user import User

# Verdicts possibles. Seuls NOT_PAID et SKIPPED autorisent une
# annulation automatique : les deux signifient « la banque n'a rien
# encaissé ». Les autres demandent un humain.
PAID = "paid"                       # la banque confirme, commande validée
NOT_PAID = "not_paid"               # la banque répond : rien d'encaissé
UNAVAILABLE = "unavailable"         # impossible de savoir (API muette)
AMOUNT_MISMATCH = "amount_mismatch" # encaissé, mais pas le bon montant
SKIPPED = "skipped"                 # rien à vérifier (aucun paiement initié)
ALREADY_PROCESSED = "already_processed"

#: Verdicts après lesquels une annulation pour non-paiement est sûre.
SAFE_TO_CANCEL = frozenset({NOT_PAID, SKIPPED})


async def reconcile_order(db: AsyncSession, order: Order) -> str:
    """Interroge la banque et applique le paiement s'il a eu lieu.

    Rend l'un des verdicts ci-dessus et l'enregistre sur la commande.
    Ne lève jamais pour une banque injoignable : c'est un verdict
    (`UNAVAILABLE`), pas une erreur — l'appelant doit pouvoir continuer
    son lot.
    """
    if order.status != OrderStatus.pending_payment:
        return ALREADY_PROCESSED

    if settings.payment_provider != "sogecommerce":
        # En paiement simulé il n'y a pas de banque à interroger. On le
        # note quand même : sans verdict, la relance ne pourrait plus
        # rien annuler en développement.
        return await _record(db, order, SKIPPED)

    payment = await db.scalar(
        select(Payment).where(Payment.order_id == order.id)
    )
    if payment is None or not payment.provider_ref:
        # Le client n'a jamais atteint la page de paiement : il n'y a
        # rien à réconcilier, et l'abandon est réel.
        return await _record(db, order, SKIPPED)

    from app.integrations.payment import SogecommercePayment

    try:
        answer = await SogecommercePayment().get_order_status(payment.provider_ref)
    except Exception:
        # Order/Get peut ne pas être activé sur la boutique (PSP_100),
        # ou l'API être momentanément indisponible. Dans les deux cas on
        # ne sait pas — et ne pas savoir n'autorise rien.
        return await _record(db, order, UNAVAILABLE)

    if (answer.get("orderStatus") or "UNPAID") != "PAID":
        return await _record(db, order, NOT_PAID)

    # Même règle que l'IPN : un montant qui ne correspond pas ne valide
    # jamais la commande. Mais il ne l'annule pas non plus — de l'argent
    # a bougé, un humain doit regarder.
    transactions = answer.get("transactions") or [{}]
    paid_amount = int(transactions[0].get("amount") or 0)
    if paid_amount != order.total_ttc_cents:
        payment.status = "amount_mismatch"
        return await _record(db, order, AMOUNT_MISMATCH)

    # Relecture : l'IPN a pu passer la commande à `paid` pendant l'appel
    # réseau ci-dessus. Sans ce contrôle on re-consommerait un numéro de
    # facture et on renverrait l'email de confirmation.
    await db.refresh(order)
    if order.status != OrderStatus.pending_payment:
        return ALREADY_PROCESSED

    payment.status = "captured"
    payment.ipn_signature_ok = True
    payment.ipn_payload = answer
    order.transition_to(OrderStatus.paid)
    order.paid_at = datetime.now(UTC)
    order.invoice_number = (
        await db.execute(text("SELECT nextval('invoice_number_seq')"))
    ).scalar()
    await _record(db, order, PAID)

    await _notify_paid(db, order)
    return PAID


async def _record(db: AsyncSession, order: Order, verdict: str) -> str:
    """Grave le verdict sur la commande et valide la transaction."""
    order.payment_checked_at = datetime.now(UTC)
    order.payment_check_result = verdict
    await db.commit()
    return verdict


async def _notify_paid(db: AsyncSession, order: Order) -> None:
    """Mêmes emails que l'IPN : le client ne doit pas pouvoir deviner
    que sa commande a été validée par un rattrapage."""
    from app.modules.mailer.service import (
        send_appointment_confirmed,
        send_garage_order_notification,
        send_order_confirmation,
    )

    order_full = await db.scalar(
        select(Order).where(Order.id == order.id).options(selectinload(Order.items))
    )
    user = await db.get(User, order.user_id)
    if order_full is None or user is None:
        return
    send_order_confirmation(order_full, user)
    if order_full.garage_id:
        send_garage_order_notification(order_full, user)
        send_appointment_confirmed(order_full, user)
