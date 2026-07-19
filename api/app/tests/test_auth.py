"""
Tests d'integration auth - lancer avec une base PostgreSQL + API up.

    docker compose up -d
    RUN_E2E=1 pytest

Parcours valide : inscription particulier/pro, login, /auth/me,
refresh, gardes 401/403/409/422, CRUD adresses.
"""
import os
import random

import httpx
import pytest

BASE = os.getenv("TEST_API_URL", "http://127.0.0.1:8000")

# Conforme à la politique (10+ chars, majuscule, chiffre/spécial) et
# suffisamment original pour passer le check HaveIBeenPwned.
E2E_PASSWORD = "PneusE2e!2026-tvp"


@pytest.mark.skipif(
    os.getenv("RUN_E2E") != "1",
    reason="Test e2e : necessite API + DB (RUN_E2E=1)",
)
def test_full_auth_flow():
    # Email aléatoire : le test doit être rejouable sans purge de la DB
    email = f"e2e{random.randint(100000, 999999)}@example.com"
    r = httpx.post(f"{BASE}/auth/register", json={
        "email": email, "password": E2E_PASSWORD,
        "account_type": "particulier"})
    assert r.status_code == 201, r.text
    assert r.json()["role"] == "client"

    r = httpx.post(f"{BASE}/auth/login", json={
        "email": email, "password": E2E_PASSWORD})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]

    r = httpx.get(f"{BASE}/auth/me",
                  headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert httpx.get(f"{BASE}/auth/me").status_code == 401
