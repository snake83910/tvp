"""Normalisation des numéros de téléphone français.

Ces numéros ne sont plus décoratifs : ce sont EUX qui partent chez le
fournisseur avec l'adresse de livraison. Un numéro absent fait refuser
l'adresse ; un numéro mal formé fait échouer la livraison, ce qui coûte
bien plus cher.

D'où une forme canonique unique en base — dix chiffres, `0611223344` —
quelle que soit la saisie. Le client tape ce qu'il veut ; le
transporteur reçoit quelque chose d'exploitable.
"""
from __future__ import annotations

#: Préfixes mobiles et fixes valides en France métropolitaine et outre-mer.
#: 01-05 fixe, 06/07 mobile, 09 non géographique. On exclut 08 :
#: numéros spéciaux surtaxés, qu'un transporteur ne peut pas appeler.
_VALID_PREFIXES = ("01", "02", "03", "04", "05", "06", "07", "09")

MESSAGE = (
    "Numéro de téléphone invalide. Attendu : 10 chiffres commençant par "
    "01 à 07 ou 09 (ex. 06 12 34 56 78)."
)


def normalize_fr(raw: str | None) -> str | None:
    """Rend le numéro en dix chiffres, ou None s'il est inexploitable.

    Accepte les formes usuelles — espaces, points, tirets, `+33`,
    `0033` — parce que les refuser ferait échouer des inscriptions
    légitimes sur une question de présentation.
    """
    if not raw:
        return None

    digits = "".join(c for c in str(raw) if c.isdigit())

    # +33 6 11 22 33 44 -> 0611223344. Le `+` est perdu au filtrage,
    # d'où le test sur le préfixe et la longueur.
    if digits.startswith("0033"):
        digits = "0" + digits[4:]
    elif digits.startswith("33") and len(digits) == 11:
        digits = "0" + digits[2:]

    if len(digits) != 10 or not digits.startswith(_VALID_PREFIXES):
        return None
    return digits


def format_fr(digits: str | None) -> str:
    """Présentation lisible : 06 11 22 33 44. Pour l'affichage seulement."""
    d = digits or ""
    if len(d) != 10:
        return d
    return " ".join(d[i:i + 2] for i in range(0, 10, 2))
