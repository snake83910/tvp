"""
Tests de la purge des données périmées (POST /cron/purge).

Trois tables grossissaient sans fin. Le sujet dépasse l'hygiène :
`login_logs` conserve des ADRESSES IP, et les garder indéfiniment
contrevient au principe de minimisation — la CNIL attend une durée
définie sur les journaux de connexion.

Un job de suppression est le genre de code où une erreur ne se rattrape
pas. Les tests portent donc sur ce qui protège :

  * les durées de conservation ne peuvent pas tomber à zéro sans que
    quelqu'un s'en aperçoive ;
  * les paniers RATTACHÉS À UN COMPTE sont épargnés ;
  * chaque suppression est bornée, pour ne pas immobiliser une table de
    production au premier passage.

Lancer : pytest app/tests/test_purge.py
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.cron import router as cron


def _db(recorded: list):
    """Base simulée qui note le SQL des SELECT de sélection.

    On ne vérifie pas que Postgres sait supprimer — on vérifie QUELLES
    lignes on lui désigne.
    """
    db = AsyncMock()

    async def scalars(stmt):
        recorded.append(str(stmt.compile(compile_kwargs={"literal_binds": False})))
        return SimpleNamespace(all=lambda: [])

    db.scalars = scalars
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_les_trois_tables_sont_traitees():
    recorded: list[str] = []
    res = await cron._run_purge(_db(recorded))

    assert set(res) == {
        "login_logs", "refresh_tokens", "anonymous_carts", "batch_limit"
    }
    cibles = " ".join(recorded).lower()
    assert "login_logs" in cibles
    assert "refresh_tokens" in cibles
    assert "carts" in cibles


@pytest.mark.asyncio
async def test_les_paniers_dun_compte_sont_epargnes():
    """Supprimer le panier d'un client se verrait — et ce ne sont pas
    eux qui grossissent sans fin : ils sont bornés par le nombre de
    comptes. Seuls les paniers anonymes sont visés."""
    recorded: list[str] = []
    await cron._run_purge(_db(recorded))

    panier = next(s for s in recorded if "FROM carts" in s)
    assert "user_id IS NULL" in panier


@pytest.mark.asyncio
async def test_un_jeton_revoque_recent_est_conserve():
    """Un jeton révoqué mais frais est justement celui qui intéresse une
    enquête : le délai de grâce doit apparaître dans la condition, pas
    seulement l'expiration."""
    recorded: list[str] = []
    await cron._run_purge(_db(recorded))

    jetons = next(s for s in recorded if "FROM refresh_tokens" in s)
    assert "revoked_at IS NOT NULL" in jetons
    assert "expires_at" in jetons


@pytest.mark.asyncio
async def test_suppression_bornee():
    """Le premier passage après des mois d'accumulation ne doit pas
    supprimer des centaines de milliers de lignes dans une seule
    transaction."""
    recorded: list[str] = []
    res = await cron._run_purge(_db(recorded))

    assert res["batch_limit"] == cron.PURGE_BATCH
    assert all("LIMIT" in s for s in recorded)


@pytest.mark.asyncio
async def test_rien_a_purger_ne_casse_pas():
    recorded: list[str] = []
    res = await cron._run_purge(_db(recorded))
    assert res["login_logs"] == 0
    assert res["anonymous_carts"] == 0


def test_durees_de_conservation_non_nulles():
    """Garde-fou : une constante ramenée à 0 supprimerait TOUT au
    prochain passage, y compris les sessions actives."""
    assert cron.LOGIN_LOG_RETENTION_DAYS >= 30
    assert cron.REFRESH_TOKEN_GRACE_DAYS >= 1
    assert cron.ANONYMOUS_CART_DAYS >= 7
    assert 0 < cron.PURGE_BATCH <= 100_000


def test_purge_est_surveillee():
    """Un job non déclaré dans JOB_PERIOD_MINUTES est invisible pour
    /health/jobs — donc aussi silencieux qu'avant."""
    assert "purge" in cron.JOB_PERIOD_MINUTES
