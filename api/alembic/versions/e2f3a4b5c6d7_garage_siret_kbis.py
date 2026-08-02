"""garage siret + kbis

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-08-02 12:00:00.000000

Ajoute garages.siret et garages.kbis_path pour la vérification
anti-fraude des garages partenaires (SIRET + document Kbis).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("garages", sa.Column("siret", sa.String(length=20), nullable=True))
    op.add_column("garages", sa.Column("kbis_path", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("garages", "kbis_path")
    op.drop_column("garages", "siret")
