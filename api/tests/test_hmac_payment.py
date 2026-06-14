"""Test du HMAC kr-answer Sogecommerce."""
import hashlib
import hmac
import json


def _sign(secret: str, body: str) -> str:
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def test_hmac_compare_digest_matches():
    """Sanity check : la signature qu'on calcule = celle qu'on attendrait."""
    secret = "TRdDRPHZ2ekWXDiSQhjFHvHzNa4qJQzvN5i0BZkayLI23"
    body = json.dumps({"orderStatus": "PAID"})
    sig = _sign(secret, body)
    assert hmac.compare_digest(sig, _sign(secret, body))


def test_hmac_rejects_tampered_body():
    """Une seule modification du body change la signature."""
    secret = "secret"
    sig = _sign(secret, "{}")
    assert not hmac.compare_digest(sig, _sign(secret, '{"x":1}'))


def test_hmac_rejects_wrong_secret():
    """Mauvaise clé HMAC = signature différente."""
    body = "{}"
    sig_a = _sign("secret_a", body)
    sig_b = _sign("secret_b", body)
    assert not hmac.compare_digest(sig_a, sig_b)
