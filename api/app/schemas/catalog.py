from datetime import datetime

from pydantic import BaseModel, Field


class VehicleDimension(BaseModel):
    width: int
    height: int
    diameter: int
    load_index: str
    speed_rating: str


class PlateLookupOut(BaseModel):
    """Résultat d'une recherche par plaque.

    `vehicle` est facultatif : seul le fournisseur officiel donne
    l'identité du véhicule, le repli ne rend que des pneus. Le front
    doit donc l'afficher s'il existe, sans réserver de place vide.
    """

    vehicle: str | None = None
    #: Logo de la marque, servi par le fournisseur. Facultatif : absent
    #: du repli, et absent de certaines marques chez le fournisseur
    #: officiel. L'affichage doit prévoir de s'en passer.
    brand_logo: str | None = None
    dimensions: list[VehicleDimension] = []


class MarketPrice(BaseModel):
    """Relevé de prix chez un site concurrent (comparateur)."""

    price: float          # prix TTC constaté chez le concurrent
    host: str             # nom de domaine du concurrent
    url: str | None = None
    date: str | None = None  # ISO 8601 : date du relevé


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
    # Gamme de la marque : "premium" / "quality" / "discount"
    brand_tier: str | None = None
    ean: str | None = None
    eprel_id: int | None = None
    description_html: str | None = None
    is_runflat: bool = False
    is_xl: bool = False
    is_3pmsf: bool = False
    is_studded: bool = False
    stock: int | None = None
    delivery_estimate: str | None = None
    # Relevés de prix concurrents (comparateur fiche produit)
    market_prices: list[MarketPrice] = []


class SearchFacets(BaseModel):
    """Valeurs reellement presentes dans les resultats, pour construire
    dynamiquement la barre de filtres cote frontend."""

    brands: list[str]
    # Nombre de pneus par marque (avant filtre marque) : permet au front
    # d'afficher "Michelin (12)" dans les cases à cocher.
    brand_counts: dict[str, int] = {}
    seasons: list[str]
    # Gammes présentes dans les résultats (premium / quality / discount)
    tiers: list[str] = []
    price_min: float
    price_max: float


class SearchResponse(BaseModel):
    items: list[TyreResult]      # uniquement la page demandee
    total: int                   # total apres filtres (avant pagination)
    page: int
    per_page: int
    pages: int                   # nombre de pages total
    facets: SearchFacets


# ── Avis produits ────────────────────────────────────────────────

class ReviewItemOut(BaseModel):
    """Un produit notable de la commande."""

    supplier_ref: str
    label: str
    already_reviewed: bool = False


class ReviewContextOut(BaseModel):
    order_number: str
    items: list[ReviewItemOut]


class ReviewNoteIn(BaseModel):
    supplier_ref: str
    rating: int = Field(ge=1, le=5)
    # 2000 caractères : au-delà, personne ne lit, et le champ devient une
    # surface d'abus.
    comment: str | None = Field(default=None, max_length=2000)


class ReviewSubmitIn(BaseModel):
    """Le jeton tient lieu d'authentification : le client invité n'a pas
    de mot de passe, et lui en faire inventer un pour noter ses pneus
    ferait perdre l'avis."""

    token: str
    reviews: list[ReviewNoteIn] = Field(min_length=1, max_length=20)


class ProductReviewOut(BaseModel):
    """Avis tel qu'affiché. Ni email, ni nom complet, ni numéro de
    commande : la page est publique et indexée."""

    author_name: str
    rating: int
    comment: str | None = None
    # La date est OBLIGATOIRE à l'affichage (art. L111-7-2) : un avis
    # sans date laisse croire qu'il est récent.
    created_at: datetime


class ReviewsBlockOut(BaseModel):
    count: int
    average: float
    reviews: list[ProductReviewOut] = []
