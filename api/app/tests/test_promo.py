"""Tests de la validation des codes promo (DB mockée)."""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.promo.service import split_discount, validate_promo


def _promo(**kw):
    p = MagicMock()
    p.code = kw.get("code", "PROMO10")
    p.is_active = kw.get("is_active", True)
    p.valid_from = kw.get("valid_from")
    p.valid_until = kw.get("valid_until")
    p.min_articles_ttc_cents = kw.get("min_articles_ttc_cents", 0)
    p.max_uses = kw.get("max_uses")
    p.once_per_user = kw.get("once_per_user", False)
    p.discount_type = kw.get("discount_type", "percent")
    p.discount_value = kw.get("discount_value", 10)
    p.description = None
    return p


def _db(promo, uses=0):
    db = MagicMock()
    db.scalar = AsyncMock(return_value=promo)
    result = MagicMock()
    result.scalar.return_value = uses
    db.execute = AsyncMock(return_value=result)
    return db


async def test_percent_discount():
    promo = _promo(discount_type="percent", discount_value=10)
    _, discount = await validate_promo(_db(promo), "promo10", uuid.uuid4(), 20000)
    assert discount == 2000  # 10% de 200 €


async def test_amount_discount_cape_au_total():
    promo = _promo(discount_type="amount", discount_value=5000)
    _, discount = await validate_promo(_db(promo), "PROMO10", uuid.uuid4(), 3000)
    assert discount == 3000  # remise 50 € bornée aux 30 € d'articles


async def test_code_inconnu_refuse():
    db = MagicMock()
    db.scalar = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="invalide"):
        await validate_promo(db, "NOPE", uuid.uuid4(), 10000)


async def test_code_inactif_refuse():
    promo = _promo(is_active=False)
    with pytest.raises(ValueError, match="invalide"):
        await validate_promo(_db(promo), "PROMO10", uuid.uuid4(), 10000)


async def test_code_expire_refuse():
    promo = _promo(valid_until=datetime.now(timezone.utc) - timedelta(days=1))
    with pytest.raises(ValueError, match="expiré"):
        await validate_promo(_db(promo), "PROMO10", uuid.uuid4(), 10000)


async def test_minimum_articles_refuse():
    promo = _promo(min_articles_ttc_cents=50000)
    with pytest.raises(ValueError, match="minimum"):
        await validate_promo(_db(promo), "PROMO10", uuid.uuid4(), 10000)


async def test_max_uses_atteint_refuse():
    promo = _promo(max_uses=5)
    with pytest.raises(ValueError, match="maximum"):
        await validate_promo(_db(promo, uses=5), "PROMO10", uuid.uuid4(), 10000)


async def test_once_per_user_refuse_2e_usage():
    promo = _promo(once_per_user=True)
    with pytest.raises(ValueError, match="déjà utilisé"):
        await validate_promo(_db(promo, uses=1), "PROMO10", uuid.uuid4(), 10000)


def test_split_discount_tva_20():
    ht, tva = split_discount(1200)  # 12 € TTC
    assert ht + tva == 1200
    assert ht == 1000  # 10 € HT + 2 € TVA
