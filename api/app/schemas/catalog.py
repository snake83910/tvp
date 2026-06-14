from pydantic import BaseModel


class VehicleDimension(BaseModel):
    width: int
    height: int
    diameter: int
    load_index: str
    speed_rating: str


class TyreResult(BaseModel):
    supplier_ref: str
    brand: str
    model: str
    dimension: str
    width: int | None
    aspect_ratio: int | None
    diameter: int | None
    load_index: int | None
    speed_rating: str | None
    season: str
    image_url: str | None
    eu_label: dict
    # Prix calcule selon le compte courant.
    # purchase_ht n'est JAMAIS expose ici.
    price_ht: float
    price_ttc: float
    # Prix mis en avant selon le type de client (pro -> HT, particulier -> TTC)
    display_price: float
    display_mode: str  # "HT" ou "TTC"


class SearchFacets(BaseModel):
    """Valeurs reellement presentes dans les resultats, pour construire
    dynamiquement la barre de filtres cote frontend."""

    brands: list[str]
    seasons: list[str]
    price_min: float
    price_max: float


class SearchResponse(BaseModel):
    items: list[TyreResult]      # uniquement la page demandee
    total: int                   # total apres filtres (avant pagination)
    page: int
    per_page: int
    pages: int                   # nombre de pages total
    facets: SearchFacets
