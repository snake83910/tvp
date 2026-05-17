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
