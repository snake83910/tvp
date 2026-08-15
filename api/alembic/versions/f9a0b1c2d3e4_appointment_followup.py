"""appointment follow-up

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-08-15 21:00:00.000000

Suivi des rendez-vous de montage :
  - la livraison estimée est figée sur la commande, pour que le client
    puisse redéplacer son rendez-vous après le checkout (son panier
    n'existe plus à ce moment-là) ;
  - deux horodatages anti-doublon pour le rappel J-1 et l'alerte
    « pneus pas encore expédiés » ;
  - table des créneaux bloqués manuellement par le garage (rendez-vous
    pris par téléphone, immobilisation d'un pont…).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f9a0b1c2d3e4"
down_revision: Union[str, None] = "e8f9a0b1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("delivery_estimate", sa.Date(), nullable=True))
    op.add_column(
        "orders",
        sa.Column("appointment_reminded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column(
            "appointment_risk_notified_at", sa.DateTime(timezone=True), nullable=True
        ),
    )

    op.create_table(
        "garage_slot_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("garage_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(length=200), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["garage_id"], ["garages.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_garage_slot_blocks_garage_starts",
        "garage_slot_blocks",
        ["garage_id", "starts_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_garage_slot_blocks_garage_starts", table_name="garage_slot_blocks"
    )
    op.drop_table("garage_slot_blocks")
    op.drop_column("orders", "appointment_risk_notified_at")
    op.drop_column("orders", "appointment_reminded_at")
    op.drop_column("orders", "delivery_estimate")
