"""
Tests du remboursement.

Deux chemins, et la distinction est le cœur du sujet :

  * **API** — le site appelle `Transaction/CancelOrRefund`. La banque
    répond, on archive sa réponse, le statut correspond à un mouvement
    réel.
  * **Déclaration manuelle** — un admin affirme avoir remboursé au Back
    Office. Aucune preuve. Repli assumé quand les clés REST manquent,
    marqué comme tel (`refund_mode`).

La règle qui ne doit jamais céder : **on ne marque jamais une commande
remboursée sans réponse claire de la banque**. Un remboursement supposé
est pire qu'un remboursement refusé — le client ne réclame pas ce qu'il
croit avoir reçu.

Lancer : pytest app/tests/test_refund.py
"""
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.models.order import OrderStatus
from app.modules.admin.router import update_status
from app.modules.orders import refund
from app.schemas.order import StatusUpdateIn

TOTAL = 11976  # 119,76 €


def _order():
    o = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        order_number="CMD-2026-000001",
        status=OrderStatus.paid,
        total_ttc_cents=TOTAL,
        currency="EUR",
        refunded_cents=None,
        refunded_at=None,
        refund_mode=None,
        items=[],
        created_at=None,
        paid_at=None,
        delivery_mode="home",
        shipping_address={},
        billing_address={},
        garage_snapshot={},
        mounting_at=None,
        mounting_note=None,
        invoice_number=1,
        promo_code=None,
        discount_ttc_cents=0,
        tracking_number=None,
        carrier=None,
        tracking_url=None,
        shipping_ht_cents=0,
        shipping_vat_cents=0,
        total_ht_cents=TOTAL,
        total_vat_cents=0,
        admin_note=None,
        payment_check_result=None,
        payment_checked_at=None,
    )
    o.transition_to = lambda target: setattr(o, "status", target)
    return o


def _user():
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="client@example.com",
        first_name="Camille",
        last_name="Durand",
    )


def _payment(ipn=None):
    return SimpleNamespace(
        provider_ref="CMD-2026-000001",
        status="captured",
        refund_ref=None,
        refund_payload={},
        ipn_payload=ipn or {},
    )


def _db(order, user, payment=None):
    db = AsyncMock()
    # `_load_order` puis, côté service, le verrou et le paiement.
    db.scalar = AsyncMock(side_effect=lambda *a, **k: order)
    db.get = AsyncMock(return_value=user)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db._payment = payment
    return db


async def _patch_status(order, user, db=None, **payload):
    db = db or _db(order, user)
    data = StatusUpdateIn(status="refunded", **payload)
    request = SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1"))
    with patch("app.modules.admin.router.send_order_refunded") as mail, \
         patch("app.modules.admin.router.audit", AsyncMock()) as trace, \
         patch("app.modules.admin.router._order_to_detail", lambda o, u: None):
        await update_status(order.order_number, data, request, db=db, admin=user)
    return mail, trace


# ── Contrôles de montant, communs aux deux chemins ────────────────

@pytest.mark.asyncio
async def test_montant_obligatoire():
    order, user = _order(), _user()
    with pytest.raises(HTTPException) as exc:
        await _patch_status(order, user, refund_manual=True)

    assert exc.value.status_code == 422
    assert "montant" in str(exc.value.detail).lower()
    assert order.status == OrderStatus.paid


@pytest.mark.asyncio
async def test_montant_superieur_au_total_refuse():
    order, user = _order(), _user()
    with pytest.raises(HTTPException) as exc:
        await _patch_status(
            order, user, refund_cents=TOTAL + 1, refund_manual=True
        )
    assert exc.value.status_code == 422
    assert order.status == OrderStatus.paid


@pytest.mark.asyncio
async def test_montant_nul_ou_negatif_refuse():
    for montant in (0, -500):
        order, user = _order(), _user()
        with pytest.raises(HTTPException) as exc:
            await _patch_status(
                order, user, refund_cents=montant, refund_manual=True
            )
        assert exc.value.status_code == 422
        assert order.status == OrderStatus.paid


