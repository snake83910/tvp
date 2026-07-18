"""Normalise les emails existants en minuscules.

La connexion cherche l'email en lowercase (auth.service) alors que
l'inscription stockait l'email tel que saisi : un compte créé avec des
majuscules était introuvable au login. Les nouvelles inscriptions sont
désormais normalisées côté schéma (NormalizedEmail) ; cette migration
rattrape l'existant.

Cas limite : si deux comptes ne diffèrent que par la casse (rendus
possibles par l'ancien bug), on ne touche pas au doublon pour ne pas
violer la contrainte unique — à résoudre manuellement.

Revision ID: a8b9c0d1e2f3
Revises: f7b8c9d0e1f2
Create Date: 2026-07-18
"""
from typing import Sequence, Union

from alembic import op

revision: str = "a8b9c0d1e2f3"
down_revision: Union[str, None] = "f7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE users u
        SET email = lower(email)
        WHERE email <> lower(email)
          AND NOT EXISTS (
            SELECT 1 FROM users v
            WHERE v.email = lower(u.email) AND v.id <> u.id
          )
        """
    )


def downgrade() -> None:
    # Irréversible : la casse d'origine est perdue (sans conséquence,
    # la partie locale d'un email est insensible à la casse en pratique).
    pass
