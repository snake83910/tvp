"""orders billing address

Revision ID: c0d1e2f3a4b5
Revises: b9c0d1e2f3a4
Create Date: 2026-07-19 00:00:00.000000

Dissocie l'adresse de facturation de l'adresse de livraison : ajoute
orders.billing_address (JSONB, snapshot figé comme shipping_address).

Les commandes existantes n'avaient qu'une adresse : on la recopie en
facturation, ce qui préserve exactement le contenu des factures déjà
émises.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c0d1e2f3a4b5"
down_revision: Union[str, None] = "b9c0d1e2f3a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column(
            "billing_address",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.execute("UPDATE orders SET billing_address = shipping_address")


def downgrade() -> None:
    op.drop_column("orders", "billing_address")
