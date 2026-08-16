"""surcharges de templates d'email

Revision ID: b7c8d9e0f1a2
Revises: a6b7c8d9e0f1
Create Date: 2026-08-16 23:00:00.000000

Les templates par defaut restent des fichiers versionnes. Cette table ne
porte que les surcharges saisies depuis l'administration : un template
non modifie n'y a pas de ligne, et « reinitialiser » supprime la sienne.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, None] = "a6b7c8d9e0f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_templates",
        sa.Column("name", sa.String(length=120), primary_key=True),
        sa.Column("html", sa.Text(), nullable=False),
        sa.Column("updated_by", sa.String(length=320), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("email_templates")
