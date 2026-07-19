"""
Tests de la machine à états de commande.

Garantie critique : une commande ne peut JAMAIS sauter d'état
(ex. être expédiée sans paiement). Ces tests doivent rester verts.
"""
import pytest

from app.models.order import (
    InvalidTransitionError,
    OrderStatus,
    assert_transition,
)


def test_transitions_valides():
    assert_transition(OrderStatus.pending_payment, OrderStatus.paid)
    assert_transition(OrderStatus.paid, OrderStatus.sent_to_supplier)
    assert_transition(OrderStatus.sent_to_supplier, OrderStatus.shipped)
    assert_transition(OrderStatus.shipped, OrderStatus.delivered)
    assert_transition(OrderStatus.pending_payment, OrderStatus.cancelled)


def test_saut_etat_interdit():
    # Expédier sans payer : interdit
    with pytest.raises(InvalidTransitionError):
        assert_transition(OrderStatus.pending_payment, OrderStatus.shipped)
    # Tout sauter depuis le panier : interdit
    with pytest.raises(InvalidTransitionError):
        assert_transition(OrderStatus.cart, OrderStatus.delivered)


def test_retour_arriere_interdit():
    with pytest.raises(InvalidTransitionError):
        assert_transition(OrderStatus.delivered, OrderStatus.paid)


def test_etats_terminaux():
    with pytest.raises(InvalidTransitionError):
        assert_transition(OrderStatus.cancelled, OrderStatus.paid)
    with pytest.raises(InvalidTransitionError):
        assert_transition(OrderStatus.refunded, OrderStatus.shipped)
