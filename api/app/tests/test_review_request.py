"""
Tests de la sollicitation d'avis (POST /cron/reviews).

Un email d'avis mal ciblé est du spam, et le spam se paie en
délivrabilité : les adresses qui plaignent font tomber la réputation du
domaine, et ce sont alors les emails de commande qui n'arrivent plus.
Les garde-fous testés ici protègent donc bien plus que le confort du
client.

Lancer : pytest app/tests/test_review_request.py
"""
import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

# Le CORPS du job, pas l'endpoint : celui-ci le sous-traite à
# `_tracked`, qui écrit sa propre trace et commite une seconde fois.
# Ce test-ci porte sur la sollicitation d'avis, pas sur le suivi
# d'exécution (voir test_cron_tracking.py).
from app.modules.cron.router import REVIEW_DELAY_DAYS, _run_reviews

NOW = datetime(2026, 8, 16, 10, 0, tzinfo=UTC)


def _order(**kw):
    base = dict(
        order_number="TVP-2026-000001",
        status="delivered",
        delivery_mode="partner_garage",
        delivered_at=NOW - timedelta(days=REVIEW_DELAY_DAYS + 1),
        review_requested_at=None,
        garage_snapshot={"name": "Garage Rivaz", "city": "Lyon"},
    )
    base.update(kw)
    return SimpleNamespace(**base)


def _user():
    return SimpleNamespace(id=uuid.uuid4(), email="client@example.com")


def _garage():
    return SimpleNamespace(id=uuid.uuid4(), slug="garage-rivaz-lyon")


def _db(rows, existing_review=None):
    """Base simulée : `execute().all()` rend les lignes sélectionnées,
    `scalar()` répond à la question « cet avis existe-t-il déjà ? »."""
    db = AsyncMock()
    db.execute = AsyncMock(return_value=SimpleNamespace(all=lambda: rows))
    db.scalar = AsyncMock(return_value=existing_review)
    db.commit = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_demande_envoyee_et_horodatee():
    order, user, garage = _order(), _user(), _garage()
    db = _db([(order, user, garage)])

    with patch(
        "app.modules.mailer.service.send_review_request"
    ) as envoi:
        res = await _run_reviews(db)

    assert res == {"checked": 1, "sent": 1}
    envoi.assert_called_once_with(order, user, garage.slug)
    # Horodatée : le prochain passage ne la reprendra pas.
    assert order.review_requested_at is not None
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_client_ayant_deja_note_ce_garage_non_sollicite():
    """L'endpoint d'avis refuserait un second avis en 409 : l'email
    n'aurait mené qu'à un formulaire en erreur."""
    order, user, garage = _order(), _user(), _garage()
    db = _db([(order, user, garage)], existing_review=uuid.uuid4())

    with patch(
        "app.modules.mailer.service.send_review_request"
    ) as envoi:
        res = await _run_reviews(db)

    assert res == {"checked": 1, "sent": 0}
    envoi.assert_not_called()
    # Horodatée quand même : inutile de repasser dessus chaque jour.
    assert order.review_requested_at is not None


@pytest.mark.asyncio
async def test_aucune_commande_eligible():
    db = _db([])

    with patch("app.modules.mailer.service.send_review_request") as envoi:
        res = await _run_reviews(db)

    assert res == {"checked": 0, "sent": 0}
    envoi.assert_not_called()


@pytest.mark.asyncio
async def test_plusieurs_commandes_une_seule_deja_notee():
    """Une commande notée ne doit pas empêcher les autres d'être
    sollicitées : le `continue` porte sur la ligne, pas sur la boucle."""
    rows = [
        (_order(order_number="TVP-2026-000001"), _user(), _garage()),
        (_order(order_number="TVP-2026-000002"), _user(), _garage()),
        (_order(order_number="TVP-2026-000003"), _user(), _garage()),
    ]
    db = _db(rows)
    # La 2e ligne a déjà un avis, les autres non.
    db.scalar = AsyncMock(side_effect=[None, uuid.uuid4(), None])

    with patch("app.modules.mailer.service.send_review_request") as envoi:
        res = await _run_reviews(db)

    assert res == {"checked": 3, "sent": 2}
    assert envoi.call_count == 2
    assert all(o.review_requested_at is not None for o, _u, _g in rows)


def test_delai_non_nul():
    """Demander un avis le jour de la livraison noterait un montage qui
    n'a pas encore eu lieu."""
    assert REVIEW_DELAY_DAYS >= 1
