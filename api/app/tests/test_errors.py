"""
Contrat du format d'erreur de l'API.

Le `code` est une API publique : le frontend branche du comportement
dessus (rouvrir la connexion sur `email_taken`, recharger les créneaux
sur `slot_taken`). Ces tests existent pour qu'un refactor ne fasse pas
disparaître silencieusement le champ, ni ne change sa forme.

Lancer : pytest app/tests/test_errors.py
"""
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.errors import AppError, ErrorCode, install_error_handlers


class Body(BaseModel):
    age: int


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    install_error_handlers(app)

    @app.get("/app-error")
    def _app_error():
        raise AppError(
            status_code=409,
            code=ErrorCode.STOCK_INSUFFICIENT,
            message="Plus qu'un pneu",
            details={"available": 1},
        )

    @app.get("/http-error")
    def _http_error():
        raise HTTPException(status_code=404, detail="Garage introuvable")

    @app.get("/legacy-dict-error")
    def _legacy():
        # Ancien style : detail sous forme d'objet. Le handler doit le
        # normaliser plutôt que de le laisser filer en « [object Object] ».
        raise HTTPException(
            status_code=409, detail={"message": "Conflit", "available": 2}
        )

    @app.post("/validated")
    def _validated(_: Body):
        return {"ok": True}

    @app.get("/boom")
    def _boom():
        raise RuntimeError("secret interne : mot de passe = hunter2")

    return TestClient(app, raise_server_exceptions=False)


def _envelope(payload: dict) -> None:
    """Tout corps d'erreur porte les quatre mêmes clés."""
    assert set(payload) == {"code", "message", "details", "detail"}
    assert isinstance(payload["code"], str) and payload["code"]
    assert isinstance(payload["message"], str) and payload["message"]
    assert isinstance(payload["details"], dict)
    # `detail` (rétro-compatibilité) porte toujours le même texte.
    assert payload["detail"] == payload["message"]


def test_app_error_porte_son_code_et_son_contexte(client):
    r = client.get("/app-error")
    assert r.status_code == 409
    body = r.json()
    _envelope(body)
    assert body["code"] == ErrorCode.STOCK_INSUFFICIENT
    assert body["details"]["available"] == 1


def test_http_exception_nue_recoit_un_code_de_repli(client):
    r = client.get("/http-error")
    assert r.status_code == 404
    body = r.json()
    _envelope(body)
    assert body["code"] == ErrorCode.NOT_FOUND
    assert body["message"] == "Garage introuvable"


def test_detail_objet_est_normalise(client):
    r = client.get("/legacy-dict-error")
    body = r.json()
    _envelope(body)
    # Le message est extrait, le reste passe en contexte typé.
    assert body["message"] == "Conflit"
    assert body["details"] == {"available": 2}


def test_erreur_de_validation_designe_le_champ(client):
    r = client.post("/validated", json={"age": "pas un entier"})
    assert r.status_code == 422
    body = r.json()
    _envelope(body)
    assert body["code"] == ErrorCode.VALIDATION_ERROR
    assert body["details"]["fields"][0]["field"] == "age"


def test_exception_non_geree_ne_fuit_rien(client):
    r = client.get("/boom")
    assert r.status_code == 500
    body = r.json()
    _envelope(body)
    assert body["code"] == ErrorCode.INTERNAL_ERROR
    # Ni la trace, ni le message d'origine ne doivent sortir.
    assert "hunter2" not in r.text
    assert "RuntimeError" not in r.text
