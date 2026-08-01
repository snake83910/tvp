"""garages partenaires + rattachement commande

Revision ID: d1e2f3a4b5c6
Revises: c0d1e2f3a4b5
Create Date: 2026-08-02 00:00:00.000000

Crée la table des garages partenaires (montage) avec géocodage lat/lng,
et ajoute orders.garage_id / orders.garage_snapshot pour rattacher une
commande à un garage choisi au checkout.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c0d1e2f3a4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "garages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=220), nullable=False),
        sa.Column("address", sa.String(length=300), nullable=False),
        sa.Column("postal_code", sa.String(length=10), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "hours",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("mounting_price_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "services",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("photo_url", sa.String(length=500), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_garages_slug", "garages", ["slug"], unique=True)
    op.create_index("ix_garages_postal_code", "garages", ["postal_code"], unique=False)
    op.create_index("ix_garages_owner_user_id", "garages", ["owner_user_id"], unique=False)

    op.add_column(
        "orders",
        sa.Column("garage_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column(
            "garage_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.create_index("ix_orders_garage_id", "orders", ["garage_id"], unique=False)
    op.create_foreign_key(
        "fk_orders_garage_id", "orders", "garages", ["garage_id"], ["id"], ondelete="SET NULL"
    )


def downgrade() -> None:
    op.drop_constraint("fk_orders_garage_id", "orders", type_="foreignkey")
    op.drop_index("ix_orders_garage_id", table_name="orders")
    op.drop_column("orders", "garage_snapshot")
    op.drop_column("orders", "garage_id")

    op.drop_index("ix_garages_owner_user_id", table_name="garages")
    op.drop_index("ix_garages_postal_code", table_name="garages")
    op.drop_index("ix_garages_slug", table_name="garages")
    op.drop_table("garages")
