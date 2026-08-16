"""facture d'avoir : série dédiée AV

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-08-16 19:00:00.000000

Une facture émise ne se modifie ni ne s'annule : un remboursement se
matérialise par une facture rectificative — un avoir — qui référence la
facture d'origine et porte la TVA à régulariser (art. 289 et 272 du CGI).

Série DÉDIÉE (`AV-2026-000001`), distincte de la série des factures.
Comme pour `invoice_number_seq`, c'est une séquence PostgreSQL : la
numérotation doit être chronologique et sans trou, et un compteur
applicatif ne tiendrait pas face à deux workers concurrents.

Les remboursements ANTÉRIEURS reçoivent un numéro, attribué dans l'ordre
de leur date de remboursement. Sans ça ils resteraient sans pièce
comptable — et les numéroter après coup dans le désordre casserait la
chronologie de la série.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, None] = "d3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE SEQUENCE IF NOT EXISTS credit_note_number_seq "
        "START 1 INCREMENT 1 NO CYCLE"
    )
    op.add_column(
        "orders", sa.Column("credit_note_number", sa.Integer(), nullable=True)
    )
    op.create_unique_constraint(
        "uq_orders_credit_note_number", "orders", ["credit_note_number"]
    )

    # Rattrapage chronologique des remboursements déjà enregistrés.
    op.execute(
        """
        WITH ranked AS (
            SELECT id,
                   row_number() OVER (
                       ORDER BY refunded_at NULLS LAST, created_at
                   ) AS rang
            FROM orders
            WHERE refunded_cents IS NOT NULL
        )
        UPDATE orders o
        SET credit_note_number = ranked.rang
        FROM ranked
        WHERE o.id = ranked.id
        """
    )
    # La séquence repart après le dernier numéro attribué, sinon le
    # premier avoir réel entrerait en collision avec le rattrapage.
    op.execute(
        """
        SELECT setval(
            'credit_note_number_seq',
            GREATEST(
                (SELECT COALESCE(MAX(credit_note_number), 0) FROM orders), 1
            ),
            (SELECT COUNT(*) > 0 FROM orders WHERE credit_note_number IS NOT NULL)
        )
        """
    )


def downgrade() -> None:
    op.drop_constraint("uq_orders_credit_note_number", "orders", type_="unique")
    op.drop_column("orders", "credit_note_number")
    op.execute("DROP SEQUENCE IF EXISTS credit_note_number_seq")
