"""order_number_seq — numérotation séquentielle des commandes

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-14 00:00:00.000000

Remplace la génération aléatoire (TVP-XXXXXXXX) par une séquence
PostgreSQL atomique : TVP-00001, TVP-00002, …
"""
from typing import Sequence, Union

from alembic import op


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1 INCREMENT 1 NO CYCLE")


def downgrade() -> None:
    op.execute("DROP SEQUENCE IF EXISTS order_number_seq")
