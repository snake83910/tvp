"""Supprime les comptes de test et tout ce qui en dépend.

Les suites e2e créent un compte par exécution (commande sans compte,
inscriptions), et les vérifications manuelles en laissent d'autres. La
base de développement finit encombrée de dizaines de faux clients et de
commandes qui brouillent les écrans admin et les statistiques.

Usage :
    docker compose exec api python -m app.scripts_clean_test_data          # aperçu
    docker compose exec api python -m app.scripts_clean_test_data --yes    # supprime

Trois garde-fous, parce qu'un script de suppression se trompe une fois :

  1. Aperçu par défaut. Rien n'est supprimé sans --yes.
  2. Refus pur et simple si `ENVIRONMENT=production`.
  3. Liste blanche de motifs d'email, et JAMAIS un compte admin ou
     garage — un partenaire réel ne doit pas disparaître parce que son
     adresse ressemble à une adresse de test.
"""
import asyncio
import sys

from sqlalchemy import delete, or_, select

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.order import Cart, CartItem, Order, OrderItem, Payment
from app.models.user import Address, User, UserRole

# Motifs des comptes créés par les tests. Volontairement étroits : mieux
# vaut oublier un compte que d'en supprimer un vrai.
PATTERNS = [
    "e2e%@example.com",
    "e2e-%@example.com",
    "%@example.com",
    "reg%@tvp.fr",
    "test-rdv@tousvospneus.com",
    "invite%@example.com",
    "paiement%@example.com",
    "browser%@example.com",
    "promo-invite-%@tousvospneus.com",
    "admin-verif-temp@tousvospneus.com",
]


async def main(apply: bool) -> None:
    if settings.environment == "production":
        print("REFUS : ce script ne s'exécute pas en production.")
        sys.exit(1)

    async with SessionLocal() as db:
        rows = list(
            await db.scalars(
                select(User).where(
                    or_(*[User.email.like(p) for p in PATTERNS]),
                    # Un admin ou un garage n'est jamais un déchet de test,
                    # quel que soit son email.
                    User.role == UserRole.client,
                )
            )
        )
        if not rows:
            print("Rien à supprimer.")
            return

        ids = [u.id for u in rows]
        orders = list(await db.scalars(select(Order).where(Order.user_id.in_(ids))))
        print(f"{len(rows)} compte(s) de test, {len(orders)} commande(s) :")
        for u in rows[:15]:
            print("  -", u.email)
        if len(rows) > 15:
            print(f"  … et {len(rows) - 15} autre(s)")

        if not apply:
            print("\nAperçu seulement. Relancer avec --yes pour supprimer.")
            return

        order_ids = [o.id for o in orders]
        cart_ids = list(await db.scalars(select(Cart.id).where(Cart.user_id.in_(ids))))
        if order_ids:
            await db.execute(delete(Payment).where(Payment.order_id.in_(order_ids)))
            await db.execute(delete(OrderItem).where(OrderItem.order_id.in_(order_ids)))
            await db.execute(delete(Order).where(Order.id.in_(order_ids)))
        if cart_ids:
            await db.execute(delete(CartItem).where(CartItem.cart_id.in_(cart_ids)))
            await db.execute(delete(Cart).where(Cart.id.in_(cart_ids)))
        await db.execute(delete(Address).where(Address.user_id.in_(ids)))
        await db.execute(delete(User).where(User.id.in_(ids)))
        await db.commit()
        print(f"\nSupprimé : {len(rows)} compte(s), {len(orders)} commande(s).")


if __name__ == "__main__":
    asyncio.run(main("--yes" in sys.argv))
