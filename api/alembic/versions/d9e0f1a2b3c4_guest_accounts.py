"""users.is_guest : distinguer le compte né d'une commande

Un compte créé par le tunnel invité n'a jamais choisi son mot de passe
et son adresse email n'a rien prouvé. C'est lui — et lui seul — qui doit
confirmer son adresse par code avant de payer. Sans ce drapeau, la règle
frapperait aussi les clients inscrits, au pire moment : devant leur
carte bancaire.

Rétroactif impossible et assumé : rien en base ne distingue les comptes
invités déjà créés (même table, même forme). Ils restent marqués comme
inscrits ; leur prochaine commande passera sans vérification. Le drapeau
ne vaut que pour la suite.

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d9e0f1a2b3c4"
down_revision: Union[str, None] = "c8d9e0f1a2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_guest",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "is_guest")
