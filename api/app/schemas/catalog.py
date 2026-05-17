from pydantic import BaseModel


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
    # Prix calculé selon le compte courant.
    # purchase_ht n'est JAMAIS exposé ici.
    price_ht: float
    price_ttc: float
    # Prix mis en avant selon le type de client (pro -> HT, particulier -> TTC)
    display_price: float
    display_mode: str  # "HT" ou "TTC"
