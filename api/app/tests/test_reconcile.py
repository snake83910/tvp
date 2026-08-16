"""
Tests de la réconciliation bancaire.

CRITIQUE : c'est le module qui empêche d'annuler la commande d'un client
déjà débité. Un IPN peut se perdre (nginx qui redémarre, coupure réseau
au moment du webhook) ; la commande reste alors en `pending_payment`
alors que l'argent est parti. Avant ce module, la relance l'annulait au
bout de sept jours.

Deux garanties doivent rester vertes :

  * le verdict `unavailable` — « je ne sais pas » — n'autorise JAMAIS
    l'annulation ;
  * un montant encaissé différent du total ne valide pas la commande,
    et ne l'annule pas non plus : de l'argent a bougé, un humain doit
    regarder.

Lancer : pytest app/tests/test_reconcile.py
"""
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.models.order import OrderStatus
from app.modules.orders import reconcile


def _order(status=OrderStatus.pending_payment, total=11976):
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        order_number="CMD-2026-000001",
        status=status,
        total_ttc_cents=total,
        paid_at=None,
        invoice_number=None,
        payment_checked_at=None,
        payment_check_result=None,
        garage_id=None,
        transition_to=lambda target: None,
    )


def _payment(ref="pmt-123"):
    return SimpleNamespace(
        provider_ref=ref, status="initialised", ipn_payload={}, ipn_signature_ok=None
    )


def _db(payment=None):
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=payment)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(scalar=lambda: 42)
    )
    db.get = AsyncMock(return_value=None)
    return db


def _soge(answer=None, boom=False):
    """Fabrique la classe SogecommercePayment vue par le module."""
    client = AsyncMock()
    if boom:
        client.get_order_status = AsyncMock(side_effect=RuntimeError("PSP_100"))
    else:
        client.get_order_status = AsyncMock(return_value=answer)
    return lambda: client


@pytest.mark.asyncio
async def test_paiement_simule_rien_a_verifier():
    """En mode simulé il n'y a pas de banque : verdict `skipped`, qui
    autorise l'annulation — sinon plus rien ne s'annulerait en dev."""
    order, db = _order(), _db()
    with patch.object(reconcile.settings, "payment_provider", "simulated"):
        verdict = await reconcile.reconcile_order(db, order)
    assert verdict == reconcile.SKIPPED
    assert verdict in reconcile.SAFE_TO_CANCEL
    assert order.payment_check_result == reconcile.SKIPPED


@pytest.mark.asyncio
async def test_aucun_paiement_initie_est_un_vrai_abandon():
    order, db = _order(), _db(payment=None)
    with patch.object(reconcile.settings, "payment_provider", "sogecommerce"):
        verdict = await reconcile.reconcile_order(db, order)
    assert verdict == reconcile.SKIPPED
    assert verdict in reconcile.SAFE_TO_CANCEL


@pytest.mark.asyncio
async def test_banque_injoignable_interdit_l_annulation():
    """LE test qui protège l'argent du client : ne pas savoir n'autorise
    rien."""
    order, db = _order(), _db(payment=_payment())
    with patch.object(reconcile.settings, "payment_provider", "sogecommerce"), \
         patch("app.integrations.payment.SogecommercePayment", _soge(boom=True)):
        verdict = await reconcile.reconcile_order(db, order)

    assert verdict == reconcile.UNAVAILABLE
    assert verdict not in reconcile.SAFE_TO_CANCEL
    assert order.status == OrderStatus.pending_payment


@pytest.mark.asyncio
async def test_banque_confirme_non_payee():
    order, db = _order(), _db(payment=_payment())
    with patch.object(reconcile.settings, "payment_provider", "sogecommerce"), \
         patch(
             "app.integrations.payment.SogecommercePayment",
             _soge({"orderStatus": "UNPAID"}),
         ):
        verdict = await reconcile.reconcile_order(db, order)

    assert verdict == reconcile.NOT_PAID
    assert verdict in reconcile.SAFE_TO_CANCEL
    assert order.status == OrderStatus.pending_payment


@pytest.mark.asyncio
async def test_montant_different_ne_valide_ni_n_annule():
    order = _order(total=11976)
    payment = _payment()
    db = _db(payment=payment)
    with patch.object(reconcile.settings, "payment_provider", "sogecommerce"), \
         patch(
             "app.integrations.payment.SogecommercePayment",
             _soge({"orderStatus": "PAID", "transactions": [{"amount": 5000}]}),
         ):
        verdict = await reconcile.reconcile_order(db, order)

    assert verdict == reconcile.AMOUNT_MISMATCH
    assert verdict not in reconcile.SAFE_TO_CANCEL
    assert payment.status == "amount_mismatch"
    assert order.status == OrderStatus.pending_payment


@pytest.mark.asyncio
async def test_paiement_retrouve_valide_la_commande():
    order = _order(total=11976)
    payment = _payment()
    db = _db(payment=payment)
    passages = []
    order.transition_to = lambda target: passages.append(target)

    with patch.object(reconcile.settings, "payment_provider", "sogecommerce"), \
         patch(
             "app.integrations.payment.SogecommercePayment",
             _soge({"orderStatus": "PAID", "transactions": [{"amount": 11976}]}),
         ), \
         patch.object(reconcile, "_notify_paid", AsyncMock()) as notif:
        verdict = await reconcile.reconcile_order(db, order)

    assert verdict == reconcile.PAID
    assert passages == [OrderStatus.paid]
    assert payment.status == "captured"
    assert order.invoice_number == 42
    assert order.paid_at is not None
    # Le client reçoit la même confirmation que par l'IPN : il ne doit
    # pas pouvoir deviner que sa commande a été validée par rattrapage.
    notif.assert_awaited_once()


@pytest.mark.asyncio
async def test_commande_deja_payee_ne_repasse_pas():
    """Le rattrapage ne doit pas re-consommer un numéro de facture ni
    renvoyer l'email de confirmation."""
    order = _order(status=OrderStatus.paid)
    db = _db(payment=_payment())
    verdict = await reconcile.reconcile_order(db, order)
    assert verdict == reconcile.ALREADY_PROCESSED
    assert order.invoice_number is None


def test_seuls_deux_verdicts_autorisent_l_annulation():
    """Garde-fou de conception : ajouter un verdict ne doit pas élargir
    par inadvertance les cas d'annulation automatique."""
    assert reconcile.SAFE_TO_CANCEL == {reconcile.NOT_PAID, reconcile.SKIPPED}
