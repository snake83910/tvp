"""order tracking fields

Revision ID: b2e1c3f4a5d6
Revises: 44e3998e9f6a
Create Date: 2026-06-13 00:00:00.000000

Ajoute tracking_number, carrier, tracking_url à la table orders.
Renseignés par l'admin lors du passage en statut shipped.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2e1c3f4a5d6"
down_revision: Union[str, None] = "44e3998e9f6a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("tracking_number", sa.String(120), nullable=True))
    op.add_column("orders", sa.Column("carrier", sa.String(80), nullable=True))
    op.add_column("orders", sa.Column("tracking_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "tracking_url")
    op.drop_column("orders", "carrier")
    op.drop_column("orders", "tracking_number")
