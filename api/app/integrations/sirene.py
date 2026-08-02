"""Vérification d'un SIRET auprès de la base Sirene.

Utilise l'API publique recherche-entreprises.api.gouv.fr (DINUM) :
gratuite, sans clé. Best-effort : en cas d'indisponibilité on renvoie
`checked=False` pour ne PAS bloquer l'inscription d'un garage réel.
"""
import httpx

_URL = "https://recherche-entreprises.api.gouv.fr/search"


async def verify_siret(siret: str) -> dict:
    """Vérifie l'existence et l'activité d'un établissement par son SIRET.

    Renvoie un dict :
      - checked : l'API a répondu (sinon on ne conclut rien)
      - exists  : un établissement avec ce SIRET existe
      - active  : établissement administrativement actif (état « A »)
      - name    : raison sociale / nom complet, si trouvé
    """
    out = {"checked": False, "exists": False, "active": False, "name": None}
    siret = "".join(c for c in (siret or "") if c.isdigit())
    if len(siret) != 14:
        return out
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(_URL, params={"q": siret, "per_page": 5})
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError):
        return out

    out["checked"] = True
    for r in (data or {}).get("results") or []:
        etabs = list(r.get("matching_etablissements") or [])
        siege = r.get("siege")
        if siege:
            etabs.append(siege)
        for e in etabs:
            if str(e.get("siret")) == siret:
                out["exists"] = True
                out["active"] = e.get("etat_administratif") == "A"
                out["name"] = r.get("nom_complet") or r.get("nom_raison_sociale")
                return out
    return out
