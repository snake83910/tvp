"""garage config (paiement, congés, tarifs, photos)

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
Create Date: 2026-08-02 15:00:00.000000

Ajoute les champs de configuration de la fiche garage pour le back-office
partenaire : moyens de paiement, périodes de fermeture, grille tarifaire
de montage, photos.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b5c6d7e8f9a0"
down_revision: Union[str, None] = "a4b5c6d7e8f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_JSON_LIST = sa.text("'[]'::jsonb")


def upgrade() -> None:
    for col in ("payment_methods", "closures", "pricing", "photos"):
        op.add_column(
            "garages",
            sa.Column(
                col,
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=_JSON_LIST,
            ),
        )


def downgrade() -> None:
    for col in ("photos", "pricing", "closures", "payment_methods"):
        op.drop_column("garages", col)
