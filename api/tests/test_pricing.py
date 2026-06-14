"""Tests du moteur de prix (logique pure, pas de DB)."""
from app.modules.pricing.engine import _apply_rule


def test_default_markup_10pct():
    # Sans règle, marge par défaut = 10 %
    p = _apply_rule(None, purchase_ht=100.0)
    # 100 * 1.10 = 110 puis arrondi psych -> ~110 / 109.90 selon mode
    assert p.purchase_ht == 100.0
    assert p.sale_ht > 100.0
    assert p.sale_ttc > p.sale_ht
    assert abs(p.sale_ttc - p.sale_ht * 1.2) < 0.01


def test_apply_rule_uses_markup():
    """Marge custom via une règle factice."""
    class FakeRule:
        markup_percent = 30
        markup_floor = None
        rounding = "default"
        price_floor = None

    p = _apply_rule(FakeRule(), purchase_ht=50.0)
    # 50 * 1.30 = 65.00 (rounding default)
    assert p.sale_ht == 65.0
    assert p.sale_ttc == 78.0


def test_apply_rule_markup_floor():
    """Marge plancher en euros : 5€ min de marge même si % est faible."""
    class FakeRule:
        markup_percent = 1  # 1 % = 0.5€ sur 50€
        markup_floor = 5    # mais on garantit 5€ de marge
        rounding = "default"
        price_floor = None

    p = _apply_rule(FakeRule(), purchase_ht=50.0)
    assert p.sale_ht == 55.0  # 50 + 5 plancher


def test_apply_rule_price_floor():
    """Prix de vente plancher."""
    class FakeRule:
        markup_percent = 10
        markup_floor = None
        rounding = "default"
        price_floor = 80.0

    p = _apply_rule(FakeRule(), purchase_ht=50.0)
    assert p.sale_ht == 80.0
