"""orders.admin_note — note interne admin

Revision ID: e6a7b8c9d0e1
Revises: c3d4e5f6a7b8
Create Date: 2026-06-14 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e6a7b8c9d0e1"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("admin_note", sa.String(2000), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "admin_note")
