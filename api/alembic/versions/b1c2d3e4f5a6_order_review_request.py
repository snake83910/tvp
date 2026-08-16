"""order delivered_at + review_requested_at

Revision ID: b1c2d3e4f5a6
Revises: f9a0b1c2d3e4
Create Date: 2026-08-16 10:00:00.000000

Solliciter un avis quelques jours après la livraison suppose de savoir
QUAND la livraison a eu lieu — le statut seul ne le dit pas. On ajoute
donc l'horodatage du passage en « livrée », plus celui de la demande
d'avis pour ne la poser qu'une fois.

Les commandes déjà livrées avant cette migration héritent de
`review_requested_at = now()` : sans ça, le premier passage du cron
enverrait d'un coup une demande d'avis à tout l'historique.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, None] = "f9a0b1c2d3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("review_requested_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "UPDATE orders SET review_requested_at = now() "
        "WHERE status = 'delivered'"
    )


def downgrade() -> None:
    op.drop_column("orders", "review_requested_at")
    op.drop_column("orders", "delivered_at")
