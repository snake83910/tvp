"""Recherche de dimensions pneus par plaque d'immatriculation française.

Provider : apiplaqueimmatriculation.com
  - Inscription gratuite : https://www.apiplaqueimmatriculation.com
  - Free tier : ~100 requêtes/jour

Forme réelle de la réponse (relevée en production) :

    {
      "data": {
        "erreur": "", "immat": "HG066TH", "marque": "CITROEN",
        "modele": "DS3", "version": "1.6 E-HDI",
        "pneus": [
          {"name": "205/45 R 17", "width": 205, "height": 45,
           "diameter": 17, "load_index": 88, "speed_index": "V"},
          {"name": "195/55 R 16", ...}
        ]
      },
      "api_version": "V1", "message": "", "code_erreur": 200
    }

Deux pièges que cette forme réserve :

* **Tout est sous `data`.** Chercher les champs à la racine ne remonte
  rien, et la réponse passe pour « non reconnue » alors qu'elle est
  parfaitement valide.
* **`pneus` est DÉJÀ structuré.** Inutile de faire des expressions
  régulières sur une chaîne : les entiers sont là. Le parsing de
  `name` ne sert que de filet, pour un provider qui ne rendrait que du
  texte.

Un même véhicule peut avoir plusieurs montages homologués (ici 205/45
R17 et 195/55 R16) : on les rend TOUS, c'est au client de reconnaître le
sien.
"""
import re
from dataclasses import dataclass, field

import httpx

from app.core.config import settings

# Regex pneu : 205/45 R 17 · 195/65R15 · 205/55R16 (sans charge/vitesse).
# Filet de sécurité quand seul un libellé texte est disponible.
_TIRE_RE = re.compile(
    r"(\d{3})\s*/\s*(\d{2,3})\s*[Rr]\s*(\d{2})\s*(\d{2,3})?\s*([A-Za-z])?",
)

#: Codes que le provider renvoie pour un problème DE NOTRE CÔTÉ (clé
#: invalide, quota épuisé) et non pour un véhicule inconnu. La nuance
#: décide du message affiché au client — et du repli sur l'autre
#: fournisseur plutôt que d'un « véhicule inconnu » mensonger.
_ACCESS_ERROR_CODES = {401, 402, 403, 429, 500, 502, 503}


class PlateAccessError(RuntimeError):
    """Clé refusée, quota épuisé, provider en panne, URL périmée. Pas un
    véhicule inconnu : l'appelant doit essayer ailleurs, pas conclure."""


#: Endpoint courant. Le défaut de `settings` pointe ici ; cette
#: constante existe pour pouvoir REMPLACER une valeur périmée héritée
#: d'un `.env` déployé avant la correction.
DEFAULT_URL = "https://api.apiplaqueimmatriculation.com/plaque"

#: Endpoints morts qu'on a pu recopier dans un `.env`. Un réglage
#: d'environnement qui écrase silencieusement un défaut corrigé est un
#: piège : le code est à jour, la production ne l'est pas, et l'erreur
#: (« 301 Moved Permanently ») ne désigne pas sa propre cause. On les
#: ignore plutôt que d'attendre que quelqu'un pense à éditer le fichier.
_LEGACY_URLS = {
    "https://www.apiplaqueimmatriculation.com/getinfosvehicule.php",
    "http://www.apiplaqueimmatriculation.com/getinfosvehicule.php",
    "https://apiplaqueimmatriculation.com/getinfosvehicule.php",
}


def resolve_url() -> str:
    """URL effective du provider, l'héritage périmé mis de côté."""
    configured = (settings.siv_api_url or "").strip()
    if not configured or configured.lower().rstrip("/") in _LEGACY_URLS:
        return DEFAULT_URL
    return configured


