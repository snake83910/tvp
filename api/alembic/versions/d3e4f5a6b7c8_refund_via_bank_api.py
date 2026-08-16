"""remboursement exécuté par l'API bancaire

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-08-16 17:00:00.000000

Le remboursement passe désormais par Transaction/CancelOrRefund. On
conserve la réponse de la banque, seule preuve exploitable si le client
conteste, et on distingue les deux origines :

  - `refund_mode = 'sogecommerce'` : exécuté par l'API, tracé ;
  - `refund_mode = 'manual'` : quelqu'un affirme l'avoir fait au Back
    Office. La nuance compte le jour d'une réclamation.

Les remboursements antérieurs sont marqués `manual` : ils ont tous été
saisis à la main, aucun n'a de preuve bancaire attachée.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders", sa.Column("refund_mode", sa.String(length=20), nullable=True)
    )
    op.add_column(
        "payments", sa.Column("refund_ref", sa.String(length=120), nullable=True)
    )
    op.add_column(
        "payments",
        sa.Column(
            "refund_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
    )
    op.execute(
        "UPDATE orders SET refund_mode = 'manual' "
        "WHERE refunded_cents IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column("payments", "refund_payload")
    op.drop_column("payments", "refund_ref")
    op.drop_column("orders", "refund_mode")
