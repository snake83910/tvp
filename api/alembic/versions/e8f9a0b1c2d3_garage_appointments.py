"""garage appointments

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-08-15 10:00:00.000000

Prise de rendez-vous de montage en ligne : réglages par garage
(activation, durée de créneau, véhicules en parallèle, délai minimum
après la livraison estimée) + index de recherche des créneaux déjà pris.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e8f9a0b1c2d3"
down_revision: Union[str, None] = "d7e8f9a0b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "garages",
        sa.Column(
            "appointments_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "garages",
        sa.Column(
            "slot_minutes", sa.Integer(), nullable=False, server_default="30"
        ),
    )
    op.add_column(
        "garages",
        sa.Column(
            "slot_capacity", sa.Integer(), nullable=False, server_default="1"
        ),
    )
    op.add_column(
        "garages",
        sa.Column(
            "appointment_lead_days",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )
    # Comptage des créneaux déjà réservés : toujours filtré sur (garage,
    # plage de dates de montage).
    op.create_index(
        "ix_orders_garage_mounting_at",
        "orders",
        ["garage_id", "mounting_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_orders_garage_mounting_at", table_name="orders")
    op.drop_column("garages", "appointment_lead_days")
    op.drop_column("garages", "slot_capacity")
    op.drop_column("garages", "slot_minutes")
    op.drop_column("garages", "appointments_enabled")
