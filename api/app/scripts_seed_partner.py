"""Crée (ou met à jour) un compte partenaire de démonstration.

Usage :
    docker compose exec api python -m app.scripts_seed_partner \
        <email> <mot-de-passe> "<nom du garage>"

Le compte est créé avec le rôle garage, sa fiche est publiée, ses horaires
sont renseignés et la prise de rendez-vous est active — de quoi voir tout
de suite l'espace partenaire dans son état nominal. Les coordonnées
restent à corriger depuis /admin/garages : le partenaire ne peut pas le
faire lui-même, c'est le principe.
"""
import asyncio
import re
import sys
import unicodedata

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.integrations.geocode import geocode
from app.models.garage import Garage
from app.models.user import User, UserRole

HORAIRES = {
    "lundi": {"open": "08:00", "close": "18:00", "break_start": "12:00", "break_end": "14:00"},
    "mardi": {"open": "08:00", "close": "18:00", "break_start": "12:00", "break_end": "14:00"},
    "mercredi": {"open": "08:00", "close": "18:00", "break_start": "12:00", "break_end": "14:00"},
    "jeudi": {"open": "08:00", "close": "18:00", "break_start": "12:00", "break_end": "14:00"},
    "vendredi": {"open": "08:00", "close": "18:00", "break_start": "12:00", "break_end": "14:00"},
    "samedi": {"open": "09:00", "close": "12:00"},
    "dimanche": {"closed": True},
}

TARIFS = [
    {"vehicle": "voiture", "size_min": 13, "size_max": 17, "price_cents": 1500,
     "label": "Montage, équilibrage, valve"},
    {"vehicle": "voiture", "size_min": 18, "size_max": 22, "price_cents": 2000,
     "label": "Montage, équilibrage, valve"},
    {"vehicle": "suv", "size_min": 16, "size_max": 22, "price_cents": 2200,
     "label": "Montage, équilibrage, valve"},
    {"vehicle": "runflat", "size_min": 16, "size_max": 22, "price_cents": 2800,
     "label": "Supplément runflat"},
]


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower() or "garage"


async def main(email: str, password: str, name: str) -> None:
    email = email.lower().strip()
    async with SessionLocal() as db:
        user = await db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, password_hash=hash_password(password))
            db.add(user)
        else:
            user.password_hash = hash_password(password)
        user.role = UserRole.garage
        user.is_active = True
        user.email_verified = True
        await db.flush()

        g = await db.scalar(select(Garage).where(Garage.owner_user_id == user.id))
        if g is None:
            g = Garage(owner_user_id=user.id, slug=slugify(name))
            db.add(g)

        g.name = name
        g.address = "12 avenue Jean Jaurès"
        g.postal_code = "69007"
        g.city = "Lyon"
        g.phone = "04 78 00 00 00"
        g.email = email
        g.siret = "12345678900017"
        g.description = (
            "Centre de montage partenaire tousvospneus.com. Montage, "
            "équilibrage et recyclage de vos anciens pneus."
        )
        g.hours = HORAIRES
        g.pricing = TARIFS
        g.services = ["equilibrage", "valve", "recyclage"]
        g.payment_methods = ["cb", "especes", "cheque"]
        g.mounting_price_cents = 1500
        g.appointments_enabled = True
        g.slot_minutes = 30
        g.slot_capacity = 2
        g.appointment_lead_days = 1
        g.is_published = True

        coords = await geocode(f"{g.address} {g.city}", postcode=g.postal_code)
        if coords:
            g.lat, g.lng = coords

        await db.commit()
        print(f"OK  compte={email}  role=garage  garage={g.name}  slug={g.slug}")
        print(f"    geocode={'oui' if g.lat else 'NON (à corriger)'}  publie={g.is_published}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3]))
