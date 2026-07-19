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
    # float : poids lourd en 17.5 / 19.5 / 22.5 pouces
    diameter: float | None
    load_index: int | None
    speed_rating: str | None
    # Famille de véhicule de la recherche (auto/moto/quad/camion/agricole)
    category: str = "auto"
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
    # Enrichissements (optionnels)
    brand_slug: str | None = None
    ean: str | None = None
    eprel_id: int | None = None
    description_html: str | None = None
    is_runflat: bool = False
    is_xl: bool = False
    is_3pmsf: bool = False
    is_studded: bool = False
    stock: int | None = None
    delivery_estimate: str | None = None


class SearchFacets(BaseModel):
    """Valeurs reellement presentes dans les resultats, pour construire
    dynamiquement la barre de filtres cote frontend."""

    brands: list[str]
    # Nombre de pneus par marque (avant filtre marque) : permet au front
    # d'afficher "Michelin (12)" dans les cases à cocher.
    brand_counts: dict[str, int] = {}
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
