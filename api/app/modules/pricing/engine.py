"""
Moteur de prix.

Règle d'or (cf. doc archi) : le prix d'ACHAT fournisseur ne s'affiche JAMAIS.
On part du prix HT fournisseur -> on applique la règle de marge la plus
prioritaire -> prix de vente HT -> TTC calculé à l'affichage.

Phase 2 : marge % unique. Pro et particulier paient le même prix ;
la seule différence est l'affichage/facturation (HT pour pro, TTC pour
particulier). Le modèle gère déjà une différenciation future.
"""
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import PricingRule

VAT_RATE = Decimal("0.20")  # TVA 20 % France métropolitaine


@dataclass
class ComputedPrice:
    purchase_ht: float   # prix d'achat (interne, jamais exposé au client)
    sale_ht: float       # prix de vente HT
    sale_ttc: float      # prix de vente TTC
    vat_amount: float
    markup_percent: float


def _round_psych(value: Decimal) -> Decimal:
    """Arrondi psychologique : 47.13 -> 47.90 ; 47.00 -> 46.90."""
    whole = value.to_integral_value(rounding=ROUND_HALF_UP)
    if value <= whole:
        return whole - Decimal("0.10")
    return whole + Decimal("0.90") if (whole + Decimal("0.90")) >= value \
        else whole + Decimal("0.90")


def _round(value: Decimal, mode: str) -> Decimal:
    if mode == "psych":
        r = _round_psych(value)
        return r if r > 0 else value.quantize(Decimal("0.01"))
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def load_active_rules(db: AsyncSession) -> list[PricingRule]:
    """Charge toutes les règles actives triées par priorité décroissante.
    À appeler une seule fois, puis passer la liste à select_rule_sync."""
    rows = await db.scalars(
        select(PricingRule)
        .where(PricingRule.is_active.is_(True))
        .order_by(PricingRule.priority.desc())
    )
    return list(rows)


def select_rule_sync(
    rules: list[PricingRule],
    account_type: str,
    price_tier: str | None,
    brand: str,
) -> PricingRule | None:
    """Sélection de règle en mémoire — pas de requête DB."""
    for rule in rules:
        if rule.account_type and rule.account_type != account_type:
            continue
        if rule.price_tier and rule.price_tier != price_tier:
            continue
        if rule.brand and rule.brand.lower() != (brand or "").lower():
            continue
        return rule
    return None


async def _select_rule(
    db: AsyncSession, account_type: str, price_tier: str | None, brand: str
) -> PricingRule | None:
    """La règle active la plus prioritaire qui matche le contexte."""
    rules = await load_active_rules(db)
    return select_rule_sync(rules, account_type, price_tier, brand)


def compute_price_sync(
    rules: list[PricingRule],
    purchase_ht: float,
    account_type: str = "particulier",
    price_tier: str | None = None,
    brand: str = "",
) -> ComputedPrice:
    """Version synchrone : utilise des règles déjà chargées (pas de DB)."""
    rule = select_rule_sync(rules, account_type, price_tier, brand)
    return _apply_rule(rule, purchase_ht)


def _apply_rule(rule: PricingRule | None, purchase_ht: float) -> ComputedPrice:
    markup = Decimal(str(rule.markup_percent)) if rule else Decimal("10")
    purchase = Decimal(str(purchase_ht))

    sale_ht = purchase * (Decimal("1") + markup / Decimal("100"))

    if rule and rule.markup_floor is not None:
        floor_ht = purchase + Decimal(str(rule.markup_floor))
        sale_ht = max(sale_ht, floor_ht)

    sale_ht = _round(sale_ht, rule.rounding if rule else "psych")

    if rule and rule.price_floor is not None:
        sale_ht = max(sale_ht, Decimal(str(rule.price_floor)))

    sale_ttc = (sale_ht * (Decimal("1") + VAT_RATE)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    vat = sale_ttc - sale_ht

    return ComputedPrice(
        purchase_ht=float(purchase),
        sale_ht=float(sale_ht),
        sale_ttc=float(sale_ttc),
        vat_amount=float(vat),
        markup_percent=float(markup),
    )


async def compute_price(
    db: AsyncSession,
    purchase_ht: float,
    account_type: str = "particulier",
    price_tier: str | None = None,
    brand: str = "",
) -> ComputedPrice:
    rule = await _select_rule(db, account_type, price_tier, brand)
    return _apply_rule(rule, purchase_ht)
