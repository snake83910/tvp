"""Remboursement d'une commande, exécuté chez la banque.

Jusqu'ici « remboursée » n'était qu'une déclaration : l'opération se
faisait à la main au Back Office, et le site se contentait d'enregistrer
un montant. Ce module appelle `Transaction/CancelOrRefund` pour que le
statut corresponde à un mouvement réel.

Trois principes, dans cet ordre :

1. **Ne jamais marquer remboursé sans réponse claire de la banque.** Un
   appel qui échoue, qui expire ou dont on ne comprend pas la réponse
   laisse la commande telle quelle. Un remboursement supposé est pire
   qu'un remboursement refusé : le client ne réclame pas ce qu'il croit
   avoir reçu.

2. **Un seul remboursement par commande.** La ligne est verrouillée
   (`SELECT … FOR UPDATE`) avant l'appel réseau. Sans ça, deux
   clics rapides déclenchent deux crédits — et récupérer de l'argent
   rendu en trop est autrement plus difficile que de le rendre.

3. **La transaction est relue chez la banque**, jamais reprise d'un
   payload stocké. Un remboursement se fait sur l'identifiant réel du
   débit, pas sur une copie vieille de plusieurs semaines.
"""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.order import Order, OrderStatus, Payment

#: États de transaction sur lesquels un remboursement a un sens. Les
#: autres (REFUSED, ERROR…) n'ont jamais débité le client.
_REFUNDABLE = {"CAPTURED", "AUTHORISED", "AUTHORISED_TO_VALIDATE", "ACCEPTED"}


class RefundError(RuntimeError):
    """Le remboursement n'a pas eu lieu. La commande n'a pas bougé."""


def api_available() -> bool:
    """Le remboursement automatique est-il possible sur cette instance ?

    Faux en paiement simulé (aucune banque) ou si les clés REST
    manquent. L'admin retombe alors sur la déclaration manuelle, qui
    reste explicitement présentée comme telle.
    """
    return bool(
        settings.payment_provider == "sogecommerce"
        and settings.sogecommerce_shop_id
        and settings.sogecommerce_api_password
    )


def pick_debit_transaction(transactions: list[dict]) -> dict | None:
    """Trouve LE débit à rembourser parmi les transactions d'une commande.

    Une commande peut en porter plusieurs : tentatives refusées, et
    éventuels crédits déjà émis. Rembourser un crédit ou une tentative
    refusée n'aurait aucun sens — on ne retient que le débit accepté.
    """
    for t in transactions or []:
        if t.get("operationType") != "DEBIT":
            continue
        if t.get("detailedStatus") in _REFUNDABLE and t.get("uuid"):
            return t
    return None


async def refund_order(
    db: AsyncSession,
    order: Order,
    amount_cents: int,
    comment: str | None = None,
) -> dict:
    """Rembourse `amount_cents` au client. Lève `RefundError` si rien
    n'a été rendu — l'appelant ne doit alors RIEN changer à la commande.

    Rend la transaction produite par la banque : c'est elle qui fait
    foi, et elle est archivée sur le paiement.
    """
    if not api_available():
        raise RefundError(
            "Remboursement automatique indisponible : la boutique "
            "Sogecommerce n'est pas configurée sur cette instance."
        )
    if amount_cents <= 0 or amount_cents > order.total_ttc_cents:
        raise RefundError("Montant de remboursement hors bornes.")

    # Verrou AVANT l'appel réseau : deux requêtes simultanées ne doivent
    # pas produire deux crédits. La seconde attend, relit, et voit que
    # la commande est déjà remboursée.
    locked = await db.scalar(
        select(Order).where(Order.id == order.id).with_for_update()
    )
    if locked is None:
        raise RefundError("Commande introuvable.")
    if locked.refunded_cents is not None:
        raise RefundError(
            f"Cette commande a déjà été remboursée "
            f"({locked.refunded_cents / 100:.2f} €)."
        )
    if locked.status == OrderStatus.refunded:
        raise RefundError("Cette commande est déjà marquée remboursée.")

    payment = await db.scalar(
        select(Payment).where(Payment.order_id == order.id)
    )
    if payment is None or not payment.provider_ref:
        raise RefundError(
            "Aucun paiement bancaire rattaché à cette commande."
        )

    from app.integrations.payment import SogecommercePayment

    soge = SogecommercePayment()

    # Relecture chez la banque : c'est elle qui détient l'identifiant de
    # transaction à jour, et qui sait si le débit est encore annulable.
    try:
        answer = await soge.get_order_status(payment.provider_ref)
    except Exception as exc:
        raise RefundError(
            f"Impossible de relire la transaction chez la banque : {exc}"
        ) from exc

    debit = pick_debit_transaction(answer.get("transactions") or [])
    if debit is None:
        raise RefundError(
            "Aucune transaction débitée à rembourser pour cette commande."
        )
    if amount_cents > int(debit.get("amount") or 0):
        raise RefundError(
            "Montant supérieur à la transaction débitée "
            f"({int(debit.get('amount') or 0) / 100:.2f} €)."
        )

    try:
        result = await soge.cancel_or_refund(
            debit["uuid"],
            amount_cents,
            currency=debit.get("currency") or order.currency or "EUR",
            comment=comment or f"Remboursement commande {order.order_number}",
        )
    except Exception as exc:
        raise RefundError(str(exc)) from exc

    # La banque a répondu SUCCESS. On archive sa réponse : c'est la
    # seule preuve exploitable si le client conteste plus tard.
    payment.refund_ref = result.get("uuid")
    payment.refund_payload = result
    payment.status = "refunded"
    locked.refunded_cents = amount_cents
    locked.refunded_at = datetime.now(UTC)
    locked.refund_mode = "sogecommerce"
    return result


def outcome_label(result: dict) -> str:
    """Ce que la banque a réellement fait, en clair pour l'admin.

    Annulation et remboursement ne se valent pas côté client : l'une ne
    le débite jamais, l'autre lui rend l'argent quelques jours plus
    tard. L'écran doit dire lequel des deux a eu lieu.
    """
    status = result.get("detailedStatus")
    if status == "CANCELLED":
        return "Paiement annulé avant remise en banque — le client ne sera pas débité."
    if status == "REFUND_TO_RETRY":
        return "Remboursement accepté, en attente de traitement par la banque."
    if result.get("operationType") == "CREDIT":
        return "Remboursement émis — crédité sous quelques jours ouvrés."
    return f"Opération enregistrée par la banque ({status or 'statut inconnu'})."
