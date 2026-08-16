"""Surcharges de templates d'email, éditables depuis l'administration.

Les templates par défaut restent des FICHIERS versionnés : c'est eux
qu'on relit dans une revue de code, eux qui partent en production, et
eux qui font foi quand tout le reste est perdu. Cette table ne contient
que les surcharges — un template non modifié n'y a pas de ligne, et
« réinitialiser » se réduit à supprimer la sienne.

Ce choix évite le piège classique du contenu en base : une migration qui
corrige une coquille dans un fichier n'aurait aucun effet si la base
portait une copie de l'ancien texte pour chaque template.
"""
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    #: Nom du fichier (« order_confirmation.html »), clé naturelle.
    name: Mapped[str] = mapped_column(String(120), primary_key=True)
    html: Mapped[str] = mapped_column(Text)
    #: Qui a modifié, pour retrouver l'auteur d'une formulation.
    updated_by: Mapped[str | None] = mapped_column(String(320))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
