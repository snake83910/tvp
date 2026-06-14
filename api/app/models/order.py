import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


# --------------------------------------------------------------------------
#  Machine à états de commande
# --------------------------------------------------------------------------

class OrderStatus(str, enum.Enum):
    cart = "cart"                       # panier, pas encore validé
    pending_payment = "pending_payment" # checkout fait, en attente de paiement
    paid = "paid"                       # paiement confirmé (IPN)
    sent_to_supplier = "sent_to_supplier"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"
    refunded = "refunded"


# Transitions AUTORISÉES. Toute transition hors de cette table est refusée :
# pas de saut d'état possible (ex. cart -> shipped directement).
ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.cart: {OrderStatus.pending_payment, OrderStatus.cancelled},
    OrderStatus.pending_payment: {
        OrderStatus.paid,
        OrderStatus.cancelled,
    },
    OrderStatus.paid: {
        OrderStatus.sent_to_supplier,
        OrderStatus.refunded,
    },
    OrderStatus.sent_to_supplier: {
        OrderStatus.shipped,
        OrderStatus.refunded,
    },
    OrderStatus.shipped: {OrderStatus.delivered, OrderStatus.refunded},
    OrderStatus.delivered: {OrderStatus.refunded},
    OrderStatus.cancelled: set(),   # état terminal
    OrderStatus.refunded: set(),    # état terminal
}


class InvalidTransition(Exception):
    """Levée si on tente une transition d'état non autorisée."""


def assert_transition(current: OrderStatus, target: OrderStatus) -> None:
    if target not in ALLOWED_TRANSITIONS.get(current, set()):
        raise InvalidTransition(
            f"Transition interdite : {current.value} -> {target.value}"
        )


# --------------------------------------------------------------------------
#  Panier
# --------------------------------------------------------------------------

class Cart(Base):
    """
    Panier serveur. Soit rattaché à un user, soit anonyme via session_token.
    À la connexion, un panier anonyme fusionne dans celui du user.
    """

    __tablename__ = "carts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    session_token: Mapped[str | None] = mapped_column(
        String(64), index=True
    )  # panier anonyme
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    items: Mapped[list["CartItem"]] = relationship(
        back_populates="cart", cascade="all, delete-orphan"
    )


class CartItem(Base):
    """
    Ligne de panier. Le prix est FIGÉ à l'ajout (price_ht_snapshot) pour
    éviter les litiges : le client paie ce qu'il a vu. Le prix est revalidé
    contre Maxityre au checkout, avec alerte explicite si écart.
    """

    __tablename__ = "cart_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    cart_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("carts.id", ondelete="CASCADE")
    )
    supplier_ref: Mapped[str] = mapped_column(String(80))
    label_snapshot: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    # Prix figés au moment de l'ajout
    price_ht_snapshot: Mapped[float] = mapped_column()
    price_ttc_snapshot: Mapped[float] = mapped_column()
    snapshot_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    product_data: Mapped[dict] = mapped_column(JSONB, default=dict)

    cart: Mapped["Cart"] = relationship(back_populates="items")


# --------------------------------------------------------------------------
#  Commande
# --------------------------------------------------------------------------

class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_number: Mapped[str] = mapped_column(String(20), unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status"),
        default=OrderStatus.pending_payment,
    )
    # Type de compte FIGÉ à la commande (le compte peut changer après)
    account_type_snapshot: Mapped[str] = mapped_column(String(20))

    # Livraison : adresse figée à la commande (snapshot JSON pour
    # découpler de toute modification future côté compte) + mode.
    delivery_mode: Mapped[str] = mapped_column(
        String(20), default="home"
    )  # home | partner_garage (à venir)
    shipping_address: Mapped[dict] = mapped_column(
        JSONB, default=dict
    )
    # Frais de port en centimes (jamais de float pour l'argent)
    shipping_ht_cents: Mapped[int] = mapped_column(Integer, default=0)
    shipping_vat_cents: Mapped[int] = mapped_column(Integer, default=0)

    # Montants figés au checkout, en centimes (jamais de float pour l'argent)
    total_ht_cents: Mapped[int] = mapped_column(Integer, default=0)
    total_vat_cents: Mapped[int] = mapped_column(Integer, default=0)
    total_ttc_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")

    invoice_number: Mapped[int | None] = mapped_column(Integer, unique=True)
    tracking_number: Mapped[str | None] = mapped_column(String(120))
    carrier: Mapped[str | None] = mapped_column(String(80))
    tracking_url: Mapped[str | None] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )

    def transition_to(self, target: OrderStatus) -> None:
        """Change d'état en validant la transition. Lève si interdite."""
        assert_transition(self.status, target)
        self.status = target


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE")
    )
    supplier_ref: Mapped[str] = mapped_column(String(80))
    label_snapshot: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price_ht_cents: Mapped[int] = mapped_column(Integer)
    vat_rate: Mapped[float] = mapped_column(default=20.00)
    eco_tax_cents: Mapped[int] = mapped_column(Integer, default=0)

    order: Mapped["Order"] = relationship(back_populates="items")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id")
    )
    provider: Mapped[str] = mapped_column(String(30), default="simulated")
    provider_ref: Mapped[str | None] = mapped_column(String(120))
    amount_cents: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20))  # authorised/captured/failed
    ipn_payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    ipn_signature_ok: Mapped[bool | None] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
