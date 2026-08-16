"""Réglages modifiables depuis l'administration.

Distincts de `.env` : ceux-ci changent en cours d'exploitation, sans
redéploiement ni accès au serveur. Un fournisseur de données qui tombe
doit pouvoir être basculé depuis le navigateur, à 22 h, par quelqu'un
qui n'a pas de shell.

Table clé/valeur volontairement pauvre : deux colonnes, pas de schéma
par réglage. Chaque appelant sait ce qu'il lit et fournit son défaut —
c'est ce qui permet d'ajouter un réglage sans migration.
"""
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[str] = mapped_column(String(500))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
