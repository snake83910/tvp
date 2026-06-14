"""invoice_number sequence

Revision ID: d4e5f6a7b8c9
Revises: b2e1c3f4a5d6
Create Date: 2026-06-14 00:00:00.000000

Ajoute invoice_number (int unique nullable) à la table orders et crée
la séquence PostgreSQL invoice_number_seq.

La séquence garantit unicité et ordre chronologique sans race condition :
  SELECT nextval('invoice_number_seq')
est atomique même sous charge concurrente.

Le numéro est assigné une seule fois, au moment où le paiement est
confirmé (statut paid). Les commandes non payées (annulées, abandonnées)
n'ont pas de numéro de facture.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "b2e1c3f4a5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1 INCREMENT 1 NO CYCLE")
    op.add_column(
        "orders",
        sa.Column("invoice_number", sa.Integer(), nullable=True, unique=True),
    )


def downgrade() -> None:
    op.drop_column("orders", "invoice_number")
    op.execute("DROP SEQUENCE IF EXISTS invoice_number_seq")
