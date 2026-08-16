"""réglages modifiables depuis l'administration

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-08-16 20:00:00.000000

Premier usage : le choix du fournisseur d'immatriculation. Il doit être
basculable sans redéploiement — un fournisseur qui tombe se contourne
depuis le navigateur, pas depuis un shell SSH.

Table clé/valeur : ajouter un réglage ne demandera pas de migration.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(length=60), primary_key=True),
        sa.Column("value", sa.String(length=500), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
