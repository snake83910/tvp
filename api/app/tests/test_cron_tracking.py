"""
Tests de la trace d'exécution des jobs planifiés.

Le but de cette trace est de rendre visible un arrêt silencieux : un
crontab perdu au redéploiement, un `CRON_TOKEN` régénéré sans mise à
jour de la ligne cron. Sans elle, les relances de paiement, les rappels
de rendez-vous et les demandes d'avis s'arrêtent tous les trois sans que
personne ne le sache.

Le cas le plus important est l'ÉCHEC : un job qui lève doit laisser une
trace, sinon un job cassé se déguise en job jamais lancé — et on cherche
au mauvais endroit.

Lancer : pytest app/tests/test_cron_tracking.py
"""
from unittest.mock import AsyncMock

import pytest

from app.modules.cron.router import JOB_PERIOD_MINUTES, _tracked


def _db():
    db = AsyncMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


def _recorded(db) -> dict:
    """Valeurs passées à l'INSERT ... ON CONFLICT."""
    stmt = db.execute.await_args.args[0]
    return dict(stmt.compile().params)


@pytest.mark.asyncio
async def test_succes_enregistre():
    db = _db()

    async def work():
        return {"checked": 3, "sent": 1}

    result = await _tracked(db, "reviews", work)

    assert result == {"checked": 3, "sent": 1}
    params = _recorded(db)
    assert params["job"] == "reviews"
    assert params["status"] == "ok"
    assert params["detail"] == {"checked": 3, "sent": 1}
    assert params["duration_ms"] >= 0
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_echec_enregistre_et_relance():
    """L'exception doit remonter — le curl du crontab doit voir un 500 —
    mais la trace doit être écrite avant."""
    db = _db()

    async def work():
        raise RuntimeError("la banque a raccroché")

    with pytest.raises(RuntimeError):
        await _tracked(db, "dunning", work)

    params = _recorded(db)
    assert params["status"] == "error"
    assert "raccroché" in params["detail"]["error"]
    # Session remise à plat avant d'écrire : sans ça, l'écriture de la
    # trace échouerait à son tour et on perdrait l'information.
    db.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_message_d_erreur_borne():
    """Un traceback de 40 ko n'a rien à faire dans une colonne de suivi."""
    db = _db()

    async def work():
        raise RuntimeError("x" * 5000)

    with pytest.raises(RuntimeError):
        await _tracked(db, "dunning", work)

    assert len(_recorded(db)["detail"]["error"]) <= 500


def test_tous_les_jobs_sont_surveilles():
    """Garde-fou : un job ajouté sans période reste invisible pour
    /health/jobs, donc aussi silencieux qu'avant."""
    from app.modules.cron import router

    endpoints = {
        route.path.rsplit("/", 1)[-1]
        for route in router.router.routes
    }
    assert endpoints == set(JOB_PERIOD_MINUTES)
