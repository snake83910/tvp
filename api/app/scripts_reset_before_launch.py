"""Remise à zéro des données d'essai, avant l'ouverture du site.

Ce qu'il efface : tout ce qu'ont produit les essais — commandes,
paiements, paniers, comptes clients, adresses, journaux, audit. Et
surtout, il REMET LES COMPTEURS À ZÉRO : sans ça, la première vraie
facture porterait le numéro 70 parce que soixante-neuf brouillons
d'essai l'ont précédée. C'est la raison d'être de ce script ; un
`TRUNCATE` à la main laisse les séquences où elles sont.

Ce qu'il garde : la configuration et les gens. Comptes administrateurs,
comptes partenaires et leurs fiches garage, fournisseurs, règles de
prix, réglages, codes promo, gabarits d'emails personnalisés. Autrement
dit, tout ce qui a demandé du travail et qu'il faudrait refaire à
l'identique.

    # voir sans rien toucher (comportement par défaut)
    docker compose exec api python -m app.scripts_reset_before_launch

    # exécuter pour de bon
    docker compose exec api python -m app.scripts_reset_before_launch --confirmer

Garde-fou : le script REFUSE de tourner s'il trouve un paiement passé
par la vraie banque, à moins qu'on ne le lui impose explicitement. Un
paiement Sogecommerce signifie qu'un client a été débité — donc que le
site n'est plus « avant lancement », et qu'effacer ces lignes
détruirait des pièces comptables.
"""
import asyncio
import sys

from sqlalchemy import text

from app.db.session import SessionLocal

#: Vidées entièrement, dans cet ordre : les filles avant les mères.
#: `payments` et `order_items` avant `orders`, `audit_logs` avant
#: `users` (sa clé étrangère vers l'acteur n'est pas en cascade).
TABLES_A_VIDER = [
    "cart_items",
    "carts",
    "payments",
    "order_items",
    "orders",
    "garage_reviews",
    "garage_slot_blocks",
    "audit_logs",
    "login_logs",
    "refresh_tokens",
    "cron_runs",
]

#: Remises à 1. Les numéros de facture et d'avoir doivent repartir du
#: début : une numérotation qui commence à 70 sans qu'aucune facture 1
#: à 69 n'existe est inexplicable à un contrôle.
SEQUENCES = [
    "order_number_seq",
    "invoice_number_seq",
    "credit_note_number_seq",
]


async def etat(db) -> dict:
    """Compte ce qui sera supprimé et ce qui restera."""
    lignes = {}
    for table in TABLES_A_VIDER:
        lignes[table] = await db.scalar(text(f"select count(*) from {table}"))
    lignes["users (clients)"] = await db.scalar(
        text("select count(*) from users where role = 'client'")
    )
    return lignes


async def a_garder(db) -> dict:
    return {
        "administrateurs": await db.scalar(
            text("select count(*) from users where role = 'admin'")
        ),
        "partenaires": await db.scalar(
            text("select count(*) from users where role = 'garage'")
        ),
        "fiches garage": await db.scalar(text("select count(*) from garages")),
        "fournisseurs": await db.scalar(text("select count(*) from suppliers")),
        "règles de prix": await db.scalar(
            text("select count(*) from pricing_rules")
        ),
        "codes promo": await db.scalar(text("select count(*) from promo_codes")),
        "gabarits d'emails": await db.scalar(
            text("select count(*) from email_templates")
        ),
        "réglages": await db.scalar(text("select count(*) from app_settings")),
    }


async def paiements_reels(db) -> int:
    return await db.scalar(
        text("select count(*) from payments where provider <> 'simulated'")
    )


async def main(confirmer: bool, forcer: bool) -> None:
    async with SessionLocal() as db:
        avant = await etat(db)
        garde = await a_garder(db)
        reels = await paiements_reels(db)

        print("\nÀ SUPPRIMER")
        for nom, n in avant.items():
            print(f"  {n:>7}  {nom}")
        print("\nÀ CONSERVER")
        for nom, n in garde.items():
            print(f"  {n:>7}  {nom}")
        print("\nCOMPTEURS remis à 1 :", ", ".join(SEQUENCES))

        if reels and not forcer:
            print(
                f"\nREFUS : {reels} paiement(s) passé(s) par la vraie banque.\n"
                "Un client a donc été débité, et ces lignes sont des pièces\n"
                "comptables. Si ce sont vos propres essais en conditions\n"
                "réelles, relancez avec --y-compris-paiements-reels."
            )
            sys.exit(1)

        if not confirmer:
            print(
                "\nSimulation — rien n'a été touché.\n"
                "Sauvegardez, puis relancez avec --confirmer :\n"
                "  docker compose exec -T postgres pg_dump -U tvp -d tvp "
                "> avant-remise-a-zero.sql"
            )
            return

        # Une seule transaction : une remise à zéro à moitié faite
        # laisserait des commandes sans leurs paiements.
        for table in TABLES_A_VIDER:
            await db.execute(text(f"delete from {table}"))
        # Les adresses partent en cascade avec leur propriétaire.
        await db.execute(text("delete from users where role = 'client'"))
        for seq in SEQUENCES:
            await db.execute(text(f"alter sequence {seq} restart with 1"))
        await db.commit()

        print("\nFait. Prochaine commande : CMD-<année>-000001, facture n° 1.")


if __name__ == "__main__":
    args = set(sys.argv[1:])
    inconnus = args - {"--confirmer", "--y-compris-paiements-reels"}
    if inconnus:
        print(f"Option inconnue : {', '.join(sorted(inconnus))}")
        print(__doc__)
        sys.exit(1)
    asyncio.run(
        main(
            confirmer="--confirmer" in args,
            forcer="--y-compris-paiements-reels" in args,
        )
    )
