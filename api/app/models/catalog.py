import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(120), unique=True)
    connector: Mapped[str] = mapped_column(String(60))  # "maxityre"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PricingRule(Base):
    """
    La marge est une FONCTION paramétrable, pas une constante.
    La règle la plus prioritaire applicable gagne.

    Phase 2 : une seule règle par défaut (markup 10 %, tous publics).
    Le modèle gère déjà la différenciation future (account_type, marque...).
    """

    __tablename__ = "pricing_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # NULL = s'applique à tous
    account_type: Mapped[str | None] = mapped_column(String(20))
    price_tier: Mapped[str | None] = mapped_column(String(50))
    brand: Mapped[str | None] = mapped_column(String(80))

    markup_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=10.00)
    markup_floor: Mapped[float | None] = mapped_column(Numeric(8, 2))
    price_floor: Mapped[float | None] = mapped_column(Numeric(8, 2))
    rounding: Mapped[str] = mapped_column(String(10), default="psych")  # .90

    priority: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
