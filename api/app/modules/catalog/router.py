"""
Recherche catalogue.

- Pas de stockage du catalogue fournisseur : interrogation Maxityre à la
  volée, cache Redis court (prix/dispo volatils).
- Le prix d'achat fournisseur n'est jamais renvoyé.
- Le prix affiché dépend du compte : pro -> HT, particulier -> TTC.
- Endpoint public (recherche sans compte) : prix particulier par défaut.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.cache import cache_get, cache_set
from app.core.config import settings
from app.core.deps import get_current_user_optional
from app.db.session import get_db
from app.integrations.maxityre import MaxityreConnector
from app.modules.pricing.engine import compute_price
from app.models.user import ProProfile, User
from app.schemas.catalog import TyreResult

router = APIRouter(prefix="/search", tags=["catalog"])

_connector = MaxityreConnector()


@router.get("/dimensions", response_model=list[TyreResult])
async def search_by_dimensions(
    width: int = Query(..., ge=100, le=400, examples=[205]),
    ratio: int = Query(..., ge=20, le=100, examples=[55]),
    diameter: int = Query(..., ge=10, le=30, examples=[16]),
    season: str | None = Query(None, examples=["ete"]),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    account_type = user.account_type.value if user else "particulier"

    price_tier = None
    if user and account_type == "pro":
        # Chargement explicite : le lazy-load relationnel est interdit
        # en contexte async (sinon MissingGreenlet).
        profile = await db.scalar(
            select(ProProfile).where(ProProfile.user_id == user.id)
        )
        price_tier = profile.price_tier if profile else None

    cache_key = f"maxityre:dim:{width}:{ratio}:{diameter}"
    raw_items = await cache_get(cache_key)

    if raw_items is None:
        tyres = await _connector.search_by_dimension(width, ratio, diameter)
        raw_items = [t.__dict__ for t in tyres]
        await cache_set(cache_key, raw_items, settings.maxityre_cache_ttl)

    results: list[TyreResult] = []
    for it in raw_items:
        if season and it.get("season") != season:
            continue

        priced = await compute_price(
            db,
            purchase_ht=it["price_ht"],
            account_type=account_type,
            price_tier=price_tier,
            brand=it.get("brand", ""),
        )

        dim_disp = it.get("raw_dimension") or (
            f"{it.get('width')}/{it.get('aspect_ratio')} "
            f"R{it.get('diameter')}"
        )
        results.append(
            TyreResult(
                supplier_ref=it["supplier_ref"],
                brand=it["brand"],
                model=it["model"],
                dimension=dim_disp,
                width=it.get("width"),
                aspect_ratio=it.get("aspect_ratio"),
                diameter=it.get("diameter"),
                load_index=it.get("load_index"),
                speed_rating=it.get("speed_rating"),
                season=it.get("season", "inconnu"),
                image_url=it.get("image_url"),
                eu_label=it.get("eu_label", {}),
                price_ht=priced.sale_ht,
                price_ttc=priced.sale_ttc,
                display_price=(
                    priced.sale_ht
                    if account_type == "pro"
                    else priced.sale_ttc
                ),
                display_mode="HT" if account_type == "pro" else "TTC",
            )
        )
    return results
