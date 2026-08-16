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
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user_optional
from app.core.errors import AppError, ErrorCode
from app.db.session import get_db
from app.integrations.supplier_base import VEHICLE_CATEGORIES
from app.models.catalog import PricingRule
from app.models.user import ProProfile, User
from app.modules.catalog import plate as plate_lookup
from app.modules.catalog.service import (
    load_detail as _load_detail,
)
from app.modules.catalog.service import (
    load_dimension_catalog as _load_dimension_catalog,
)
from app.modules.pricing.engine import compute_price_sync, load_active_rules
from app.schemas.catalog import (
    PlateLookupOut,
    SearchFacets,
    SearchResponse,
    TyreResult,
    VehicleDimension,
)

router = APIRouter(prefix="/search", tags=["catalog"])

SORTS = {"price_asc", "price_desc", "brand"}


def _check_category(category: str) -> str:
    if category not in VEHICLE_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail=f"Catégorie inconnue. Valeurs : {', '.join(VEHICLE_CATEGORIES)}",
        )
    return category


def _to_priced_tyre(
    raw: dict,
    rules: list[PricingRule],
    account_type: str,
    price_tier: str | None,
    category: str = "auto",
) -> TyreResult:
    """Transforme un item brut en TyreResult. Synchrone : les règles sont
    déjà chargées en mémoire, aucune requête DB supplémentaire."""
    priced = compute_price_sync(
        rules,
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
        brand_slug=raw.get("brand_slug"),
        brand_tier=raw.get("brand_tier"),
        ean=raw.get("ean"),
        eprel_id=raw.get("eprel_id"),
        description_html=raw.get("description_html"),
        is_runflat=raw.get("is_runflat", False),
        is_xl=raw.get("is_xl", False),
        is_3pmsf=raw.get("is_3pmsf", False),
        is_studded=raw.get("is_studded", False),
        stock=raw.get("stock"),
        delivery_estimate=raw.get("delivery_estimate"),
        market_prices=raw.get("market_prices") or [],
        category=category,
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
    # Bornes larges : autos (205/55 R16), agricole (650/65 R38), poids lourd
    # (315/70 R22.5 — diamètre DÉCIMAL) et quad en pouces (25X8-12 : largeur=8,
    # hauteur=25) qui descend bien en-dessous des minima tourisme.
    width: int = Query(..., ge=8, le=1200, examples=[205]),
    ratio: int = Query(..., ge=8, le=110, examples=[55]),
    diameter: float = Query(..., ge=8, le=60, examples=[16]),
    category: str = Query(
        "auto",
        description="Famille de véhicule : auto, moto, quad, camion, agricole",
    ),
    brand: str | None = Query(
        None, examples=["Michelin"],
        description="Une ou plusieurs marques séparées par des virgules",
    ),
    season: str | None = Query(None, examples=["ete"]),
    tier: str | None = Query(
        None, examples=["premium"],
        description="Gamme(s) de marque séparées par des virgules : premium, quality, discount",
    ),
    three_pmsf: bool | None = Query(
        None, description="true = uniquement les pneus homologués 3PMSF (Loi Montagne)"
    ),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    sort: str = Query("price_asc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=96),
    response: Response = None,  # type: ignore
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    # Cache navigateur : private (varie selon l'utilisateur connecté), 5 min.
    # Permet à un visiteur qui revient sur la même recherche d'éviter un appel.
    if response is not None:
        response.headers["Cache-Control"] = "private, max-age=300"

    _check_category(category)
    account_type, price_tier = await _resolve_account(db, user)

    # 1 requête DB pour les règles, 1 pour le catalogue (cache Redis) — pas de N+1
    raw_items, rules = await asyncio.gather(
        _load_dimension_catalog(width, ratio, diameter, category),
        load_active_rules(db),
    )

    priced_all: list[TyreResult] = [
        _to_priced_tyre(it, rules, account_type, price_tier, category)
        for it in raw_items
    ]

    brand_counts: dict[str, int] = {}
    for t in priced_all:
        if t.brand:
            brand_counts[t.brand] = brand_counts.get(t.brand, 0) + 1

    facets = SearchFacets(
        brands=sorted(brand_counts),
        brand_counts=brand_counts,
        seasons=sorted({t.season for t in priced_all if t.season}),
        tiers=sorted({t.brand_tier for t in priced_all if t.brand_tier}),
        price_min=round(
            min((t.display_price for t in priced_all), default=0), 2
        ),
        price_max=round(
            max((t.display_price for t in priced_all), default=0), 2
        ),
    )

    filtered = priced_all
    if brand:
        # Multi-sélection : "Michelin,Continental"
        wanted = {b.strip() for b in brand.split(",") if b.strip()}
        filtered = [t for t in filtered if t.brand in wanted]
    if season:
        filtered = [t for t in filtered if t.season == season]
    if tier:
        wanted_tiers = {x.strip() for x in tier.split(",") if x.strip()}
        filtered = [t for t in filtered if t.brand_tier in wanted_tiers]
    if three_pmsf:
        filtered = [t for t in filtered if t.is_3pmsf]
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


@router.get("/by-plate", response_model=PlateLookupOut)
async def search_by_plate(
    plate: str = Query(..., min_length=4, max_length=12, examples=["AA-123-AA"]),
    db: AsyncSession = Depends(get_db),
):
    """Dimensions pneus d'un véhicule, par plaque française.

    Deux fournisseurs, dans un ordre réglable depuis l'administration
    (voir `modules/catalog/plate.py`). Résultat mis en cache 24 h : les
    dimensions d'un véhicule ne changent pas, et le quota du
    fournisseur principal se compte à la journée.
    """
    clean = plate_lookup.clean_plate(plate)
    if clean is None:
        raise HTTPException(status_code=422, detail="Format de plaque invalide")

    try:
        found = await plate_lookup.lookup(db, clean)
    except plate_lookup.PlateNotFoundError:
        raise HTTPException(
            status_code=404, detail="Aucune dimension trouvée pour cette plaque"
        ) from None
    except plate_lookup.PlateUnavailableError as exc:
        # Distinct du 404 : le véhicule existe peut-être, c'est NOUS qui
        # ne savons pas répondre. Le client doit être invité à saisir
        # ses dimensions, pas à conclure que sa voiture est inconnue.
        raise AppError(
            status_code=503,
            code=ErrorCode.PLATE_LOOKUP_UNAVAILABLE,
            message=(
                "Service immatriculation temporairement indisponible. "
                "Veuillez saisir vos dimensions manuellement."
            ),
            details={"reason": str(exc)[:200]},
        ) from exc

    return PlateLookupOut(
        vehicle=found.vehicle or None,
        brand_logo=found.brand_logo or None,
        dimensions=[VehicleDimension(**d) for d in found.dimensions],
    )


@router.get("/product/{ref}", response_model=TyreResult)
async def get_product(
    ref: str,
    width: int = Query(..., ge=8, le=1200),
    ratio: int = Query(..., ge=8, le=110),
    diameter: float = Query(..., ge=8, le=60),
    category: str = Query("auto"),
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
    _check_category(category)
    raw_items = await _load_dimension_catalog(width, ratio, diameter, category)
    match = next(
        (it for it in raw_items if it.get("supplier_ref") == ref),
        None,
    )
    if match is None:
        raise HTTPException(
            status_code=404,
            detail="Référence introuvable pour cette dimension",
        )

    # Enrichissement fiche détaillée (EAN, EPREL, description, stock...)
    # via /pneu/{id}. Caché en Redis pour éviter un appel par visite.
    try:
        detail = await _load_detail(ref)
    except Exception:
        detail = None

    if detail:
        # On fusionne : enrichissements de la fiche par-dessus le résumé,
        # mais on garde price_ht de la liste (peut différer ; on privilégie
        # la version qu'on a utilisée pour calculer le prix client)
        merged = {**match, **{k: v for k, v in detail.items() if v is not None}}
        merged["price_ht"] = match["price_ht"]
        match = merged

    account_type, price_tier = await _resolve_account(db, user)
    rules = await load_active_rules(db)
    return _to_priced_tyre(match, rules, account_type, price_tier, category)
