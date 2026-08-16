"""Consultation, aperçu et modification des templates d'email.

Le fichier reste la valeur par défaut ; la base ne porte que les
surcharges. Trois précautions gouvernent ce module.

**Bac à sable.** Les templates venus de la base sont rendus dans un
`SandboxedEnvironment`. Un administrateur est déjà digne de confiance —
il rembourse, il annule des commandes — mais Jinja non bridé permet
d'atteindre les objets Python sous-jacents : un compte admin compromis
deviendrait alors une exécution de code sur le serveur. Le bac à sable
transforme cette escalade en simple erreur de rendu.

**Validation avant enregistrement.** Un template qui ne compile pas ou
qui lève au rendu n'est jamais accepté. Sans ce contrôle, une accolade
oubliée casserait silencieusement les confirmations de commande — et on
l'apprendrait par un client.

**Cache court partagé.** Le chemin d'envoi ne doit pas interroger la
base à chaque email, mais deux workers ne doivent pas non plus servir
des versions différentes pendant des heures. Redis, soixante secondes,
invalidé à l'enregistrement.
"""
from __future__ import annotations

from pathlib import Path

from jinja2 import FileSystemLoader, meta, select_autoescape
from jinja2.sandbox import SandboxedEnvironment
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_get, cache_set, get_redis
from app.models.email_template import EmailTemplate

TEMPLATES_DIR = Path(__file__).parent / "templates"

#: 60 s : assez pour que l'envoi en rafale ne martèle pas la base, assez
#: court pour qu'une correction se propage à tous les workers sans
#: redéploiement.
CACHE_TTL = 60
_CACHE_PREFIX = "mailtpl:"
#: Sentinelle « pas de surcharge » : sans elle, les 21 templates non
#: modifiés provoqueraient une requête à chaque email envoyé.
_NONE = "\x00none"

#: `_layout.html` est le squelette dont héritent tous les autres. Le
#: laisser modifier casserait les 20 templates d'un coup ; il reste
#: consultable, pas éditable.
LOCKED = {"_layout.html"}

#: Environnement bridé, avec accès aux fichiers pour que `{% extends %}`
#: continue de fonctionner sur un template venu de la base.
_sandbox = SandboxedEnvironment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def list_names() -> list[str]:
    """Templates livrés avec le code, triés."""
    return sorted(p.name for p in TEMPLATES_DIR.glob("*.html"))


def default_source(name: str) -> str:
    """Contenu du fichier versionné. Lève si le nom est inconnu."""
    path = _safe_path(name)
    return path.read_text(encoding="utf-8")


def _safe_path(name: str) -> Path:
    """Résout un nom de template en refusant tout ce qui sort du dossier.

    Le nom vient d'une URL : sans ce contrôle, `../../.env` serait un
    template parfaitement lisible.
    """
    if name not in list_names():
        raise FileNotFoundError(name)
    return TEMPLATES_DIR / name


# ── Surcharges ────────────────────────────────────────────────────

async def get_override(db: AsyncSession, name: str) -> str | None:
    return await db.scalar(
        select(EmailTemplate.html).where(EmailTemplate.name == name)
    )


async def cached_override(name: str) -> str | None:
    """Surcharge éventuelle, vue depuis le chemin d'envoi.

    Ouvre sa propre session : le mailer est appelé depuis des tâches de
    fond qui n'en ont pas, et le cache rend cet accès rare.
    """
    cached = await cache_get(_CACHE_PREFIX + name)
    if cached is not None:
        return None if cached == _NONE else cached

    from app.db.session import SessionLocal

    async with SessionLocal() as db:
        html = await get_override(db, name)
    await cache_set(_CACHE_PREFIX + name, html if html else _NONE, CACHE_TTL)
    return html


async def _invalidate(name: str) -> None:
    try:
        await get_redis().delete(_CACHE_PREFIX + name)
    except Exception:
        # Au pire la surcharge met une minute à se propager.
        pass


