"""
Tests de l'intégration Sogecommerce (mode page redirigée).

CRITIQUE : la vérification de signature HMAC protège contre les faux
IPN. Une faille ici = paiements frauduleux validés. Ces tests doivent
rester verts.
"""
import hashlib
import hmac
import json
import os

import pytest

_KEY = "TestHMACKey_regression"


@pytest.fixture
def sg(monkeypatch):
    monkeypatch.setenv("SOGECOMMERCE_HMAC_KEY", _KEY)
    from importlib import reload

    import app.core.config as cfg
    import app.integrations.payment as pay

    reload(cfg)
    reload(pay)
    return pay.SogecommercePayment()


def _signed(answer: dict) -> dict:
    ka = json.dumps(answer)
    h = hmac.new(_KEY.encode(), ka.encode(), hashlib.sha256).hexdigest()
    return {"kr-answer": ka, "kr-hash": h}


def test_ipn_valide_paid(sg):
    payload = _signed({
        "orderStatus": "PAID",
        "orderDetails": {"orderId": "TVP-OK"},
        "transactions": [{"amount": 21096}],
    })
    r = sg.verify_ipn(payload, None)
    assert r.success and r.signature_ok
    assert r.provider_ref == "TVP-OK" and r.amount_cents == 21096


def test_ipn_signature_falsifiee_rejetee(sg):
    payload = _signed({
        "orderStatus": "PAID",
        "orderDetails": {"orderId": "TVP-HACK"},
        "transactions": [{"amount": 999999}],
    })
    payload["kr-hash"] = "signature_falsifiee_par_attaquant"
    r = sg.verify_ipn(payload, None)
    assert not r.success and not r.signature_ok


def test_ipn_unpaid_non_valide(sg):
    payload = _signed({
        "orderStatus": "UNPAID",
        "orderDetails": {"orderId": "TVP-NO"},
        "transactions": [{"amount": 1000}],
    })
    r = sg.verify_ipn(payload, None)
    assert not r.success      # paiement non abouti
    assert r.signature_ok     # mais signature authentique


def test_ipn_payload_vide(sg):
    r = sg.verify_ipn({}, None)
    assert not r.success and not r.signature_ok


def test_auth_header_base64(monkeypatch):
    import base64
    from importlib import reload

    monkeypatch.setenv("SOGECOMMERCE_SHOP_ID", "12345678")
    monkeypatch.setenv("SOGECOMMERCE_API_PASSWORD", "testpassword_X")
    import app.core.config as cfg
    import app.integrations.payment as pay

    reload(cfg)
    reload(pay)
    expected = "Basic " + base64.b64encode(
        b"12345678:testpassword_X"
    ).decode()
    assert pay.SogecommercePayment()._auth_header() == expected
