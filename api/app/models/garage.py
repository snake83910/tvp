import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Garage(Base):
    """Garage partenaire pour le montage des pneus.

    Géocodé (lat/lng) à l'enregistrement pour proposer les garages les
    plus proches d'une adresse client. Le prix de montage est stocké en
    centimes (jamais de float pour l'argent), par pneu.
    """

    __tablename__ = "garages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Compte propriétaire (rôle garage) qui gère la page — Phase 2. Optionnel :
    # un garage peut exister sans compte associé (créé par l'admin).
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True)

    address: Mapped[str] = mapped_column(String(300))
    postal_code: Mapped[str] = mapped_column(String(10), index=True)
    city: Mapped[str] = mapped_column(String(120))
    # Coordonnées géocodées (Base Adresse Nationale). Nullable tant que le
    # géocodage n'a pas abouti.
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)

    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(320))
    # Numéro SIRET (14 chiffres) et chemin du Kbis uploadé — vérification
    # anti-fraude à la validation par l'admin.
    siret: Mapped[str | None] = mapped_column(String(20))
    kbis_path: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    # Horaires libres par jour : {"lundi": "08:00-18:00", ...}
    hours: Mapped[dict] = mapped_column(JSONB, default=dict)
    # Prix du montage par pneu, en centimes
    mounting_price_cents: Mapped[int] = mapped_column(Integer, default=0)
    # Prestations incluses : ["equilibrage", "valve", "recyclage", ...]
    services: Mapped[list] = mapped_column(JSONB, default=list)
    photo_url: Mapped[str | None] = mapped_column(String(500))

    is_published: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
