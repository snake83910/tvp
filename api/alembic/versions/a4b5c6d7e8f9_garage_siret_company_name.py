"""garage siret_company_name

Revision ID: a4b5c6d7e8f9
Revises: f3a4b5c6d7e8
Create Date: 2026-08-02 14:00:00.000000

Ajoute garages.siret_company_name : raison sociale officielle renvoyée
par Sirene, stockée pour comparaison par l'admin.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a4b5c6d7e8f9"
down_revision: Union[str, None] = "f3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "garages",
        sa.Column("siret_company_name", sa.String(length=300), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("garages", "siret_company_name")
