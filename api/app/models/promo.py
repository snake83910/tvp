"""Codes promo paramétrables depuis l'admin.

Le nombre d'utilisations n'est PAS un compteur stocké : il est calculé
à la validation en comptant les commandes non annulées portant le code.
Zéro dérive possible (commande abandonnée/annulée = utilisation rendue).
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Toujours stocké en MAJUSCULES (normalisé à la création/validation)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(255))

    # "percent" (valeur = %) ou "amount" (valeur = centimes TTC)
    discount_type: Mapped[str] = mapped_column(String(10))
    discount_value: Mapped[int] = mapped_column(Integer)

    # Montant minimum d'articles TTC (centimes) pour utiliser le code
    min_articles_ttc_cents: Mapped[int] = mapped_column(Integer, default=0)

    # Fenêtre de validité (bornes optionnelles)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Limites d'utilisation (None = illimité)
    max_uses: Mapped[int | None] = mapped_column(Integer)
    once_per_user: Mapped[bool] = mapped_column(Boolean, default=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
