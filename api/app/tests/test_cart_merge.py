"""
Régression critique : la fusion du panier anonyme à la connexion ne
doit JAMAIS vider le panier.

Bug historique : la cascade delete-orphan de Cart.items supprimait les
items au lieu de les transférer -> client qui perd sa commande en se
connectant pour payer. Corrigé par UPDATE SQL direct.

Test e2e (nécessite API + DB) : RUN_E2E=1 pytest
"""
import os
import random

import httpx
import pytest

BASE = os.getenv("TEST_API_URL", "http://127.0.0.1:8000")


@pytest.mark.skipif(
    os.getenv("RUN_E2E") != "1",
    reason="e2e : nécessite API + DB + connecteur (RUN_E2E=1)",
)
def test_merge_ne_vide_pas_le_panier():
    h = {"Content-Type": "application/json"}

    # Panier anonyme avec un article
    r = httpx.post(
        f"{BASE}/cart/items",
        headers=h,
        json={
            "supplier_ref": "MX-100",
            "width": 205,
            "ratio": 55,
            "diameter": 16,
            "quantity": 2,
        },
    )
    assert r.status_code == 200
    sess = r.json()["session_token"]
    assert sess

    # Compte + connexion
    em = f"reg{random.randint(10000, 99999)}@tvp.fr"
    httpx.post(
        f"{BASE}/auth/register",
        headers=h,
        json={
            "email": em,
            "password": "motdepasse123",
            "account_type": "particulier",
        },
    )
    tok = httpx.post(
        f"{BASE}/auth/login",
        headers=h,
        json={"email": em, "password": "motdepasse123"},
    ).json()["access_token"]

    # Fusion : l'article DOIT suivre dans le compte
    r = httpx.post(
        f"{BASE}/cart/merge",
        headers={
            "Authorization": f"Bearer {tok}",
            "X-Cart-Session": sess,
        },
    )
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1, "le panier a été vidé à la connexion !"
    assert items[0]["quantity"] == 2
