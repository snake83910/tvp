"""Tests règles de livraison (logique pure)."""
import pytest

from app.modules.shipping.rules import compute_home_shipping, MIN_QTY_PER_LINE_FOR_FREE


def test_shipping_free_when_all_lines_above_threshold():
    """Gratuit si toutes les lignes >= MIN_QTY_PER_LINE_FOR_FREE."""
    q = compute_home_shipping([MIN_QTY_PER_LINE_FOR_FREE, MIN_QTY_PER_LINE_FOR_FREE + 1])
    assert q.ht_cents == 0
    assert q.vat_cents == 0


def test_shipping_paid_when_one_line_below():
    """Payant si AU MOINS une ligne est sous le seuil."""
    q = compute_home_shipping([1, MIN_QTY_PER_LINE_FOR_FREE])
    assert q.ht_cents > 0


def test_shipping_single_line_below():
    q = compute_home_shipping([1])
    assert q.ht_cents > 0
