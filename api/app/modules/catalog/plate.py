"""Recherche des dimensions pneus par plaque, à deux fournisseurs.

Le site interrogeait l'API interne de Midas en imitant l'empreinte TLS
de Chrome pour passer leur Cloudflare. Ça marche, mais ça repose sur le
bon vouloir d'un concurrent direct, sans convention : l'accès peut
cesser du jour au lendemain, et le procédé est difficile à défendre.

`apiplaqueimmatriculation.com` (module `integrations/siv.py`) est un
fournisseur en bonne et due forme, avec un contrat et une clé. Son
inconvénient est un quota — d'où le repli.

L'ordre est un RÉGLAGE, pas une constante : il se change depuis
l'administration, sans redéploiement. Un fournisseur qui tombe se
contourne à 22 h, depuis un navigateur.

Trois modes :

* `siv`      — SIV d'abord, Midas en secours (recommandé)
* `siv_only` — SIV seul : aucun appel à Midas, quelles qu'en soient les
               conséquences sur le taux de réponse
* `midas`    — Midas seul, comportement historique
"""
from __future__ import annotations

import re
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_get, cache_set, get_redis
from app.core.config import settings
from app.models.setting import AppSetting

SETTING_KEY = "plate_provider"
DEFAULT_MODE = "siv"
MODES = ("siv", "siv_only", "midas")

#: 24 h — les dimensions d'un véhicule ne changent pas. Le cache est
#: partagé par les deux fournisseurs : c'est la même voiture.
CACHE_TTL = 86_400

_MIDAS_URL = (
    "https://www.midas.fr/api/edriver/vehicles/tires/search"
    "?plateNumber={plate}&plateLocale=fr-FR"
)
_MIDAS_HEADERS = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
    "referer": "https://www.midas.fr/",
    "origin": "https://www.midas.fr",
}


class PlateNotFoundError(Exception):
    """La plaque est valide mais aucun véhicule/dimension n'en sort."""


class PlateUnavailableError(Exception):
    """Aucun fournisseur n'a pu répondre. Distinct de « pas trouvé » :
    le client doit être invité à saisir ses dimensions, pas à conclure
    que son véhicule est inconnu."""


def clean_plate(plate: str) -> str | None:
    """Normalise et valide une plaque. None si le format est aberrant."""
    clean = re.sub(r"[-\s]", "", plate or "").upper()
    return clean if re.match(r"^[A-Z0-9]{4,9}$", clean) else None


async def get_mode(db: AsyncSession) -> str:
    """Mode courant. Retombe sur le défaut si le réglage est absent ou
    a été écrit avec une valeur inconnue — un réglage corrompu ne doit
    pas casser la recherche."""
    value = await db.scalar(
        select(AppSetting.value).where(AppSetting.key == SETTING_KEY)
    )
    return value if value in MODES else DEFAULT_MODE


async def set_mode(db: AsyncSession, mode: str) -> None:
    if mode not in MODES:
        raise ValueError(f"Mode inconnu : {mode}")
    row = await db.get(AppSetting, SETTING_KEY)
    if row is None:
        db.add(AppSetting(key=SETTING_KEY, value=mode))
    else:
        row.value = mode


def siv_configured() -> bool:
    return bool(settings.siv_api_key)


# ── Compteurs d'usage ─────────────────────────────────────────────
#
# Le quota SIV se compte à la journée (~100 appels sur l'offre
# gratuite). Sans compteur visible, on découvre la limite le jour où la
# recherche cesse de répondre.

def _counter_key(provider: str, day: str | None = None) -> str:
    day = day or datetime.now(UTC).strftime("%Y-%m-%d")
    return f"plate:calls:{provider}:{day}"


async def _bump(provider: str) -> None:
    try:
        redis = get_redis()
        key = _counter_key(provider)
        await redis.incr(key)
        # 48 h : de quoi lire la veille au matin sans accumuler.
        await redis.expire(key, 172_800)
    except Exception:
        # Un compteur d'usage ne doit jamais faire échouer une recherche.
        pass


async def usage_today() -> dict[str, int]:
    out: dict[str, int] = {}
    for provider in ("siv", "midas"):
        try:
            raw = await get_redis().get(_counter_key(provider))
            out[provider] = int(raw) if raw else 0
        except Exception:
            out[provider] = 0
    return out


# ── Fournisseurs ──────────────────────────────────────────────────

