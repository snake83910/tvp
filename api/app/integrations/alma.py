"""Paiement en plusieurs fois — Alma.

Second moyen de paiement, à côté de la carte Sogecommerce. Un jeu de
quatre pneus représente 300 à 600 € d'un coup : c'est le montant où l'on
renonce. Les concurrents proposent tous le 3x/4x, c'est devenu un
attendu du marché plus qu'un avantage.

DEUX DIFFÉRENCES DE FOND avec Sogecommerce, qui commandent tout ce
fichier :

1. Le webhook d'Alma N'EST PAS SIGNÉ. Alma le documente et recommande
   de ne rien croire de son contenu : on reçoit un identifiant de
   paiement, et on RELIT le paiement chez Alma pour connaître son état.
   C'est plus sûr qu'une signature — il n'y a rien à falsifier, la
   source d'autorité est l'API elle-même. Voir `get_payment`.

2. Le client part sur une page Alma (redirection) au lieu de saisir sa
   carte chez nous. Il n'y a donc pas de formulaire à monter, juste une
   URL à suivre.

Le module reste muet si aucune clé n'est configurée : `configured()`
rend faux, et l'administration refuse d'activer le moyen de paiement.
Rien ne casse tant que le compte Alma n'existe pas.
"""
from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.core.config import settings

#: Bac à sable et production. Alma n'a pas de mode « test » sur la même
#: URL : ce sont deux comptes et deux clés distincts.
SANDBOX_URL = "https://api.sandbox.getalma.eu"
LIVE_URL = "https://api.getalma.eu"

#: Échéanciers proposés. Alma facture des frais au marchand qui croissent
#: avec le nombre d'échéances ; 3 et 4 sont l'usage du marché.
INSTALLMENTS = (3, 4)

TIMEOUT = 15.0


class AlmaError(RuntimeError):
    """Échec d'appel. Porte le corps de la réponse : Alma y explique
    précisément ce qu'il refuse, et ce détail est ce qui manque le plus
    quand on intègre à l'aveugle."""


@dataclass(frozen=True)
class AlmaPayment:
    """Paiement relu chez Alma — la seule source à laquelle on se fie."""

    id: str
    #: `authorized` ou `captured` valent encaissement côté Alma : le
    #: marchand est payé, le client rembourse Alma ensuite.
    processing_status: str
    purchase_amount: int
    url: str | None = None

    @property
    def paid(self) -> bool:
        return self.processing_status in ("authorized", "captured")


def configured() -> bool:
    return bool(settings.alma_api_key)


def base_url() -> str:
    return LIVE_URL if settings.alma_mode == "live" else SANDBOX_URL


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Alma-Auth {settings.alma_api_key}",
        "Content-Type": "application/json",
    }


def _address(snapshot: dict | None, first: str, last: str, email: str) -> dict:
    """Adresse au format Alma. Le snapshot de commande n'en porte pas
    l'identité : Alma la veut sur l'adresse, on la recompose."""
    snapshot = snapshot or {}
    return {
        "first_name": first,
        "last_name": last,
        "email": email,
        "line1": snapshot.get("line1", ""),
        "postal_code": snapshot.get("postal_code", ""),
        "city": snapshot.get("city", ""),
        "country": snapshot.get("country", "FR"),
    }


async def eligibility(amount_cents: int) -> list[int]:
    """Échéanciers réellement disponibles pour ce montant.

    Alma pose un plancher et un plafond par contrat, et ils diffèrent
    selon le nombre d'échéances. Afficher « payez en 4 fois » sur un
    montant qu'Alma refusera ensuite est le meilleur moyen de perdre la
    vente au dernier écran : on demande avant d'afficher.

    Sur erreur, on rend une liste vide plutôt que de lever : un
    fournisseur indisponible doit faire disparaître l'option, pas
    empêcher de payer par carte.
    """
    if not configured():
        return []
    payload = {
        "purchase_amount": amount_cents,
        "queries": [{"installments_count": n} for n in INSTALLMENTS],
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(
                f"{base_url()}/v1/payments/eligibility",
                json=payload,
                headers=_headers(),
            )
            r.raise_for_status()
            data = r.json()
    except Exception:
        return []

    # La réponse est une liste d'objets portant `eligible` et
    # `installments_count`.
    return [
        int(e["installments_count"])
        for e in data
        if isinstance(e, dict) and e.get("eligible")
    ]


async def create_payment(
    *,
    order_number: str,
    amount_cents: int,
    installments: int,
    return_url: str,
    ipn_url: str,
    cancel_url: str,
    first_name: str,
    last_name: str,
    email: str,
    phone: str | None,
    billing: dict | None,
    shipping: dict | None,
) -> AlmaPayment:
    """Ouvre un paiement et rend l'URL vers laquelle rediriger le client."""
    if not configured():
        raise AlmaError("Alma non configuré (ALMA_API_KEY absente)")

    adresse_f = _address(billing, first_name, last_name, email)
    adresse_l = _address(shipping, first_name, last_name, email)

    payload = {
        "origin": "online",
        "payment": {
            "purchase_amount": amount_cents,
            "installments_count": installments,
            "return_url": return_url,
            "ipn_callback_url": ipn_url,
            "customer_cancel_url": cancel_url,
            "locale": "fr",
            # Le numéro de commande voyage avec le paiement : c'est lui
            # qu'on lit au Back Office d'Alma quand un client conteste,
            # et lui qui rattache l'IPN sans dépendre d'une table.
            "custom_data": {"order_number": order_number},
            "billing_address": adresse_f,
            "shipping_address": adresse_l,
        },
        "customer": {
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone": phone or "",
            "addresses": [adresse_l],
        },
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(
            f"{base_url()}/v1/payments", json=payload, headers=_headers()
        )
        if r.status_code >= 400:
            raise AlmaError(f"Alma {r.status_code} : {r.text[:400]}")
        data = r.json()

    return AlmaPayment(
        id=data["id"],
        processing_status=data.get("processing_status", "pending"),
        purchase_amount=int(data.get("purchase_amount", amount_cents)),
        url=data.get("url"),
    )


async def get_payment(payment_id: str) -> AlmaPayment:
    """Relit un paiement chez Alma.

    C'est LA fonction de sécurité du module. Le webhook n'étant pas
    signé, son contenu ne vaut rien : il sert uniquement à apprendre
    qu'il s'est passé quelque chose, et on vient vérifier quoi ici.
    """
    if not configured():
        raise AlmaError("Alma non configuré (ALMA_API_KEY absente)")

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.get(
            f"{base_url()}/v1/payments/{payment_id}", headers=_headers()
        )
        if r.status_code >= 400:
            raise AlmaError(f"Alma {r.status_code} : {r.text[:400]}")
        data = r.json()

    return AlmaPayment(
        id=data["id"],
        processing_status=data.get("processing_status", ""),
        purchase_amount=int(data.get("purchase_amount", 0)),
        url=data.get("url"),
    )
