"""order mounting appointment

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-08-02 16:00:00.000000

Ajoute orders.mounting_at / mounting_note : rendez-vous de montage fixé
par le garage partenaire.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c6d7e8f9a0b1"
down_revision: Union[str, None] = "b5c6d7e8f9a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("mounting_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("orders", sa.Column("mounting_note", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "mounting_note")
    op.drop_column("orders", "mounting_at")
