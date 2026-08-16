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

3. **La transaction est relue chez la banque quand c'est possible.**
   `Order/Get` donne l'identifiant du débit à jour. Mais ce web service
   dépend du droit `WS_REST_GET`, que toutes les boutiques n'ont pas
   (`PSP_100 : rest API option not enabled`). On retombe alors sur
   l'identifiant conservé dans l'IPN du paiement : il ne change jamais,
   et c'est `CancelOrRefund` qui reste l'autorité — si la transaction
   n'est plus remboursable, elle refuse, et on n'a rien marqué.

   Refuser tout remboursement faute de lecture serait le pire des deux
   mondes : on saurait rembourser, mais on s'en priverait au motif qu'on
   ne sait pas relire.

État du contrat au 16/08/2026 : la boutique 62343537 n'a **ni**
`WS_REST_GET` **ni** `WS_REST_CANCEL`. Le remboursement par API est donc
inopérant tant que Société Générale n'ouvre pas ces options — ce code
reste en place, testé, et se réactive tout seul le jour où elles le
seront. En attendant, le premier refus bascule l'écran sur la
déclaration manuelle plutôt que de faire échouer un clic à chaque fois.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.order import Order, OrderStatus, Payment

#: États de transaction sur lesquels un remboursement a un sens. Les
#: autres (REFUSED, ERROR…) n'ont jamais débité le client.
_REFUNDABLE = {"CAPTURED", "AUTHORISED", "AUTHORISED_TO_VALIDATE", "ACCEPTED"}


class RefundError(RuntimeError):
    """Le remboursement n'a pas eu lieu. La commande n'a pas bougé."""


#: Message rendu quand l'option n'est pas ouverte sur le contrat. Il dit
#: quoi faire maintenant ET comment supprimer le problème — un admin ne
#: doit pas avoir à traduire un code PSP.
OPTION_ABSENTE = (
    "Le remboursement par API n'est pas activé sur votre contrat "
    "Sogecommerce (option WS_REST_CANCEL). Remboursez au Back Office, "
    "puis cochez « J'ai déjà remboursé » pour l'enregistrer ici."
)

#: Durée pendant laquelle on cesse de proposer le remboursement
#: automatique après un refus d'option. Assez long pour ne pas relancer
#: la banque à chaque affichage, assez court pour que l'activation de
#: l'option soit prise en compte sans redéploiement.
_DISABLED_HOURS = 6

#: Mémoire de processus, volontairement pas Redis : `api_available()`
#: est appelée depuis du code synchrone (sérialisation d'une commande),
#: et l'information n'a pas besoin d'être partagée — chaque worker
#: l'apprend au premier refus, et l'oublie au redémarrage.
_disabled_until: datetime | None = None


def note_api_disabled() -> None:
    """La banque vient de répondre « option non activée ». Inutile de
    proposer le bouton pendant quelques heures."""
    global _disabled_until
    _disabled_until = datetime.now(UTC) + timedelta(hours=_DISABLED_HOURS)


def is_option_error(message: str) -> bool:
    """Reconnaît un refus d'OPTION, à distinguer d'un refus métier.

    `PSP_100` signifie « ce web service n'est pas ouvert sur la
    boutique » — aucune insistance ne le fera marcher, et le message
    doit orienter vers le Back Office plutôt que vers un réessai.
    """
    haystack = (message or "").upper()
    return "PSP_100" in haystack or "WS_REST_CANCEL" in haystack


def api_available() -> bool:
    """Le remboursement automatique est-il possible sur cette instance ?

    Faux en paiement simulé (aucune banque), si les clés REST manquent,
    ou si la banque a récemment répondu que l'option n'est pas ouverte.
    Dans tous ces cas l'admin bascule sur la déclaration manuelle, qui
    reste explicitement présentée comme telle.
    """
    if _disabled_until and datetime.now(UTC) < _disabled_until:
        return False
    return bool(
        settings.payment_provider == "sogecommerce"
        and settings.sogecommerce_shop_id
        and settings.sogecommerce_api_password
    )


def pick_debit_transaction(
    transactions: list[dict], assume_debit: bool = False
) -> dict | None:
    """Trouve LE débit à rembourser parmi les transactions d'une commande.

    Une commande peut en porter plusieurs : tentatives refusées, et
    éventuels crédits déjà émis. Rembourser un crédit ou une tentative
    refusée n'aurait aucun sens — on ne retient que le débit accepté.

    `assume_debit` sert pour les IPN archivés, où `operationType` peut
    manquer : un IPN de paiement ne notifie jamais autre chose qu'un
    débit, exiger le champ ferait rater la seule piste disponible.
    """
    for t in transactions or []:
        op = t.get("operationType")
        if op != "DEBIT" and not (assume_debit and op is None):
            continue
        if t.get("detailedStatus") in _REFUNDABLE and t.get("uuid"):
            return t
    return None


async def find_debit_transaction(soge, payment: Payment) -> dict | None:
    """Retrouve le débit à rembourser. Deux sources, dans cet ordre.

    1. `Order/Get` — la banque, à jour. Indisponible si la boutique n'a
       pas le droit `WS_REST_GET` (`PSP_100 : rest API option not
       enabled`), ce qui est le cas par défaut sur beaucoup de contrats.
    2. L'IPN archivé au moment du paiement. L'uuid d'une transaction ne
       change jamais : une copie de trois semaines désigne toujours le
       bon débit. Ce qui a pu changer, c'est son état — et c'est
       précisément ce que `CancelOrRefund` vérifiera avant d'agir.

    Rend None si aucune des deux ne donne de transaction exploitable ;
    l'appelant bascule alors sur la déclaration manuelle.
    """
    try:
        answer = await soge.get_order_status(payment.provider_ref)
    except Exception:
        # Droit REST absent, ou API momentanément muette : on ne renonce
        # pas pour autant, on a peut-être déjà ce qu'il faut sous la main.
        answer = None

    if answer:
        found = pick_debit_transaction(answer.get("transactions") or [])
        if found:
            return found

    stored = payment.ipn_payload or {}
    return pick_debit_transaction(
        stored.get("transactions") or [], assume_debit=True
    )


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
    debit = await find_debit_transaction(soge, payment)
    if debit is None:
        raise RefundError(
            "Impossible de retrouver la transaction bancaire de cette "
            "commande. Remboursez au Back Office Sogecommerce, puis "
            "enregistrez-le ici en cochant « J'ai déjà remboursé »."
        )

    # Le montant connu peut dater de l'IPN. On ne s'en sert que comme
    # borne haute évidente : la banque revérifiera de toute façon.
    known = int(debit.get("amount") or 0)
    if known and amount_cents > known:
        raise RefundError(
            f"Montant supérieur à la transaction débitée "
            f"({known / 100:.2f} €)."
        )

    try:
        result = await soge.cancel_or_refund(
            debit["uuid"],
            amount_cents,
            currency=debit.get("currency") or order.currency or "EUR",
            comment=comment or f"Remboursement commande {order.order_number}",
        )
    except Exception as exc:
        if is_option_error(str(exc)):
            # Option absente du contrat : ce n'est pas un incident, c'est
            # une fonctionnalité fermée. On arrête de la proposer, et on
            # dit à l'admin quoi faire à la place.
            note_api_disabled()
            raise RefundError(OPTION_ABSENTE) from exc
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
