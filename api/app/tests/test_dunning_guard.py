"""
Tests de la relance : quand a-t-on le DROIT d'annuler ?

La règle tient en une phrase : on n'annule une commande pour non-paiement
que si la banque a confirmé n'avoir rien encaissé. Le reste — banque
muette, montant incohérent, verdict jamais posé — laisse la commande en
attente et la fait remonter à un humain.

Le coût d'une erreur est asymétrique, et c'est ce qui justifie ce
déséquilibre : annuler à tort une commande payée, c'est un client débité
sans pneus. Ne pas annuler à temps une commande abandonnée, c'est une
ligne de plus dans un écran d'administration.

Lancer : pytest app/tests/test_dunning_guard.py
"""
import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.models.order import OrderStatus
from app.modules.cron.router import _run_dunning
from app.modules.orders import reconcile

VIEILLE = datetime.now(UTC) - timedelta(days=8)


def _order(verdict, created_at=VIEILLE):
    o = SimpleNamespace(
        id=uuid.uuid4(),
        order_number="CMD-2026-000001",
        status=OrderStatus.pending_payment,
        created_at=created_at,
        last_dunning_at=None,
        payment_check_result=verdict,
    )
    o.transition_to = lambda target: setattr(o, "status", target)
    return o


def _user():
    return SimpleNamespace(
        id=uuid.uuid4(), email="client@example.com", first_name="Camille"
    )


def _db(orders):
    """`scalars()` sert la passe bancaire, `execute()` la passe relance."""
    rows = [(o, _user()) for o in orders]
    db = AsyncMock()
    db.scalars = AsyncMock(return_value=SimpleNamespace(all=lambda: orders))
    db.execute = AsyncMock(return_value=SimpleNamespace(all=lambda: rows))
    db.commit = AsyncMock()
    return db


async def _run(orders, verdicts=None):
    """Exécute la relance en neutralisant l'appel réseau à la banque.

    `verdicts` permet de simuler une passe 0 qui change le verdict ;
    par défaut elle laisse celui déjà posé sur la commande.
    """
    db = _db(orders)

    async def fake_reconcile(_db, order):
        if verdicts and order.order_number in verdicts:
            order.payment_check_result = verdicts[order.order_number]
        return order.payment_check_result or reconcile.UNAVAILABLE

    with patch.object(reconcile, "reconcile_order", fake_reconcile), \
         patch("app.modules.mailer.service.send_order_cancelled") as annulation:
        result = await _run_dunning(db)
    return result, annulation


@pytest.mark.asyncio
async def test_banque_muette_bloque_l_annulation():
    """LE test à ne jamais laisser rougir."""
    order = _order(reconcile.UNAVAILABLE)
    result, annulation = await _run([order])

    assert result["abandoned"] == 0
    assert result["blocked"] == 1
    assert order.status == OrderStatus.pending_payment
    annulation.assert_not_called()


@pytest.mark.asyncio
async def test_montant_incoherent_bloque_aussi():
    order = _order(reconcile.AMOUNT_MISMATCH)
    result, _ = await _run([order])
    assert result["blocked"] == 1
    assert order.status == OrderStatus.pending_payment


@pytest.mark.asyncio
async def test_verdict_absent_bloque():
    """Une commande antérieure à la mise en place du contrôle n'a pas de
    verdict. Elle ne doit pas être annulée par défaut."""
    order = _order(None)
    result, _ = await _run([order], verdicts={"CMD-2026-000001": None})
    assert result["blocked"] == 1
    assert order.status == OrderStatus.pending_payment


@pytest.mark.asyncio
async def test_banque_confirme_non_payee_on_annule():
    order = _order(reconcile.NOT_PAID)
    result, annulation = await _run([order])

    assert result["abandoned"] == 1
    assert result["blocked"] == 0
    assert order.status == OrderStatus.cancelled
    annulation.assert_called_once()


@pytest.mark.asyncio
async def test_aucun_paiement_initie_on_annule():
    order = _order(reconcile.SKIPPED)
    result, _ = await _run([order])
    assert result["abandoned"] == 1
    assert order.status == OrderStatus.cancelled


@pytest.mark.asyncio
async def test_paiement_retrouve_sort_du_lot():
    """Une commande rattrapée par la passe bancaire ne doit être ni
    relancée ni annulée : elle n'est plus en attente."""
    order = _order(reconcile.NOT_PAID)

    async def fake_reconcile(_db, o):
        o.status = OrderStatus.paid
        return reconcile.PAID

    db = _db([order])
    # La requête de la passe 2 ne rend QUE les commandes encore en
    # attente : celle-ci en est sortie.
    db.execute = AsyncMock(return_value=SimpleNamespace(all=lambda: []))

    with patch.object(reconcile, "reconcile_order", fake_reconcile), \
         patch("app.modules.mailer.service.send_order_cancelled") as annulation:
        result = await _run_dunning(db)

    assert result["recovered"] == 1
    assert result["abandoned"] == 0
    assert result["relanced"] == 0
    annulation.assert_not_called()


@pytest.mark.asyncio
async def test_commande_recente_est_relancee_pas_annulee():
    order = _order(
        reconcile.NOT_PAID, created_at=datetime.now(UTC) - timedelta(hours=3)
    )
    result, annulation = await _run([order])

    assert result["relanced"] == 1
    assert result["abandoned"] == 0
    assert order.status == OrderStatus.pending_payment
    annulation.assert_not_called()
