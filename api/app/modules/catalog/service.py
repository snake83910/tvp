"""Accès partagé au catalogue fournisseur (connecteur + cache Redis).

Extrait du router catalogue pour que le panier (add_item) profite du
même cache : avant ça, chaque ajout au panier relançait une recherche
Maxityre complète (jusqu'à MAXITYRE_MAX_PAGES pages) pour retrouver
UNE référence déjà présente dans le cache de la recherche.
"""
from app.core.cache import cache_get, cache_set
from app.core.config import settings
from app.integrations.maxityre import MaxityreConnector

connector = MaxityreConnector()


def fmt_dim(value: float | int) -> str:
    """Clé de cache stable : 22.5 -> "22.5", 16.0 -> "16"."""
    f = float(value)
    return str(int(f)) if f.is_integer() else str(f)


def dimension_cache_key(
    width: int, ratio: int, diameter: float, category: str = "auto"
) -> str:
    """Clé Redis d'un catalogue de dimension — UNIQUE point de vérité
    (recherche, panier, invalidation au checkout)."""
    return (
        f"maxityre:dim:{category}:{fmt_dim(width)}:"
        f"{fmt_dim(ratio)}:{fmt_dim(diameter)}"
    )


async def load_dimension_catalog(
    width: int, ratio: int, diameter: float, category: str = "auto"
) -> list[dict]:
    """Catalogue brut d'une dimension : cache Redis sinon Maxityre.

    Centralisé pour que tous les endpoints partagent la même source
    (et donc le même cache : zéro appel Maxityre redondant).
    """
    cache_key = dimension_cache_key(width, ratio, diameter, category)
    raw_items = await cache_get(cache_key)
    if raw_items is None:
        tyres = await connector.search_by_dimension(
            width, ratio, diameter, category
        )
        raw_items = [t.__dict__ for t in tyres]
        await cache_set(cache_key, raw_items, settings.maxityre_cache_ttl)
    return raw_items


async def load_detail(supplier_ref: str) -> dict | None:
    """Fiche détaillée d'une référence (cache Redis sinon /pneu/{id}).

    La recherche liste ne renvoie PAS les offres/stock ; la fiche
    détaillée si. Utilisée par la fiche produit ET par les contrôles
    de stock du panier."""
    cache_key = f"maxityre:detail:{supplier_ref}"
    detail = await cache_get(cache_key)
    if detail is None:
        full = await connector.get_by_ref(supplier_ref)
        if full is None:
            return None
        detail = full.__dict__
        await cache_set(cache_key, detail, settings.maxityre_cache_ttl)
    return detail
