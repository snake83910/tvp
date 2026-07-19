"""
Tests de l'intégration Sogecommerce (mode page redirigée).

CRITIQUE : la vérification de signature HMAC protège contre les faux
IPN. Une faille ici = paiements frauduleux validés. Ces tests doivent
rester verts.

Doc « Étape 5 : Analyser le paiement » : l'IPN est signée avec le MOT
DE PASSE API (kr-hash-key=password), le retour navigateur avec la clé
HMAC-SHA256 (kr-hash-key=sha256_hmac).
"""
import hashlib
import hmac
import json

import pytest

_PWD = "testpassword_regression"
_HMAC = "TestHMACKey_regression"


@pytest.fixture
def sg(monkeypatch):
    monkeypatch.setenv("SOGECOMMERCE_API_PASSWORD", _PWD)
    monkeypatch.setenv("SOGECOMMERCE_HMAC_KEY", _HMAC)
    from importlib import reload

    import app.core.config as cfg
    import app.integrations.payment as pay

    reload(cfg)
    reload(pay)
    return pay.SogecommercePayment()


def _signed(
    answer: dict, key: str = _PWD, hash_key: str = "password"
) -> dict:
    ka = json.dumps(answer)
    h = hmac.new(key.encode(), ka.encode(), hashlib.sha256).hexdigest()
    return {"kr-answer": ka, "kr-hash": h, "kr-hash-key": hash_key}


def test_ipn_valide_paid(sg):
    # IPN réelle : signée avec le mot de passe API
    payload = _signed({
        "orderStatus": "PAID",
        "orderDetails": {"orderId": "TVP-OK"},
        "transactions": [{"amount": 21096}],
    })
    r = sg.verify_ipn(payload, None)
    assert r.success and r.signature_ok
    assert r.provider_ref == "TVP-OK" and r.amount_cents == 21096


def test_ipn_sans_hash_key_traitee_comme_password(sg):
    # kr-hash-key absent -> clé password (valeur documentée de l'IPN)
    payload = _signed({
        "orderStatus": "PAID",
        "orderDetails": {"orderId": "TVP-OK2"},
        "transactions": [{"amount": 500}],
    })
    del payload["kr-hash-key"]
    r = sg.verify_ipn(payload, None)
    assert r.success and r.signature_ok


def test_retour_boutique_signe_cle_hmac(sg):
    payload = _signed(
        {
            "orderStatus": "PAID",
            "orderDetails": {"orderId": "TVP-NAV"},
            "transactions": [{"amount": 4656}],
        },
        key=_HMAC,
        hash_key="sha256_hmac",
    )
    r = sg.verify_ipn(payload, None)
    assert r.success and r.signature_ok


def test_mauvaise_cle_pour_le_canal_rejetee(sg):
    # Signé avec la clé HMAC mais annoncé comme "password" : refus
    payload = _signed(
        {
            "orderStatus": "PAID",
            "orderDetails": {"orderId": "TVP-MIX"},
            "transactions": [{"amount": 100}],
        },
        key=_HMAC,
        hash_key="password",
    )
    r = sg.verify_ipn(payload, None)
    assert not r.success and not r.signature_ok


def test_hash_key_inconnue_rejetee(sg):
    payload = _signed(
        {
            "orderStatus": "PAID",
            "orderDetails": {"orderId": "TVP-ALGO"},
            "transactions": [{"amount": 100}],
        },
        hash_key="md5",
    )
    r = sg.verify_ipn(payload, None)
    assert not r.success and not r.signature_ok


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