# ── Déclaration manuelle ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_declaration_manuelle_marquee_comme_telle():
    """Sans preuve bancaire, la commande doit le dire."""
    order, user = _order(), _user()
    mail, trace = await _patch_status(
        order, user, refund_cents=TOTAL, refund_manual=True,
        cancel_reason="Geste commercial",
    )

    assert order.status == OrderStatus.refunded
    assert order.refunded_cents == TOTAL
    assert order.refunded_at is not None
    assert order.refund_mode == "manual"
    mail.assert_called_once_with(order, user, TOTAL, "Geste commercial")
    payload = trace.await_args.kwargs["payload"]
    assert payload["refund_cents"] == TOTAL
    assert payload["refund_mode"] == "manual"
    # Pas de référence bancaire : il n'y a pas eu d'appel.
    assert payload["refund_ref"] is None


@pytest.mark.asyncio
async def test_sans_cles_rest_le_manuel_est_le_seul_chemin():
    """Instance sans Sogecommerce configuré : on ne bloque pas l'admin,
    mais on n'invente pas non plus une preuve."""
    order, user = _order(), _user()
    with patch.object(refund, "api_available", lambda: False):
        await _patch_status(order, user, refund_cents=TOTAL)
    assert order.refund_mode == "manual"
    assert order.status == OrderStatus.refunded


# ── Remboursement exécuté par la banque ───────────────────────────

@pytest.mark.asyncio
async def test_appel_banque_reussi():
    order, user = _order(), _user()
    resultat = {
        "uuid": "txn-credit-999",
        "detailedStatus": "CAPTURED",
        "operationType": "CREDIT",
        "amount": TOTAL,
    }

    async def fake_refund(_db, o, cents, comment=None):
        o.refunded_cents = cents
        o.refund_mode = "sogecommerce"
        from datetime import UTC, datetime
        o.refunded_at = datetime.now(UTC)
        return resultat

    with patch.object(refund, "api_available", lambda: True), \
         patch.object(refund, "refund_order", fake_refund):
        mail, trace = await _patch_status(order, user, refund_cents=TOTAL)

    assert order.status == OrderStatus.refunded
    assert order.refund_mode == "sogecommerce"
    payload = trace.await_args.kwargs["payload"]
    # La référence bancaire est tracée : c'est elle qu'on cherchera au
    # Back Office le jour d'une réclamation.
    assert payload["refund_ref"] == "txn-credit-999"
    assert payload["refund_status"] == "CAPTURED"
    mail.assert_called_once()


@pytest.mark.asyncio
async def test_appel_banque_refuse_ne_change_rien():
    """LE test à ne jamais laisser rougir : pas d'argent rendu, pas de
    changement de statut."""
    order, user = _order(), _user()

    async def boom(_db, o, cents, comment=None):
        raise refund.RefundError("PSP_099 transaction non remboursable")

    with patch.object(refund, "api_available", lambda: True), \
         patch.object(refund, "refund_order", boom), \
         pytest.raises(HTTPException) as exc:
        await _patch_status(order, user, refund_cents=TOTAL)

    assert exc.value.status_code == 422
    assert "PSP_099" in str(exc.value.detail)
    assert order.status == OrderStatus.paid
    assert order.refunded_cents is None
    assert order.refund_mode is None


@pytest.mark.asyncio
async def test_les_autres_transitions_n_exigent_pas_de_montant():
    """La contrainte ne doit pas déborder sur le parcours normal."""
    order, user = _order(), _user()
    db = _db(order, user)
    data = StatusUpdateIn(status="sent_to_supplier")
    request = SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1"))

    with patch("app.modules.admin.router.audit", AsyncMock()), \
         patch("app.modules.admin.router._order_to_detail", lambda o, u: None):
        await update_status(order.order_number, data, request, db=db, admin=user)

    assert order.status == OrderStatus.sent_to_supplier
    assert order.refunded_cents is None


# ── Le service lui-même ───────────────────────────────────────────

def _service_db(order, payment):
    db = AsyncMock()
    # 1er scalar : le verrou sur la commande. 2e : le paiement.
    db.scalar = AsyncMock(side_effect=[order, payment])
    return db


def _soge(order_answer=None, refund_answer=None, refund_boom=None,
          get_boom=None):
    client = AsyncMock()
    if get_boom:
        client.get_order_status = AsyncMock(side_effect=RuntimeError(get_boom))
    else:
        client.get_order_status = AsyncMock(return_value=order_answer or {})
    if refund_boom:
        client.cancel_or_refund = AsyncMock(side_effect=RuntimeError(refund_boom))
    else:
        client.cancel_or_refund = AsyncMock(return_value=refund_answer or {})
    return lambda: client, client


