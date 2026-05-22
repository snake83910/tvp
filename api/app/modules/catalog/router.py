"""
Recherche catalogue.

- Pas de stockage du catalogue fournisseur : interrogation Maxityre a la
  volee, cache Redis (toutes les pages, TTL long).
- Le prix d'achat fournisseur n'est jamais renvoye.
- Le prix affiche depend du compte : pro -> HT, particulier -> TTC.
- Filtrage / tri / pagination effectues COTE SERVEUR sur le cache :
  le navigateur ne recoit que la page demandee (~24 pneus), pas 1500.
- Les facettes (marques, saisons, fourchette de prix reellement
  presentes) sont renvoyees pour batir la barre de filtres cote front.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_get, cache_set
from app.core.config import settings
from app.core.deps import get_current_user_optional
from app.db.session import get_db
from app.integrations.maxityre import MaxityreConnector
from app.models.user import ProProfile, User
from app.modules.pricing.engine import compute_price
from app.schemas.catalog import (
    SearchFacets,
    SearchResponse,
    TyreResult,
)

router = APIRouter(prefix="/search", tags=["catalog"])

_connector = MaxityreConnector()

SORTS = {"price_asc", "price_desc", "brand"}


async def _load_dimension_catalog(
    width: int, ratio: int, diameter: int
) -> list[dict]:
    """Catalogue brut d'une dimension : cache Redis sinon Maxityre.

    Centralisé pour que tous les endpoints partagent la même source
    (et donc le même cache : zéro appel Maxityre redondant).
    """
    cache_key = f"maxityre:dim:{width}:{ratio}:{diameter}"
    raw_items = await cache_get(cache_key)
    if raw_items is None:
        tyres = await _connector.search_by_dimension(width, ratio, diameter)
        raw_items = [t.__dict__ for t in tyres]
        await cache_set(cache_key, raw_items, settings.maxityre_cache_ttl)
    return raw_items


async def _to_priced_tyre(
    db: AsyncSession,
    raw: dict,
    account_type: str,
    price_tier: str | None,
) -> TyreResult:
    """Transforme un item brut fournisseur en TyreResult avec prix
    calculé selon le compte. Helper centralisé pour ne pas dupliquer."""
    priced = await compute_price(
        db,
        purchase_ht=raw["price_ht"],
        account_type=account_type,
        price_tier=price_tier,
        brand=raw.get("brand", ""),
    )
    disp = priced.sale_ht if account_type == "pro" else priced.sale_ttc
    return TyreResult(
        supplier_ref=raw["supplier_ref"],
        brand=raw["brand"],
        model=raw["model"],
        dimension=raw.get("raw_dimension")
        or f"{raw.get('width')}/{raw.get('aspect_ratio')} "
        f"R{raw.get('diameter')}",
        width=raw.get("width"),
        aspect_ratio=raw.get("aspect_ratio"),
        diameter=raw.get("diameter"),
        load_index=raw.get("load_index"),
        speed_rating=raw.get("speed_rating"),
        season=raw.get("season", "inconnu"),
        image_url=raw.get("image_url"),
        eu_label=raw.get("eu_label", {}),
        price_ht=priced.sale_ht,
        price_ttc=priced.sale_ttc,
        display_price=disp,
        display_mode="HT" if account_type == "pro" else "TTC",
    )


async def _resolve_account(
    db: AsyncSession, user: User | None
) -> tuple[str, str | None]:
    """Renvoie (account_type, price_tier) selon le user connecté."""
    if not user:
        return "particulier", None
    account_type = user.account_type.value
    price_tier = None
    if account_type == "pro":
        profile = await db.scalar(
            select(ProProfile).where(ProProfile.user_id == user.id)
        )
        price_tier = profile.price_tier if profile else None
    return account_type, price_tier


@router.get("/dimensions", response_model=SearchResponse)
async def search_by_dimensions(
    width: int = Query(..., ge=100, le=400, examples=[205]),
    ratio: int = Query(..., ge=20, le=100, examples=[55]),
    diameter: int = Query(..., ge=10, le=30, examples=[16]),
    brand: str | None = Query(None, examples=["Michelin"]),
    season: str | None = Query(None, examples=["ete"]),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    sort: str = Query("price_asc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=96),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    account_type, price_tier = await _resolve_account(db, user)

    raw_items = await _load_dimension_catalog(width, ratio, diameter)

    priced_all: list[TyreResult] = []
    for it in raw_items:
        priced_all.append(
            await _to_priced_tyre(db, it, account_type, price_tier)
        )

    facets = SearchFacets(
        brands=sorted({t.brand for t in priced_all if t.brand}),
        seasons=sorted({t.season for t in priced_all if t.season}),
        price_min=round(
            min((t.display_price for t in priced_all), default=0), 2
        ),
        price_max=round(
            max((t.display_price for t in priced_all), default=0), 2
        ),
    )

    filtered = priced_all
    if brand:
        filtered = [t for t in filtered if t.brand == brand]
    if season:
        filtered = [t for t in filtered if t.season == season]
    if min_price is not None:
        filtered = [t for t in filtered if t.display_price >= min_price]
    if max_price is not None:
        filtered = [t for t in filtered if t.display_price <= max_price]

    if sort not in SORTS:
        sort = "price_asc"
    if sort == "price_asc":
        filtered.sort(key=lambda t: t.display_price)
    elif sort == "price_desc":
        filtered.sort(key=lambda t: t.display_price, reverse=True)
    elif sort == "brand":
        filtered.sort(key=lambda t: (t.brand, t.display_price))

    total = len(filtered)
    pages = max(1, (total + per_page - 1) // per_page)
    page = min(page, pages)
    start = (page - 1) * per_page
    page_items = filtered[start : start + per_page]

    return SearchResponse(
        items=page_items,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
        facets=facets,
    )


@router.get("/product/{ref}", response_model=TyreResult)
async def get_product(
    ref: str,
    width: int = Query(..., ge=100, le=400),
    ratio: int = Query(..., ge=20, le=100),
    diameter: int = Query(..., ge=10, le=30),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    """
    Récupère un pneu par sa référence fournisseur + sa dimension.

    Exploite le cache catalogue de la dimension (rempli par la
    recherche) : trouver une référence dedans est instantané, peu
    importe la "page" où elle apparaîtrait dans une liste paginée.
    Si le cache est vide, on remplit en un seul appel (qui paginera
    Maxityre une bonne fois et servira ensuite toutes les requêtes).
    """
    raw_items = await _load_dimension_catalog(width, ratio, diameter)
    match = next(
        (it for it in raw_items if it.get("supplier_ref") == ref),
        None,
    )
    if match is None:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=404,
            detail="Référence introuvable pour cette dimension",
        )
    account_type, price_tier = await _resolve_account(db, user)
    return await _to_priced_tyre(db, match, account_type, price_tier)