async def _from_siv(plate: str) -> list[dict]:
    from app.integrations.siv import lookup_by_plate

    await _bump("siv")
    try:
        dims = await lookup_by_plate(plate)
    except RuntimeError as exc:
        # `siv.py` signale une plaque inconnue par un RuntimeError. Sans
        # cette traduction, une plaque simplement absente de leur base
        # ressortirait en « service indisponible » : le client croirait
        # à une panne au lieu de saisir ses dimensions.
        raise PlateNotFoundError() from exc
    # `siv.py` rend height ; le reste du site parle en height aussi.
    return [
        {
            "width": int(d["width"]),
            "height": int(d["height"]),
            "diameter": int(d["diameter"]),
            "load_index": str(d.get("load_index") or ""),
            "speed_rating": str(d.get("speed_rating") or ""),
        }
        for d in dims
    ]


async def _from_midas(plate: str) -> list[dict]:
    from curl_cffi.requests import AsyncSession as CurlSession

    await _bump("midas")
    async with CurlSession(impersonate="chrome120") as session:
        resp = await session.get(
            _MIDAS_URL.format(plate=plate), headers=_MIDAS_HEADERS, timeout=15
        )
    if resp.status_code == 404:
        raise PlateNotFoundError()
    if resp.status_code != 200:
        raise PlateUnavailableError(f"Midas HTTP {resp.status_code}")

    raw = resp.json()
    if not isinstance(raw, list):
        raise PlateNotFoundError()
    return [
        {
            "width": int(t["width"]),
            "height": int(t["height"]),
            "diameter": int(t["diameter"]),
            "load_index": str(t.get("load", "")),
            "speed_rating": str(t.get("speed", "")),
        }
        for t in raw
        if "width" in t
    ]


def _dedupe(dims: list[dict]) -> list[dict]:
    """Un SUV peut monter des dimensions différentes à l'avant et à
    l'arrière : on garde les deux, mais pas deux fois la même."""
    seen: dict[str, dict] = {}
    for d in dims:
        seen.setdefault(f"{d['width']}-{d['height']}-{d['diameter']}", d)
    return list(seen.values())


def _providers(mode: str) -> list[tuple[str, object]]:
    """Fournisseurs à essayer, dans l'ordre, selon le mode.

    En mode `siv` sans clé configurée, SIV est simplement absent de la
    liste : inutile de provoquer une erreur pour retomber ensuite sur
    Midas, et l'écran d'administration signale déjà la clé manquante.
    """
    siv = [("siv", _from_siv)] if siv_configured() else []
    if mode == "midas":
        return [("midas", _from_midas)]
    if mode == "siv_only":
        return siv
    return siv + [("midas", _from_midas)]


async def lookup(db: AsyncSession, plate: str) -> tuple[list[dict], str]:
    """Dimensions du véhicule, et le fournisseur qui a répondu.

    Lève `PlateNotFoundError` si un fournisseur affirme ne pas connaître la
    plaque, `PlateUnavailableError` si aucun n'a pu répondre. La nuance
    compte pour le message affiché au client.
    """
    cache_key = f"plate:{plate}"
    cached = await cache_get(cache_key)
    if cached is not None:
        if not cached:
            raise PlateNotFoundError()
        return cached, "cache"

    mode = await get_mode(db)
    chain = _providers(mode)
    if not chain:
        raise PlateUnavailableError(
            "Aucun fournisseur d'immatriculation disponible "
            f"(mode {mode}, clé SIV {'absente' if not siv_configured() else 'présente'})."
        )

    last_error: Exception | None = None
    for name, call in chain:
        try:
            dims = _dedupe(await call(plate))
        except PlateNotFoundError:
            # Le fournisseur a répondu et ne connaît pas cette plaque.
            # Le suivant peut la connaître : les bases diffèrent.
            last_error = PlateNotFoundError()
            continue
        except Exception as exc:
            last_error = exc
            continue
        if dims:
            await cache_set(cache_key, dims, CACHE_TTL)
            return dims, name
        last_error = PlateNotFoundError()

    if isinstance(last_error, PlateNotFoundError):
        # Mémorisé aussi : une plaque introuvable le restera demain, et
        # rien ne justifie de rappeler les deux fournisseurs à chaque
        # nouvelle tentative du client.
        await cache_set(cache_key, [], CACHE_TTL)
        raise PlateNotFoundError()
    raise PlateUnavailableError(str(last_error) if last_error else "inconnu")
