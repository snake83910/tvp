"""
Règles d'expédition.

Politique métier (validée juillet 2026) — PAR FAMILLE de véhicule :

  famille   | ligne à 1 pneu | toutes les lignes >= 2 pneus
  ----------|----------------|------------------------------
  auto      | 6,90 € HT      | gratuit
  quad      | 6,90 € HT      | gratuit
  camion    | 15,00 € HT     | gratuit
  agricole  | 15,00 € HT     | gratuit
  moto      | GRATUIT        | gratuit

- Le seuil de gratuité s'apprécie PAR LIGNE (par référence) : une ligne
  à 1 seul pneu déclenche le forfait de sa famille.
- Le forfait s'applique à la COMMANDE, pas par ligne : si plusieurs
  lignes déclenchent des frais, on facture le forfait le PLUS ÉLEVÉ
  (une seule expédition), pas la somme.

Cas concrets :
  [2 Michelin auto]                    -> gratuit
  [1 Michelin auto]                    -> 6,90 € HT
  [1 pneu camion]                      -> 15,00 € HT
  [1 auto, 1 camion]                   -> 15,00 € HT (max, pas 21,90)
  [1 moto]                             -> gratuit (moto toujours offert)
  [1 moto, 1 auto]                     -> 6,90 € HT (l'auto seule paie)

Frais de port = service en France métropolitaine -> TVA 20 %.
"""
from dataclasses import dataclass
from typing import Iterable

# Montants en centimes (jamais de float pour l'argent)
CATEGORY_FLAT_HT_CENTS: dict[str, int] = {
    "auto": 690,       # 6,90 € HT
    "quad": 690,
    "camion": 1500,    # 15,00 € HT
    "agricole": 1500,
    "moto": 0,         # toujours offert
}
DEFAULT_FLAT_HT_CENTS = 690     # famille inconnue : forfait auto
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


def category_flat_ht_cents(category: str) -> int:
    """Forfait HT (centimes) d'une famille de véhicule."""
    return CATEGORY_FLAT_HT_CENTS.get(category, DEFAULT_FLAT_HT_CENTS)


def compute_home_shipping(
    lines: Iterable[tuple[str, int]],
) -> ShippingQuote:
    """
    Frais de port livraison à domicile.

    Args:
        lines: (famille, quantité) PAR LIGNE du panier
               (une entrée par référence distincte).

    Un panier vide est gratuit (le checkout refuse les paniers vides en
    amont ; la sérialisation panier gère le cas vide séparément).
    """
    fees = [
        category_flat_ht_cents(category)
        for category, qty in lines
        if qty < MIN_QTY_PER_LINE_FOR_FREE
        and category_flat_ht_cents(category) > 0
    ]
    ht = max(fees, default=0)
    vat = round(ht * SHIPPING_VAT_RATE)
    return ShippingQuote(mode="home", ht_cents=ht, vat_cents=vat)
