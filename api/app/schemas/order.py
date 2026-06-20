import uuid

from pydantic import BaseModel
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
