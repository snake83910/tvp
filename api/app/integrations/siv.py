"""Recherche de dimensions pneus par plaque d'immatriculation française.

Provider par défaut : apiplaqueimmatriculation.com
  - Inscription gratuite : https://www.apiplaqueimmatriculation.com
  - Free tier : ~100 requêtes/jour
  - L'API retourne les infos véhicule dont le champ "Pneus" : "205/55 R16 91V"

Pour changer de provider, ajustez SIV_API_URL + la fonction _parse_response().
"""
import re

import httpx

from app.core.config import settings

# Regex pneu : 205/55 R16 91V  ou  195/65R15  ou  205/55R16 (sans charge/vitesse)
_TIRE_RE = re.compile(
    r"(\d{3})\s*/\s*(\d{2,3})\s*[Rr]\s*(\d{2})\s*(\d{2,3})?([A-Za-z])?",
)


def _parse_tire_string(s: str) -> dict | None:
    m = _TIRE_RE.search(s)
    if not m:
        return None
    return {
        "width": int(m.group(1)),
        "height": int(m.group(2)),
        "diameter": int(m.group(3)),
        "load_index": m.group(4) or "",
        "speed_rating": (m.group(5) or "").upper(),
    }


def _parse_response(data: dict) -> list[dict]:
    """Extrait les dimensions pneus d'une réponse JSON SIV.

    apiplaqueimmatriculation.com retourne un champ "Pneus" comme "205/55 R16 91V".
    On cherche ce champ en priorité, puis on scanne tous les champs string.
    Plusieurs montages possibles (AV/AR différents sur SUV) : on déduplique.
    """
    # Champs courants selon le provider
    candidate_keys = [
        "Pneus", "pneus", "Pneumatiques", "pneumatiques",
        "PneusAV", "PneusAR", "pneu", "tires", "tyres",
    ]

    dims: dict[str, dict] = {}  # clé = "205-55-16" pour déduplication

    # 1. Chercher dans les champs connus
    for key in candidate_keys:
        val = data.get(key)
        if isinstance(val, str):
            d = _parse_tire_string(val)
            if d:
                k = f"{d['width']}-{d['height']}-{d['diameter']}"
                dims.setdefault(k, d)

    # 2. Scanner tous les champs string si rien trouvé
    if not dims:
        for val in data.values():
            if isinstance(val, str) and _TIRE_RE.search(val):
                d = _parse_tire_string(val)
                if d:
                    k = f"{d['width']}-{d['height']}-{d['diameter']}"
                    dims.setdefault(k, d)

    return list(dims.values())


async def lookup_by_plate(plate: str) -> list[dict]:
    """Retourne les dimensions pneus (liste, car AV≠AR possible).

    Args:
        plate: Plaque nettoyée (ex. "AA123AA"), sans tirets ni espaces.

    Returns:
        Liste de dicts {"width", "height", "diameter", "load_index", "speed_rating"}.
        Liste vide si la plaque est trouvée mais sans dimensions pneus.

    Raises:
        ValueError: si SIV_API_KEY n'est pas configurée.
        httpx.TimeoutException: si l'API ne répond pas.
        httpx.HTTPStatusError: si l'API retourne une erreur HTTP.
        RuntimeError: si la réponse indique une plaque introuvable.
    """
    api_key = settings.siv_api_key
    if not api_key:
        raise ValueError("SIV_API_KEY non configurée")

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            settings.siv_api_url,
            params={"key": api_key, "plaque": plate},
            headers={"Accept": "application/json"},
        )

    resp.raise_for_status()

    data = resp.json()

    # apiplaqueimmatriculation.com retourne {"Erreur": "1"} si plaque inconnue
    if data.get("Erreur") == "1" or data.get("erreur") == "1":
        raise RuntimeError("Plaque non trouvée")

    # Vérifier qu'on a bien un véhicule (champ Marque ou équivalent)
    if not (data.get("Marque") or data.get("marque") or data.get("make") or data.get("brand")):
        raise RuntimeError("Plaque non reconnue ou réponse inattendue")

    return _parse_response(data)