DEBIT = {
    "uuid": "txn-debit-1",
    "operationType": "DEBIT",
    "detailedStatus": "CAPTURED",
    "amount": TOTAL,
    "currency": "EUR",
}


@pytest.mark.asyncio
async def test_service_rembourse_et_archive_la_preuve():
    order, payment = _order(), _payment()
    db = _service_db(order, payment)
    credit = {"uuid": "txn-credit-1", "operationType": "CREDIT", "detailedStatus": "CAPTURED"}
    factory, client = _soge({"transactions": [DEBIT]}, credit)

    with patch.object(refund, "api_available", lambda: True), \
         patch("app.integrations.payment.SogecommercePayment", factory):
        result = await refund.refund_order(db, order, TOTAL, comment="Rupture")

    assert result == credit
    assert payment.refund_ref == "txn-credit-1"
    assert payment.refund_payload == credit
    assert payment.status == "refunded"
    assert order.refunded_cents == TOTAL
    assert order.refund_mode == "sogecommerce"
    # Montant et devise viennent de la transaction lue chez la banque,
    # pas d'une copie stockée.
    client.cancel_or_refund.assert_awaited_once()
    assert client.cancel_or_refund.await_args.args[0] == "txn-debit-1"


@pytest.mark.asyncio
async def test_service_refuse_un_second_remboursement():
    """Deux clics ne doivent pas produire deux crédits."""
    order, payment = _order(), _payment()
    order.refunded_cents = 5000
    db = _service_db(order, payment)
    factory, client = _soge({"transactions": [DEBIT]}, {})

    with patch.object(refund, "api_available", lambda: True), \
         patch("app.integrations.payment.SogecommercePayment", factory):
        with pytest.raises(refund.RefundError, match="déjà"):
            await refund.refund_order(db, order, 5000)

    client.cancel_or_refund.assert_not_awaited()


@pytest.mark.asyncio
async def test_service_sans_transaction_debitee():
    """Une tentative refusée n'a jamais débité le client : la rembourser
    créerait un crédit sans débit correspondant."""
    order, payment = _order(), _payment()
    db = _service_db(order, payment)
    refuse = {"uuid": "x", "operationType": "DEBIT", "detailedStatus": "REFUSED"}
    factory, client = _soge({"transactions": [refuse]}, {})

    with patch.object(refund, "api_available", lambda: True), \
         patch("app.integrations.payment.SogecommercePayment", factory):
        with pytest.raises(refund.RefundError, match="Impossible de retrouver"):
            await refund.refund_order(db, order, TOTAL)

    client.cancel_or_refund.assert_not_awaited()


@pytest.mark.asyncio
async def test_service_echec_banque_ne_touche_a_rien():
    order, payment = _order(), _payment()
    db = _service_db(order, payment)
    factory, _ = _soge({"transactions": [DEBIT]}, refund_boom="PSP_050 refusé")

    with patch.object(refund, "api_available", lambda: True), \
         patch("app.integrations.payment.SogecommercePayment", factory):
        with pytest.raises(refund.RefundError, match="PSP_050"):
            await refund.refund_order(db, order, TOTAL)

    assert order.refunded_cents is None
    assert order.refund_mode is None
    assert payment.refund_ref is None
    assert payment.status == "captured"


@pytest.mark.asyncio
async def test_service_montant_superieur_a_la_transaction():
    order, payment = _order(), _payment()
    db = _service_db(order, payment)
    petit = {**DEBIT, "amount": 5000}
    factory, client = _soge({"transactions": [petit]}, {})

    with patch.object(refund, "api_available", lambda: True), \
         patch("app.integrations.payment.SogecommercePayment", factory):
        with pytest.raises(refund.RefundError, match="supérieur"):
            await refund.refund_order(db, order, TOTAL)

    client.cancel_or_refund.assert_not_awaited()


PSP_100 = (
    "Order/Get échoué : {'errorCode': 'PSP_100', 'errorMessage': "
    "'rest API option not enabled'}"
)


