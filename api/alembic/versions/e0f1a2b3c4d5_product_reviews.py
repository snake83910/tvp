"""Avis produits vérifiés

Sur invitation uniquement : la table porte l'identifiant de la commande,
qui est la preuve d'achat. La contrainte d'unicité (commande, référence)
est en base et pas seulement dans le code — le lien d'invitation peut
être rejoué, et deux onglets ouverts suffisent à doubler l'envoi.

`orders.product_review_requested_at` distingue cette sollicitation de
celle qui porte sur le garage : elles ne concernent pas les mêmes
commandes (toutes les livraisons contre les seuls montages partenaires)
et ne partent donc pas ensemble.

Revision ID: e0f1a2b3c4d5
Revises: d9e0f1a2b3c4
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e0f1a2b3c4d5"
down_revision: Union[str, None] = "d9e0f1a2b3c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "order_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("supplier_ref", sa.String(64), nullable=False),
        sa.Column("label_snapshot", sa.String(255), nullable=False),
        sa.Column("author_name", sa.String(120), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "is_published", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column("moderation_reason", sa.String(255), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.UniqueConstraint("order_id", "supplier_ref", name="uq_review_order_ref"),
        # Note comprise entre 1 et 5, garantie en base : une note à 11
        # fausserait la moyenne affichée, et Google refuse un
        # AggregateRating hors bornes.
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="ck_review_rating"),
    )
    op.create_index("ix_product_reviews_order_id", "product_reviews", ["order_id"])
    op.create_index("ix_product_reviews_user_id", "product_reviews", ["user_id"])
    op.create_index("ix_product_reviews_created_at", "product_reviews", ["created_at"])
    # La fiche produit ne lit QUE les avis publiés d'une référence :
    # index partiel, sur exactement cette question.
    op.create_index(
        "ix_reviews_ref_published",
        "product_reviews",
        ["supplier_ref"],
        postgresql_where=sa.text("is_published"),
    )

    op.add_column(
        "orders",
        sa.Column(
            "product_review_requested_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("orders", "product_review_requested_at")
    op.drop_table("product_reviews")
