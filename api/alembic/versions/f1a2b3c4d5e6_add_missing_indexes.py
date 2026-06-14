"""add_missing_indexes — index sur user_id des tables fréquemment filtrées

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2026-06-14 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_orders_user_id", "orders", ["user_id"])
    op.create_index("ix_carts_user_id", "carts", ["user_id"])
    op.create_index("ix_addresses_user_id", "addresses", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_orders_user_id", table_name="orders")
    op.drop_index("ix_carts_user_id", table_name="carts")
    op.drop_index("ix_addresses_user_id", table_name="addresses")
