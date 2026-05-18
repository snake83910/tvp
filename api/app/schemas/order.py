import uuid

from pydantic import BaseModel


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
    id: uuid.UUID
    session_token: str | None
    items: list[CartItemOut]
    total_ht: float
    total_ttc: float


class PriceChangeOut(BaseModel):
    supplier_ref: str
    label: str
    old_ttc: float
    new_ttc: float


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


class OrderOut(BaseModel):
    order_number: str
    status: str
    total_ht: float
    total_vat: float
    total_ttc: float