async def save_override(
    db: AsyncSession, name: str, html: str, author: str | None
) -> None:
    """Enregistre une surcharge APRÈS l'avoir rendue sans erreur."""
    _safe_path(name)
    if name in LOCKED:
        raise ValueError(
            f"{name} est le squelette commun à tous les emails : "
            "le modifier les casserait tous."
        )
    render_preview(html)  # lève si le template est invalide

    row = await db.get(EmailTemplate, name)
    if row is None:
        db.add(EmailTemplate(name=name, html=html, updated_by=author))
    else:
        row.html = html
        row.updated_by = author
    await _invalidate(name)


async def drop_override(db: AsyncSession, name: str) -> bool:
    row = await db.get(EmailTemplate, name)
    if row is None:
        return False
    await db.delete(row)
    await _invalidate(name)
    return True


# ── Aperçu ────────────────────────────────────────────────────────

#: Valeurs d'exemple pour les variables les plus courantes. Les autres
#: sont remplies automatiquement (voir `sample_context`) : maintenir à
#: la main un jeu d'essai par template dériverait au premier ajout.
_SAMPLES: dict[str, object] = {
    "civilite": "Bonjour Camille",
    "order_number": "CMD-2026-000123",
    "site_url": "https://tousvospneus.com",
    "order_url": "https://tousvospneus.com/commandes/CMD-2026-000123",
    "payment_url": "https://tousvospneus.com/paiement/CMD-2026-000123",
    "review_url": "https://tousvospneus.com/garages/garage-rivaz-lyon#avis",
    "partner_url": "https://tousvospneus.com/partenaire",
    "amount": "119,76 €",
    "total": "119,76 €",
    "partial": False,
    "reason": "Rupture fournisseur",
    "credit_note_ref": "AV-2026-000001",
    "garage_name": "Garage Rivaz",
    "garage_address": "12 avenue du Garage",
    "garage_postal_code": "69003",
    "garage_city": "Lyon",
    "garage_phone": "04 78 00 00 00",
    "appointment_label": "mardi 25 août à 14 h 00",
    "previous_label": "lundi 24 août à 10 h 00",
    "new_label": "mardi 25 août à 14 h 00",
    "customer_name": "Camille Durand",
    "customer_phone": "06 11 22 33 44",
    "headline": "Un rendez-vous vient d'être déplacé",
    "tracking_number": "6A12345678901",
    "carrier": "Colissimo",
    "code": "482913",
    # Montants NUMÉRIQUES : plusieurs templates les passent à
    # `format("%.2f")`, qui refuse une chaîne. Un marqueur textuel y
    # ferait échouer l'aperçu — et le test qui rend tous les templates
    # livrés le signale immédiatement.
    "total_ttc": 119.76,
    "shipping_ttc": 0.0,
    "discount_ttc": 0.0,
    "items": [
        {
            "label": "Michelin Primacy 4 205/55 R16 91V",
            # `qty` et `quantity` : les templates n'emploient pas tous le
            # même nom, et un aperçu ne doit pas dépendre de ce détail.
            "qty": 2,
            "quantity": 2,
            "unit_ttc": 59.88,
            "line_ttc": 119.76,
        }
    ],
}


def sample_context(source: str) -> dict:
    """Jeu d'essai : valeurs réalistes connues, marqueurs pour le reste.

    Les variables non prévues sont remplies par « ‹nom› » plutôt que
    laissées vides : dans un aperçu, un trou est indiscernable d'une
    variable oubliée.
    """
    ast = _sandbox.parse(source)
    context = dict(_SAMPLES)
    for var in meta.find_undeclared_variables(ast):
        context.setdefault(var, f"‹{var}›")
    return context


def render_preview(source: str, context: dict | None = None) -> str:
    """Rend un template arbitraire dans le bac à sable.

    Sert à l'aperçu ET à la validation avant enregistrement : c'est le
    même chemin, donc ce qu'on voit est bien ce qui sera envoyé.
    """
    template = _sandbox.from_string(source)
    return template.render(**(context or sample_context(source)))
