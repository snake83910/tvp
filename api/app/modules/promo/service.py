"""Validation et calcul des codes promo.

Utilisée à deux endroits :
- /cart/promo/validate : aperçu de la remise AVANT le checkout (UX)
- checkout : re-validation faisant foi au moment de créer la commande
"""
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderStatus
from app.models.promo import PromoCode

# Taux de TVA pneus : utilisé pour répartir la remise TTC en HT/TVA
VAT_RATE = 0.20


def normalize_code(code: str) -> str:
    return code.strip().upper()


async def _uses_count(
    db: AsyncSession, code: str, user_id: uuid.UUID | None = None
) -> int:
    """Utilisations = commandes NON annulées portant ce code.
    Pas de compteur stocké : une commande annulée rend l'utilisation."""
    q = select(func.count()).select_from(Order).where(
        Order.promo_code == code,
        Order.status != OrderStatus.cancelled,
    )
    if user_id is not None:
        q = q.where(Order.user_id == user_id)
    return (await db.execute(q)).scalar() or 0


async def validate_promo(
    db: AsyncSession,
    code: str,
    user_id: uuid.UUID,
    articles_ttc_cents: int,
) -> tuple[PromoCode, int]:
    """Renvoie (promo, remise_ttc_cents) ou lève ValueError (message FR
    affichable tel quel au client)."""
    code = normalize_code(code)
    promo = await db.scalar(
        select(PromoCode).where(PromoCode.code == code)
    )
    if promo is None or not promo.is_active:
        raise ValueError("Code promo invalide")

    now = datetime.now(UTC)
    if promo.valid_from and now < promo.valid_from:
        raise ValueError("Ce code promo n'est pas encore actif")
    if promo.valid_until and now > promo.valid_until:
        raise ValueError("Ce code promo a expiré")

    if articles_ttc_cents < promo.min_articles_ttc_cents:
        mini = promo.min_articles_ttc_cents / 100
        raise ValueError(
            f"Ce code nécessite un minimum de {mini:.2f} € d'articles"
        )

    if promo.max_uses is not None:
        if await _uses_count(db, code) >= promo.max_uses:
            raise ValueError("Ce code promo a atteint son nombre maximum d'utilisations")

    if promo.once_per_user:
        if await _uses_count(db, code, user_id) > 0:
            raise ValueError("Vous avez déjà utilisé ce code promo")

    if promo.discount_type == "percent":
        pct = max(0, min(100, promo.discount_value))
        discount = round(articles_ttc_cents * pct / 100)
    else:  # amount (centimes), borné au total articles
        discount = min(promo.discount_value, articles_ttc_cents)

    if discount <= 0:
        raise ValueError("Code promo invalide")

    return promo, discount


def split_discount(discount_ttc_cents: int) -> tuple[int, int]:
    """Répartit la remise TTC en (HT, TVA) au taux pneu (20 %)."""
    ht = round(discount_ttc_cents / (1 + VAT_RATE))
    return ht, discount_ttc_cents - ht
