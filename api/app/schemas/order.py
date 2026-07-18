import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime

class AddItemIn(BaseModel):
    supplier_ref: str
    width: int
    ratio: int
    diameter: int
    quantity: int = 2  # défaut métier pneu : par essieu


class UpdateQtyIn(BaseModel):
    quantity: int


class CartItemOut(BaseModel):
    id: uuid.UUID
    supplier_ref: str
    label: str
    quantity: int
    price_ht: float
    price_ttc: float
    # Enrichissements d'affichage (depuis product_data ; None pour les
    # lignes créées avant que le snapshot ne les stocke)
    dimension: str | None = None
    image_url: str | None = None
    season: str | None = None


class CartOut(BaseModel):
    id: uuid.UUID | None = None
    session_token: str | None = None
    items: list[CartItemOut] = []
    total_ht: float = 0
    total_ttc: float = 0


class PriceChangeOut(BaseModel):
    supplier_ref: str
    label: str
    old_ttc: float
    new_ttc: float

class CheckoutIn(BaseModel):
    address_id: uuid.UUID
    delivery_mode: str = "home"
    accept_terms: bool
    promo_code: str | None = None


class PromoCodeIn(BaseModel):
    """Création/édition d'un code promo (admin)."""
    code: str = Field(min_length=3, max_length=40)
    description: str | None = Field(default=None, max_length=255)
    discount_type: str  # "percent" | "amount"
    discount_value: int = Field(gt=0)
    min_articles_ttc_cents: int = Field(default=0, ge=0)
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    max_uses: int | None = Field(default=None, ge=1)
    once_per_user: bool = False
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def _normalize_code(cls, v: str) -> str:
        v = v.strip().upper()
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError(
                "Code : lettres, chiffres, tirets et underscores uniquement"
            )
        return v

    @field_validator("discount_type")
    @classmethod
    def _check_type(cls, v: str) -> str:
        if v not in ("percent", "amount"):
            raise ValueError("discount_type : 'percent' ou 'amount'")
        return v

    @field_validator("discount_value")
    @classmethod
    def _check_value(cls, v: int, info) -> int:
        if info.data.get("discount_type") == "percent" and v > 100:
            raise ValueError("Un pourcentage ne peut pas dépasser 100")
        return v


class PromoCodeUpdate(BaseModel):
    """Édition partielle (admin) — tous les champs optionnels."""
    description: str | None = None
    discount_type: str | None = None
    discount_value: int | None = Field(default=None, gt=0)
    min_articles_ttc_cents: int | None = Field(default=None, ge=0)
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    max_uses: int | None = Field(default=None, ge=1)
    once_per_user: bool | None = None
    is_active: bool | None = None


class PromoCodeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    description: str | None
    discount_type: str
    discount_value: int
    min_articles_ttc_cents: int
    valid_from: datetime | None
    valid_until: datetime | None
    max_uses: int | None
    once_per_user: bool
    is_active: bool
    created_at: datetime
    # Utilisations = commandes non annulées portant ce code
    uses: int = 0


class PromoValidateIn(BaseModel):
    code: str


class PromoValidateOut(BaseModel):
    valid: bool
    reason: str | None = None
    code: str | None = None
    description: str | None = None
    discount_ttc: float = 0
    
class CheckoutResult(BaseModel):
    # Si price_changes non vide : commande NON créée, confirmation requise
    order_number: str | None = None
    status: str | None = None
    total_ttc: float | None = None
    price_changes: list[PriceChangeOut] = []


class PaymentInitOut(BaseModel):
    provider: str
    provider_ref: str
    form_token: str
    amount_cents: int
    public_key: str = ""


class OrderOut(BaseModel):
    order_number: str
    status: str
    total_ht: float
    total_vat: float
    total_ttc: float


class OrderSummary(BaseModel):
    order_number: str
    status: str
    created_at: datetime
    total_ttc: float
    item_count: int


class OrderItemDetail(BaseModel):
    supplier_ref: str
    label: str
    quantity: int
    unit_price_ht: float
    unit_price_ttc: float
    line_total_ttc: float


class OrderDetail(BaseModel):
    order_number: str
    status: str
    created_at: datetime
    paid_at: datetime | None

    # Adresse de livraison figée
    delivery_mode: str
    shipping_address: dict

    # Numéro de facture (assigné au paiement)
    invoice_number: int | None = None

    # Code promo appliqué + remise TTC (0 si aucun)
    promo_code: str | None = None
    discount_ttc: float = 0

    # Suivi expédition (visible client uniquement si statut shipped/delivered)
    tracking_number: str | None = None
    carrier: str | None = None
    tracking_url: str | None = None

    # Articles
    items: list[OrderItemDetail]

    # Montants (en €)
    articles_ht: float
    articles_ttc: float
    shipping_ht: float
    shipping_ttc: float
    total_ht: float
    total_vat: float
    total_ttc: float


# ── Admin ──────────────────────────────────────────────────────────

class AdminOrderSummary(BaseModel):
    order_number: str
    status: str
    created_at: datetime
    total_ttc: float
    item_count: int
    customer_email: str
    customer_name: str | None = None


class AdminOrderDetail(OrderDetail):
    customer_email: str
    customer_name: str | None = None
    allowed_transitions: list[str]
    admin_note: str | None = None


class StatusUpdateIn(BaseModel):
    status: str
    tracking_number: str | None = None
    carrier: str | None = None
    tracking_url: str | None = None
    cancel_reason: str | None = None


class AdminStats(BaseModel):
    orders_by_status: dict[str, int]
    revenue_total_ttc: float
    orders_today: int
    revenue_today_ttc: float
    # Étendu
    orders_30d: int = 0
    revenue_30d_ttc: float = 0.0
    avg_cart_ttc: float = 0.0
    top_products: list[dict] = []  # [{ref, label, qty, revenue_ttc}]
    # Comparatif période précédente (jours -30..-60)
    revenue_prev30_ttc: float = 0.0
    orders_prev30: int = 0
