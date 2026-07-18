"""
Tests du rattachement kr-answer <-> commande (anti-rejeu).

CRITIQUE : la signature HMAC prouve que le kr-answer vient bien de
Sogecommerce, mais pas qu'il concerne LA commande visée. Sans le
contrôle orderId + montant, le kr-answer d'une commande payée 50 €
pourrait valider n'importe quelle commande en attente.
"""
import hashlib
import hmac
import json
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.models.order import OrderStatus
from app.modules.orders.payment_router import verify_kr_answer

_KEY = "TestHMACKey_binding"


def _sign(answer: dict) -> tuple[str, str]:
    ka = json.dumps(answer)
    h = hmac.new(_KEY.encode(), ka.encode(), hashlib.sha256).hexdigest()
    return ka, h


@pytest.fixture
def soge_settings(monkeypatch):
    monkeypatch.setattr(settings, "payment_provider", "sogecommerce")
    monkeypatch.setattr(settings, "sogecommerce_hmac_key", _KEY)


def _fake_order(total_cents: int = 21096):
    order = MagicMock()
    order.id = uuid.uuid4()
    order.user_id = uuid.uuid4()
    order.status = OrderStatus.pending_payment
    order.total_ttc_cents = total_cents
    return order


def _fake_user(order):
    user = MagicMock()
    user.id = order.user_id
    return user



async def test_kr_answer_autre_commande_refuse(soge_settings):
    """kr-answer signé mais pour une AUTRE commande -> 400."""
    order = _fake_order()
    user = _fake_user(order)
    db = MagicMock()
    db.scalar = AsyncMock(return_value=order)

    ka, h = _sign({
        "orderStatus": "PAID",
        "orderDetails": {"orderId": str(uuid.uuid4())},  # autre commande
        "transactions": [{"amount": order.total_ttc_cents}],
    })
    with pytest.raises(HTTPException) as exc:
        await verify_kr_answer("CMD-2026-000001", ka, h, db=db, user=user)
    assert exc.value.status_code == 400
    assert "ne correspond pas" in exc.value.detail



async def test_kr_answer_montant_different_refuse(soge_settings):
    """Bon orderId mais montant payé != total commande -> 400."""
    order = _fake_order(total_cents=80000)
    user = _fake_user(order)
    db = MagicMock()
    db.scalar = AsyncMock(return_value=order)

    ka, h = _sign({
        "orderStatus": "PAID",
        "orderDetails": {"orderId": str(order.id)},
        "transactions": [{"amount": 5000}],  # 50 € au lieu de 800 €
    })
    with pytest.raises(HTTPException) as exc:
        await verify_kr_answer("CMD-2026-000001", ka, h, db=db, user=user)
    assert exc.value.status_code == 400
    assert "Montant" in exc.value.detail



async def test_kr_answer_signature_invalide_refuse(soge_settings):
    """Signature falsifiée -> 400, avant même de toucher la DB."""
    order = _fake_order()
    user = _fake_user(order)
    db = MagicMock()
    db.scalar = AsyncMock(return_value=order)

    ka, _ = _sign({"orderStatus": "PAID"})
    with pytest.raises(HTTPException) as exc:
        await verify_kr_answer(
            "CMD-2026-000001", ka, "signature_falsifiee", db=db, user=user
        )
    assert exc.value.status_code == 400
    db.scalar.assert_not_called()



async def test_kr_answer_valide_accepte(soge_settings):
    """Cas nominal : bon orderId, bon montant, PAID -> commande payée."""
    order = _fake_order()
    user = _fake_user(order)
    payment = MagicMock()
    db = MagicMock()
    # Appels successifs : commande, paiement, order_full (None = pas d'email)
    db.scalar = AsyncMock(side_effect=[order, payment, None])
    db.commit = AsyncMock()
    seq = MagicMock()
    seq.scalar.return_value = 42
    db.execute = AsyncMock(return_value=seq)

    ka, h = _sign({
        "orderStatus": "PAID",
        "orderDetails": {"orderId": str(order.id)},
        "transactions": [{"amount": order.total_ttc_cents}],
    })
    result = await verify_kr_answer("CMD-2026-000001", ka, h, db=db, user=user)
    assert result["status"] == "ok"
    order.transition_to.assert_called_once_with(OrderStatus.paid)
    assert payment.status == "captured"
