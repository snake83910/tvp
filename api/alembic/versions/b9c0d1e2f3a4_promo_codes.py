"""Codes promo administrables + remise sur les commandes.

Revision ID: b9c0d1e2f3a4
Revises: a8b9c0d1e2f3
Create Date: 2026-07-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "b9c0d1e2f3a4"
down_revision: Union[str, None] = "a8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "promo_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(40), nullable=False, unique=True, index=True),
        sa.Column("description", sa.String(255)),
        sa.Column("discount_type", sa.String(10), nullable=False),
        sa.Column("discount_value", sa.Integer, nullable=False),
        sa.Column(
            "min_articles_ttc_cents", sa.Integer, nullable=False,
            server_default="0",
        ),
        sa.Column("valid_from", sa.DateTime(timezone=True)),
        sa.Column("valid_until", sa.DateTime(timezone=True)),
        sa.Column("max_uses", sa.Integer),
        sa.Column(
            "once_per_user", sa.Boolean, nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "is_active", sa.Boolean, nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
    )
    op.add_column("orders", sa.Column("promo_code", sa.String(40)))
    op.create_index("ix_orders_promo_code", "orders", ["promo_code"])
    op.add_column(
        "orders",
        sa.Column(
            "discount_ttc_cents", sa.Integer, nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_index("ix_orders_promo_code", table_name="orders")
    op.drop_column("orders", "discount_ttc_cents")
    op.drop_column("orders", "promo_code")
    op.drop_table("promo_codes")
