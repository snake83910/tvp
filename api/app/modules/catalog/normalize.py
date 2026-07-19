"""
Normalisation des données pneu.

Le parsing de dimension est volontairement strict et testé : une dimension
mal interprétée = mauvais pneu livré = litige client. On ne devine pas.
"""
import re
from dataclasses import dataclass

SEASON_MAP = {
    "G": "4saisons",
    "S": "ete",
    "W": "hiver",
}


@dataclass
class TyreDimension:
    width: int           # 205
    aspect_ratio: int    # 55
    # int (16) ou float (22.5 poids lourd, 19.5, 17.5)
    diameter: int | float
    load_index: int | None = None   # 91
    speed_rating: str | None = None  # V (auto), D / A8 (agricole)

    def normalized(self) -> str:
        base = f"{self.width}/{self.aspect_ratio} R{self.diameter}"
        if self.load_index:
            base += f" {self.load_index}"
        if self.speed_rating:
            base += self.speed_rating
        return base


# Formats métriques gérés (ancrés : tout le motif doit matcher) :
#   205/55R16 91V        205/55 R16 91V       205/55ZR16
#   225/45R17 94W XL     265/70R16 112H
#   195/65 R15 91/89 T   (indices doubles -> on garde le 1er)
#   235/65 R16C 115/113R (utilitaire : C + indices doubles)
#   120/70 ZR17 58W      (moto)
#   315/70 R22.5 154/150L (poids lourd : diamètre DÉCIMAL + indices doubles)
#   420/70 R24 130D / 139A8 (agricole : indice de vitesse A8, B...)
#
# Les formats NON métriques (pouces US type 31x10.50R15) sont volontairement
# REFUSÉS (-> None) plutôt que mal interprétés : un faux parsing = mauvais
# pneu livré = litige. Mieux vaut ne rien proposer que proposer faux.
_DIM_RE = re.compile(
    r"""
    ^\s*
    (?P<width>\d{2,3})        # largeur
    \s*/\s*                   # séparateur OBLIGATOIRE : / (format métrique)
    (?P<ratio>\d{2,3})        # rapport h/l
    \s*
    (?:[Zz]?[Rr])             # R / ZR (obligatoire en métrique tourisme)
    \s*
    (?P<diam>\d{2}(?:\.\d)?)  # diamètre 2 chiffres (15..22, ou 22.5 PL)
    (?P<comm>[Cc])?           # C = pneu utilitaire (commercial)
    (?:
        \s+
        (?P<load>\d{2,3})     # indice de charge
        (?:\s*/\s*\d{2,3})?   # indice de charge double éventuel (ignoré)
        \s*
        (?P<speed>[A-Za-z]\d?)?  # indice de vitesse (V, W... ou A8 agricole)
    )?
    \s*
    (?P<xl>XL|RF|RFT)?        # renforcé
    \s*$
    """,
    re.VERBOSE,
)


def parse_dimension(raw: str) -> TyreDimension | None:
    """Retourne None si la dimension est non reconnue (jamais une devinette)."""
    if not raw:
        return None
    m = _DIM_RE.match(raw.strip())
    if not m:
        return None
    try:
        diam_f = float(m.group("diam"))
    except ValueError:
        return None
    # 22.5 reste 22.5 (poids lourd) ; 16.0 redevient 16 (affichage propre)
    diameter: int | float = int(diam_f) if diam_f.is_integer() else diam_f
    return TyreDimension(
        width=int(m.group("width")),
        aspect_ratio=int(m.group("ratio")),
        diameter=diameter,
        load_index=int(m.group("load")) if m.group("load") else None,
        speed_rating=m.group("speed").upper() if m.group("speed") else None,
    )


def map_season(code: str | None) -> str:
    return SEASON_MAP.get((code or "").upper(), "inconnu")
