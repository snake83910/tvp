"""checkout shipping fields on orders

Revision ID: 44e3998e9f6a
Revises: f10bac2ddd74
Create Date: 2026-06-13 00:00:00.000000

Ajoute les champs livraison à la table orders : delivery_mode,
shipping_address (JSONB), shipping_ht_cents, shipping_vat_cents.
Nécessaires pour finaliser le checkout (frais de port + adresse figée).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "44e3998e9f6a"
down_revision: Union[str, None] = "f10bac2ddd74"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column(
            "delivery_mode",
            sa.String(length=20),
            nullable=False,
            server_default="home",
        ),
    )
    op.add_column(
        "orders",
        sa.Column(
            "shipping_address",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "orders",
        sa.Column(
            "shipping_ht_cents",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "orders",
        sa.Column(
            "shipping_vat_cents",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("orders", "shipping_vat_cents")
    op.drop_column("orders", "shipping_ht_cents")
    op.drop_column("orders", "shipping_address")
    op.drop_column("orders", "delivery_mode")
