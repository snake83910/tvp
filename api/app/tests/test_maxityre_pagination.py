"""
Régression pagination Maxityre.

Bug historique : seule la 1re page (20 pneus) était récupérée alors que
l'API en a souvent >1500. Ce test garantit que TOUTES les pages sont
récupérées. Format réel constaté : details.nbResults / details.limit.
"""
import asyncio

import httpx
import pytest
from unittest.mock import patch

from app.integrations.maxityre import MaxityreConnector


def _page(nb, limit, page):
    start = (page - 1) * limit
    n = max(0, min(limit, nb - start))
    return {
        "details": {"nbResults": nb, "limit": limit, "page": page},
        "items": [
            {
                "id": 1000 + start + i,
                "prixHt": 30.0 + i,
                "profil": {
                    "profil": "M",
                    "marque": {"marque": "B"},
                },
                "dimension": "205/55R16 91V",
                "saison": "S",
            }
            for i in range(n)
        ],
    }


def test_recupere_toutes_les_pages():
    nb, limit = 1527, 20

    class R:
        status_code = 200

        def __init__(self, p):
            self.p = p

        def json(self):
            return _page(nb, limit, self.p)

    async def g(self, url, headers=None, params=None):
        return R(params.get("search_pneus_dimension[page]", 1))

    async def run():
        c = MaxityreConnector()
        c._token = "x"
        c._token_ts = 9e18
        with patch.object(httpx.AsyncClient, "get", g):
            return await c.search_by_dimension(205, 55, 16)

    res = asyncio.run(run())
    assert len(res) == 1527
    assert len({r.supplier_ref for r in res}) == 1527  # pas de doublon


def test_une_seule_page():
    class R:
        status_code = 200

        def json(self):
            return _page(8, 20, 1)

    async def g(self, url, headers=None, params=None):
        return R()

    async def run():
        c = MaxityreConnector()
        c._token = "x"
        c._token_ts = 9e18
        with patch.object(httpx.AsyncClient, "get", g):
            return await c.search_by_dimension(165, 70, 14)

    assert len(asyncio.run(run())) == 8


def test_category_transmise_a_l_api():
    """La catégorie demandée doit partir dans les params de CHAQUE page,
    et le diamètre décimal poids lourd doit partir en "22.5"."""
    seen: list[tuple] = []

    class R:
        status_code = 200

        def json(self):
            return _page(3, 20, 1)

    async def g(self, url, headers=None, params=None):
        seen.append((
            params.get("search_pneus_dimension[category]"),
            params.get("search_pneus_dimension[diameter]"),
        ))
        return R()

    async def run():
        c = MaxityreConnector()
        c._token = "x"
        c._token_ts = 9e18
        with patch.object(httpx.AsyncClient, "get", g):
            return await c.search_by_dimension(315, 70, 22.5, "camion")

    asyncio.run(run())
    assert seen == [("camion", "22.5")]


def test_dimension_non_parsable_reprend_la_recherche():
    """Un format hors parseur strict (ex. scooter « 120/70-12 ») ne doit
    pas produire width/diameter=None : on retombe sur la dimension
    recherchée (sinon l'ajout au panier est impossible)."""

    class R:
        status_code = 200

        def json(self):
            page = _page(1, 20, 1)
            page["items"][0]["dimension"] = "120/70-12 51S"
            return page

    async def g(self, url, headers=None, params=None):
        return R()

    async def run():
        c = MaxityreConnector()
        c._token = "x"
        c._token_ts = 9e18
        with patch.object(httpx.AsyncClient, "get", g):
            return await c.search_by_dimension(120, 70, 12, "moto")

    res = asyncio.run(run())
    assert len(res) == 1
    assert res[0].width == 120
    assert res[0].aspect_ratio == 70
    assert res[0].diameter == 12
