"""vérification bancaire, montant remboursé, trace des jobs cron

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-08-16 15:00:00.000000

Trois manques qui se traitaient ensemble :

  - `payment_checked_at` / `payment_check_result` : la relance annulait
    les commandes au bout de 7 jours sans jamais demander à la banque si
    elle avait encaissé. Un IPN perdu suffisait à annuler la commande
    d'un client déjà débité.

  - `refunded_cents` / `refunded_at` : le statut « remboursée » ne
    portait aucun montant ni aucune date. Impossible de vérifier après
    coup qu'un remboursement avait réellement eu lieu.

  - `cron_runs` : rien n'indiquait qu'un job planifié tournait encore.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("payment_checked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("payment_check_result", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "orders", sa.Column("refunded_cents", sa.Integer(), nullable=True)
    )
    op.add_column(
        "orders",
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "cron_runs",
        sa.Column("job", sa.String(length=50), primary_key=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status", sa.String(length=10), server_default="ok", nullable=False
        ),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column(
            "detail",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("cron_runs")
    op.drop_column("orders", "refunded_at")
    op.drop_column("orders", "refunded_cents")
    op.drop_column("orders", "payment_check_result")
    op.drop_column("orders", "payment_checked_at")
