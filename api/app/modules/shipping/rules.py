"""
Règles d'expédition.

Politique métier (validée 2026) :
- Livraison à domicile gratuite SEULEMENT si toutes les lignes du panier
  ont une quantité >= 2 (autrement dit : aucune référence ne doit être
  à 1 seul pneu).
- Sinon 6,90 € HT + TVA 20 % = 8,28 € TTC.

Cas concrets :
  [2 Michelin]                -> gratuit (toutes >= 2)
  [2 Michelin, 2 Continental] -> gratuit
  [1 Michelin]                -> payant
  [1 Michelin, 2 Continental] -> payant (Michelin < 2)
  [4 Michelin]                -> gratuit

Frais de port = service en France métropolitaine -> TVA 20 %.
"""
from dataclasses import dataclass
from typing import Iterable

# Montants en centimes (jamais de float pour l'argent)
SHIPPING_FLAT_HT_CENTS = 690    # 6,90 € HT
SHIPPING_VAT_RATE = 0.20        # 20 % TVA
MIN_QTY_PER_LINE_FOR_FREE = 2   # toute ligne doit être >= 2 pour le gratuit


@dataclass(frozen=True)
class ShippingQuote:
    mode: str                   # "home" | "partner_garage"
    ht_cents: int
    vat_cents: int

    @property
    def ttc_cents(self) -> int:
        return self.ht_cents + self.vat_cents


def compute_home_shipping(
    line_quantities: Iterable[int],
) -> ShippingQuote:
    """
    Frais de port livraison à domicile.

    Args:
        line_quantities: liste des quantités PAR LIGNE du panier
                         (une entrée par référence distincte).

    Règle : gratuit ssi toutes les lignes ont >= 2 pneus.
    Un panier vide tombe en payant (sécurité, mais ne devrait pas arriver
    car le checkout refuse les paniers vides en amont).
    """
    qtys = list(line_quantities)
    if qtys and all(q >= MIN_QTY_PER_LINE_FOR_FREE for q in qtys):
        return ShippingQuote(mode="home", ht_cents=0, vat_cents=0)

    ht = SHIPPING_FLAT_HT_CENTS
    vat = round(ht * SHIPPING_VAT_RATE)
    return ShippingQuote(mode="home", ht_cents=ht, vat_cents=vat)
