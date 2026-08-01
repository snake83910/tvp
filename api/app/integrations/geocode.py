"""Géocodage via la Base Adresse Nationale (adresse.data.gouv.fr).

API publique française, gratuite et sans clé. Convertit une adresse ou un
code postal en coordonnées (lat, lng) pour proposer les garages les plus
proches. Renvoie None en cas d'échec (jamais d'exception propagée).
"""
from math import asin, cos, radians, sin, sqrt

import httpx

_BAN_URL = "https://api-adresse.data.gouv.fr/search/"


async def geocode(query: str, postcode: str | None = None) -> tuple[float, float] | None:
    """(lat, lng) de la meilleure correspondance, ou None."""
    q = (query or "").strip()
    if not q:
        return None
    params: dict[str, str | int] = {"q": q, "limit": 1}
    if postcode:
        params["postcode"] = postcode.strip()
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(_BAN_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError):
        return None
    features = (data or {}).get("features") or []
    if not features:
        return None
    try:
        lng, lat = features[0]["geometry"]["coordinates"]
        return float(lat), float(lng)
    except (KeyError, IndexError, TypeError, ValueError):
        return None


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distance à vol d'oiseau en kilomètres entre deux points."""
    r = 6371.0  # rayon terrestre moyen (km)
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    )
    return 2 * r * asin(sqrt(a))