@dataclass
class SivLookup:
    """Ce que le provider sait du véhicule.

    Les dimensions sont l'essentiel, mais l'identité l'accompagne : quand
    deux montages homologués sortent, savoir QUEL véhicule a été reconnu
    est ce qui permet au client de trancher.
    """

    dimensions: list[dict] = field(default_factory=list)
    vehicle: str = ""
    #: Logo de la marque, hébergé par le provider. Vide si absent ou si
    #: l'URL ne passe pas le contrôle ci-dessous.
    brand_logo: str = ""


def _parse_tire_string(s: str) -> dict | None:
    m = _TIRE_RE.search(s or "")
    if not m:
        return None
    return {
        "width": int(m.group(1)),
        "height": int(m.group(2)),
        "diameter": int(m.group(3)),
        "load_index": m.group(4) or "",
        "speed_rating": (m.group(5) or "").upper(),
    }


def _normalize_tire(entry: object) -> dict | None:
    """Une entrée de `pneus` vers notre format interne.

    Accepte l'objet structuré du provider comme une simple chaîne : les
    deux formes existent selon les véhicules et les providers, et rater
    un montage parce qu'il arrive en texte serait dommage.
    """
    if isinstance(entry, str):
        return _parse_tire_string(entry)
    if not isinstance(entry, dict):
        return None

    try:
        width = int(entry["width"])
        height = int(entry["height"])
        diameter = int(entry["diameter"])
    except (KeyError, TypeError, ValueError):
        # Champs numériques absents ou illisibles : on retombe sur le
        # libellé, qui porte la même information sous forme de texte.
        return _parse_tire_string(str(entry.get("name") or ""))

    # `speed_index` chez ce provider, `speed_rating` ailleurs.
    speed = entry.get("speed_index") or entry.get("speed_rating") or ""
    load = entry.get("load_index")
    return {
        "width": width,
        "height": height,
        "diameter": diameter,
        "load_index": "" if load is None else str(load),
        "speed_rating": str(speed).upper(),
    }


def _parse_response(payload: dict) -> list[dict]:
    """Extrait les dimensions pneus. Déduplique les montages identiques.

    Tolère la réponse enveloppée (`{"data": {...}}`) comme une réponse
    à plat : c'est le seul point où la forme exacte du provider fuit
    dans le code, autant qu'il l'absorbe.
    """
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload

    dims: dict[str, dict] = {}

    def collect(value: object) -> None:
        entries = value if isinstance(value, list) else [value]
        for entry in entries:
            d = _normalize_tire(entry)
            if d:
                dims.setdefault(
                    f"{d['width']}-{d['height']}-{d['diameter']}", d
                )

    for key in ("pneus", "Pneus", "pneumatiques", "Pneumatiques",
                "tires", "tyres", "PneusAV", "PneusAR"):
        if key in data:
            collect(data[key])

    # Dernier recours : balayer les chaînes de la réponse. Utile si le
    # provider renomme son champ sans prévenir — ça arrive.
    if not dims:
        for value in data.values():
            if isinstance(value, str) and _TIRE_RE.search(value):
                collect(value)

    return list(dims.values())


#: Hôtes autorisés à servir le logo. La valeur vient d'une réponse
#: tierce et finit dans un `src` d'image : la restreindre évite qu'un
#: provider compromis ne fasse charger n'importe quoi au navigateur de
#: nos clients — ou n'y place une URL de traçage.
_LOGO_HOSTS = ("apiplaqueimmatriculation.com",)


def brand_logo_url(payload: dict) -> str:
    """URL du logo de la marque, vide si absente ou non conforme."""
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    raw = str(data.get("logo_marque") or "").strip()
    if not raw.startswith("https://"):
        return ""
    host = raw.split("/", 3)[2].split(":")[0].lower()
    if not any(host == h or host.endswith("." + h) for h in _LOGO_HOSTS):
        return ""
    return raw


