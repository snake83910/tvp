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

    # Référence RÉELLE : on interroge le catalogue au lieu d'un id codé
    # en dur (MX-100 n'existe pas chez Maxityre -> 404 systématique).
    r = httpx.get(
        f"{BASE}/search/dimensions",
        params={"width": 205, "ratio": 55, "diameter": 16},
        timeout=60,
    )
    assert r.status_code == 200, r.text
    # Stock explicite >= 2 en priorité (stock None = inconnu dans la
    # liste, la fiche détaillée peut révéler un stock insuffisant) ;
    # on essaie plusieurs références car l'ajout revérifie le stock réel.
    items = r.json()["items"]
    candidates = sorted(
        [t for t in items if t.get("stock") is None or t["stock"] >= 2],
        key=lambda t: t.get("stock") is None,
    )
    assert candidates, "aucun pneu 205/55R16 avec stock >= 2"

    r = None
    for t in candidates[:8]:
        r = httpx.post(
            f"{BASE}/cart/items",
            headers=h,
            json={
                "supplier_ref": t["supplier_ref"],
                "width": 205,
                "ratio": 55,
                "diameter": 16,
                "quantity": 2,
            },
            timeout=60,
        )
        if r.status_code == 200:
            break
    assert r is not None and r.status_code == 200, r.text
    # Le token est TOUJOURS généré côté serveur (jamais repris du client)
    sess = r.json()["session_token"]
    assert sess

    # Compte + connexion (mot de passe conforme à la politique)
    pwd = "PneusE2e!2026-tvp"
    em = f"reg{random.randint(10000, 99999)}@tvp.fr"
    r = httpx.post(
        f"{BASE}/auth/register",
        headers=h,
        json={
            "email": em,
            "password": pwd,
            "account_type": "particulier",
        },
    )
    assert r.status_code == 201, r.text
    tok = httpx.post(
        f"{BASE}/auth/login",
        headers=h,
        json={"email": em, "password": pwd},
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