@pytest.mark.asyncio
async def test_repli_sur_l_ipn_quand_order_get_est_desactive():
    """Cas réel : la boutique n'a pas le droit WS_REST_GET. L'uuid de la
    transaction est pourtant déjà chez nous, dans l'IPN du paiement —
    refuser de rembourser reviendrait à se priver d'une opération qu'on
    sait faire."""
    order = _order()
    payment = _payment(ipn={"transactions": [{
        "uuid": "txn-ipn-7",
        "detailedStatus": "AUTHORISED",
        "amount": TOTAL,
        "currency": "EUR",
    }]})
    db = _service_db(order, payment)
    credit = {"uuid": "txn-credit-7", "operationType": "CREDIT"}
    factory, client = _soge(refund_answer=credit, get_boom=PSP_100)

    with patch.object(refund, "api_available", lambda: True),          patch("app.integrations.payment.SogecommercePayment", factory):
        result = await refund.refund_order(db, order, TOTAL)

    assert result == credit
    # Le remboursement porte bien sur la transaction retrouvée dans l'IPN.
    assert client.cancel_or_refund.await_args.args[0] == "txn-ipn-7"
    assert order.refund_mode == "sogecommerce"


@pytest.mark.asyncio
async def test_ni_order_get_ni_ipn_renvoie_vers_le_manuel():
    """Quand aucune piste ne mène à la transaction, le message doit dire
    quoi faire — pas seulement que ça a échoué."""
    order, payment = _order(), _payment(ipn={})
    db = _service_db(order, payment)
    factory, client = _soge(get_boom=PSP_100)

    with patch.object(refund, "api_available", lambda: True),          patch("app.integrations.payment.SogecommercePayment", factory):
        with pytest.raises(refund.RefundError, match="déjà remboursé"):
            await refund.refund_order(db, order, TOTAL)

    client.cancel_or_refund.assert_not_awaited()
    assert order.refunded_cents is None


@pytest.mark.asyncio
async def test_order_get_prioritaire_sur_l_ipn():
    """Quand la banque répond, c'est elle qui fait foi : l'IPN archivé
    n'est qu'un filet."""
    order = _order()
    payment = _payment(ipn={"transactions": [{
        "uuid": "txn-vieux", "detailedStatus": "AUTHORISED", "amount": TOTAL,
    }]})
    db = _service_db(order, payment)
    factory, client = _soge({"transactions": [DEBIT]}, {"uuid": "c"})

    with patch.object(refund, "api_available", lambda: True),          patch("app.integrations.payment.SogecommercePayment", factory):
        await refund.refund_order(db, order, TOTAL)

    assert client.cancel_or_refund.await_args.args[0] == "txn-debit-1"


def test_ipn_sans_operation_type_reste_exploitable():
    """Un IPN de paiement ne notifie jamais autre chose qu'un débit :
    exiger le champ ferait rater la seule piste disponible."""
    ipn = [{"uuid": "u", "detailedStatus": "AUTHORISED"}]
    assert refund.pick_debit_transaction(ipn) is None
    assert refund.pick_debit_transaction(ipn, assume_debit=True)["uuid"] == "u"
    # Mais un crédit explicite reste exclu, même en mode indulgent.
    credit = [{"uuid": "c", "operationType": "CREDIT", "detailedStatus": "CAPTURED"}]
    assert refund.pick_debit_transaction(credit, assume_debit=True) is None


def test_choix_de_la_transaction_a_rembourser():
    """Parmi plusieurs transactions, seul le débit accepté est
    remboursable : ni un crédit déjà émis, ni une tentative refusée."""
    credit = {"uuid": "c", "operationType": "CREDIT", "detailedStatus": "CAPTURED"}
    refuse = {"uuid": "r", "operationType": "DEBIT", "detailedStatus": "REFUSED"}
    assert refund.pick_debit_transaction([credit, refuse, DEBIT])["uuid"] == "txn-debit-1"
    assert refund.pick_debit_transaction([credit, refuse]) is None
    assert refund.pick_debit_transaction([]) is None


def test_libelle_distingue_annulation_et_remboursement():
    """Le client n'est pas débité dans un cas, remboursé dans l'autre :
    l'admin doit savoir lequel a eu lieu."""
    annule = refund.outcome_label({"detailedStatus": "CANCELLED"})
    rembourse = refund.outcome_label(
        {"detailedStatus": "CAPTURED", "operationType": "CREDIT"}
    )
    assert "annulé" in annule.lower()
    assert "pas débité" in annule.lower()
    assert "rembours" in rembourse.lower()
    assert annule != rembourse
