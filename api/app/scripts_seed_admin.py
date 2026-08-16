"""Crée (ou remet à niveau) un compte admin de test.

Aucun endpoint ne crée d'admin — et c'est très bien ainsi. Mais les tests
de bout en bout de l'espace admin ont besoin d'un compte, et la base de
CI part vide à chaque exécution.

Usage :
    docker compose exec api python -m app.scripts_seed_admin <email> <mot-de-passe>

Refuse de s'exécuter si `ENVIRONMENT=production` : ce script fabrique un
accès complet à l'administration, il n'a rien à faire sur la production.
Le 2FA n'est pas activé — le compte créé est fait pour être piloté par un
test, pas pour administrer un vrai site.
"""
import asyncio
import sys

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User, UserRole


async def main(email: str, password: str) -> None:
    if settings.environment == "production":
        print("REFUS : pas de création d'admin en production.")
        sys.exit(1)

    email = email.lower().strip()
    async with SessionLocal() as db:
        user = await db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, password_hash=hash_password(password))
            db.add(user)
        user.password_hash = hash_password(password)
        user.role = UserRole.admin
        user.is_active = True
        user.email_verified = True
        await db.commit()
        print(f"OK  admin={email}  2fa={user.totp_enabled}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    asyncio.run(main(sys.argv[1], sys.argv[2]))
