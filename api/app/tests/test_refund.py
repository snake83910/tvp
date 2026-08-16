"""
Tests du remboursement déclaré par l'admin.

Le site n'a pas de contrat de remboursement par API : l'opération se
fait au back office de la banque. « Remboursée » n'est donc qu'une
DÉCLARATION — et une déclaration sans montant n'est pas vérifiable. Six
mois plus tard, face à un client qui affirme n'avoir rien reçu, un
statut seul ne prouve rien.

D'où les trois règles testées ici : montant obligatoire, montant borné
au total de la commande, et client prévenu.

Lancer : pytest app/tests/test_refund.py
"""
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.models.order import OrderStatus
from app.modules.admin.router import update_status
from app.schemas.order import StatusUpdateIn

TOTAL = 11976  # 119,76 €


def _order():
    o = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        order_number="CMD-2026-000001",
        status=OrderStatus.paid,
        total_ttc_cents=TOTAL,
        refunded_cents=None,
        refunded_at=None,
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


def _db(order, user):
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=order)
    db.get = AsyncMock(return_value=user)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    return db


async def _patch_status(order, user, **payload):
    db = _db(order, user)
    data = StatusUpdateIn(status="refunded", **payload)
    request = SimpleNamespace(
        headers={}, client=SimpleNamespace(host="127.0.0.1")
    )
    with patch("app.modules.admin.router.send_order_refunded") as mail, \
         patch("app.modules.admin.router.audit", AsyncMock()) as trace, \
         patch("app.modules.admin.router._order_to_detail", lambda o, u: None):
        await update_status(
            order.order_number, data, request, db=db, admin=user
        )
    return mail, trace


@pytest.mark.asyncio
async def test_montant_obligatoire():
    order, user = _order(), _user()
    with pytest.raises(HTTPException) as exc:
        await _patch_status(order, user)

    assert exc.value.status_code == 422
    assert "montant" in str(exc.value.detail).lower()
    # Et surtout : la commande n'a PAS changé d'état.
    assert order.status == OrderStatus.paid


@pytest.mark.asyncio
async def test_montant_superieur_au_total_refuse():
    order, user = _order(), _user()
    with pytest.raises(HTTPException) as exc:
        await _patch_status(order, user, refund_cents=TOTAL + 1)

    assert exc.value.status_code == 422
    assert order.status == OrderStatus.paid


@pytest.mark.asyncio
async def test_montant_nul_ou_negatif_refuse():
    for montant in (0, -500):
        order, user = _order(), _user()
        with pytest.raises(HTTPException) as exc:
            await _patch_status(order, user, refund_cents=montant)
        assert exc.value.status_code == 422
        assert order.status == OrderStatus.paid


@pytest.mark.asyncio
async def test_remboursement_total_trace_et_notifie():
    order, user = _order(), _user()
    mail, trace = await _patch_status(
        order, user, refund_cents=TOTAL, cancel_reason="Rupture fournisseur"
    )

    assert order.status == OrderStatus.refunded
    assert order.refunded_cents == TOTAL
    assert order.refunded_at is not None
    # Le client est prévenu — il était le seul à ne pas l'être.
    mail.assert_called_once_with(order, user, TOTAL, "Rupture fournisseur")
    # Le montant est dans l'audit : c'est lui qui rend la déclaration
    # vérifiable après coup.
    assert trace.await_args.kwargs["payload"]["refund_cents"] == TOTAL


@pytest.mark.asyncio
async def test_remboursement_partiel_accepte():
    order, user = _order(), _user()
    mail, _ = await _patch_status(order, user, refund_cents=5000)

    assert order.refunded_cents == 5000
    assert order.status == OrderStatus.refunded
    mail.assert_called_once()


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