def vehicle_label(payload: dict) -> str:
    """Libellé lisible du véhicule identifié (« CITROEN DS3 1.6 E-HDI »).

    Affiché au client au-dessus des dimensions : c'est ce qui lui
    confirme que la bonne voiture a été reconnue, et ce qui rend
    compréhensible qu'on lui propose parfois deux montages.
    """
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    parts = [data.get("marque"), data.get("modele"), data.get("version")]
    return " ".join(str(p).strip() for p in parts if p) or ""


async def lookup_by_plate(plate: str) -> SivLookup:
    """Dimensions pneus et identité du véhicule.

    Args:
        plate: Plaque nettoyée (ex. "HG066TH"), sans tirets ni espaces.

    Returns:
        `SivLookup` : `dimensions` (liste de dicts width/height/diameter/
        load_index/speed_rating, vide si le véhicule est connu sans
        dimensions) et `vehicle` (libellé lisible, éventuellement vide).

    Raises:
        ValueError: SIV_API_KEY non configurée.
        PlateAccessError: clé refusée, quota épuisé, provider en panne.
        RuntimeError: plaque inconnue du provider.
        httpx.HTTPError: transport.
    """
    api_key = settings.siv_api_key
    if not api_key:
        raise ValueError("SIV_API_KEY non configurée")

    url = resolve_url()
    # Redirections NON suivies, volontairement : l'URL porte le jeton en
    # clair dans sa query string, et suivre un 30x l'enverrait à un hôte
    # qu'on n'a pas choisi. Une redirection est ici le symptôme d'une
    # URL périmée, pas un détour normal.
    async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
        resp = await client.get(
            url,
            # Forme exacte relevée sur un appel qui fonctionne :
            #   /plaque?vin=&immatriculation=HG066TH&token=…
            # Le jeton s'appelle `token` (et non `key`), et `vin` est
            # attendu même vide — le provider accepte l'un OU l'autre.
            params={"token": api_key, "immatriculation": plate, "vin": ""},
            headers={"Accept": "application/json"},
        )

    # Une redirection signifie qu'on frappe à la mauvaise porte. Le dire
    # explicitement : « 301 Moved Permanently » ne désigne pas sa cause,
    # et on a passé du temps dessus.
    if 300 <= resp.status_code < 400:
        raise PlateAccessError(
            f"URL périmée ({url}) : le provider redirige "
            f"(HTTP {resp.status_code}). Attendu : {DEFAULT_URL} — "
            "retirez SIV_API_URL de votre .env."
        )

    # Le provider peut signaler le refus par le statut HTTP autant que
    # dans le corps : on regarde les deux plutôt que de parier.
    if resp.status_code in _ACCESS_ERROR_CODES:
        raise PlateAccessError(f"HTTP {resp.status_code}")
    if resp.status_code == 404:
        raise PlateAccessError(
            f"Endpoint introuvable ({url}). Retirez SIV_API_URL de "
            "votre .env pour repartir sur la valeur par défaut."
        )
    resp.raise_for_status()

    payload = resp.json()
    if not isinstance(payload, dict):
        raise RuntimeError("Réponse inattendue du service immatriculation")

    code = payload.get("code_erreur")
    if isinstance(code, (int, str)) and str(code).isdigit():
        code_int = int(code)
        if code_int in _ACCESS_ERROR_CODES:
            raise PlateAccessError(
                f"code_erreur={code_int} {payload.get('message') or ''}".strip()
            )
        if code_int != 200:
            raise RuntimeError("Plaque non trouvée")

    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload

    # `erreur` vaut "" quand tout va bien — d'où le test sur la valeur
    # et non sur la présence de la clé.
    if str(data.get("erreur") or data.get("Erreur") or "").strip():
        raise RuntimeError("Plaque non trouvée")

    if not (data.get("marque") or data.get("Marque")):
        raise RuntimeError("Plaque non reconnue ou réponse inattendue")

    return SivLookup(
        dimensions=_parse_response(payload),
        vehicle=vehicle_label(payload),
        brand_logo=brand_logo_url(payload),
    )
