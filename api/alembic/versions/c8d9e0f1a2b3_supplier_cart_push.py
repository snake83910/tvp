"""transmission au panier fournisseur

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-08-17 00:00:00.000000

Chaque commande payee etait ressaisie a la main sur le site Maxityre.
L'ajout au panier est desormais declenche depuis l'administration ; ces
deux colonnes gardent la trace de la transmission et son compte rendu,
qui porte notamment le PRIX D'ACHAT du jour par article.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c8d9e0f1a2b3"
down_revision: Union[str, None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("supplier_pushed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column(
            "supplier_push_result",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("orders", "supplier_push_result")
    op.drop_column("orders", "supplier_pushed_at")
