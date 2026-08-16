"""index de purge, et suppression d'un index en double

Revision ID: a6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-08-16 22:00:00.000000

Deux corrections sur les tables qui grossissent le plus vite.

1. Le job de purge quotidien filtre sur `refresh_tokens.expires_at`,
   `refresh_tokens.revoked_at` et `carts.updated_at` — aucune n'était
   indexée. Aujourd'hui les tables sont petites et ça ne se voit pas ;
   dans un an la purge nocturne balaierait intégralement les deux
   tables les plus actives du site.

2. `refresh_tokens.token_hash` portait DEUX index uniques identiques :
   l'un créé par la contrainte `unique=True`, l'autre par `index=True`
   sur la même colonne. Doublon pur — double coût d'écriture à chaque
   connexion et à chaque rafraîchissement de session, double stockage,
   aucun gain en lecture. Le modèle a été corrigé pour ne plus le
   recréer.

Les créations sont CONCURRENTLY : sans ça, un CREATE INDEX verrouille
`refresh_tokens` en écriture le temps de sa construction — soit un
déploiement pendant lequel personne ne peut se connecter.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "a6b7c8d9e0f1"
down_revision: Union[str, None] = "f5a6b7c8d9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # CONCURRENTLY interdit l'exécution dans une transaction : Alembic
    # en ouvre une par défaut, d'où le bloc en autocommit.
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS "
            "ix_refresh_tokens_expires_at ON refresh_tokens (expires_at)"
        )
        # Index PARTIEL : seules les lignes révoquées intéressent la
        # purge, et elles sont minoritaires. L'index reste petit.
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS "
            "ix_refresh_tokens_revoked_at ON refresh_tokens (revoked_at) "
            "WHERE revoked_at IS NOT NULL"
        )
        # Idem : la purge ne vise que les paniers anonymes.
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS "
            "ix_carts_anonymous_updated_at ON carts (updated_at) "
            "WHERE user_id IS NULL"
        )
        # Le doublon. La contrainte UNIQUE conserve son propre index :
        # l'unicité de token_hash reste garantie.
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_refresh_tokens_token_hash")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "
            "ix_refresh_tokens_token_hash ON refresh_tokens (token_hash)"
        )
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_carts_anonymous_updated_at")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_refresh_tokens_revoked_at")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_refresh_tokens_expires_at")
