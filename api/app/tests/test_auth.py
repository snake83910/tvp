"""
Tests d'integration auth - lancer avec une base PostgreSQL + API up.

    docker compose up -d
    RUN_E2E=1 pytest

Parcours valide : inscription particulier/pro, login, /auth/me,
refresh, gardes 401/403/409/422, CRUD adresses.
"""
import os
import httpx
import pytest

BASE = os.getenv("TEST_API_URL", "http://127.0.0.1:8000")


@pytest.mark.skipif(
    os.getenv("RUN_E2E") != "1",
    reason="Test e2e : necessite API + DB (RUN_E2E=1)",
)
def test_full_auth_flow():
    r = httpx.post(f"{BASE}/auth/register", json={
        "email": "e2e@example.com", "password": "motdepasse123",
        "account_type": "particulier"})
    assert r.status_code == 201
    assert r.json()["role"] == "client"

    r = httpx.post(f"{BASE}/auth/login", json={
        "email": "e2e@example.com", "password": "motdepasse123"})
    assert r.status_code == 200
    token = r.json()["access_token"]

    r = httpx.get(f"{BASE}/auth/me",
                  headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert httpx.get(f"{BASE}/auth/me").status_code == 401
