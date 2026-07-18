/**
 * Règle de livraison — MIROIR de app/modules/shipping/rules.py côté API.
 * Utilisée pour l'affichage (panier, checkout) ; le montant faisant foi
 * reste calculé côté serveur au checkout.
 */
export const SHIP_FLAT_HT = 6.9;
export const VAT_RATE = 0.2;
export const SHIP_FLAT_TTC = +(SHIP_FLAT_HT * (1 + VAT_RATE)).toFixed(2);

/** Livraison offerte uniquement si CHAQUE référence est en quantité >= 2. */
export function isFreeShipping(lineQuantities: number[]): boolean {
  return lineQuantities.length > 0 && lineQuantities.every((q) => q >= 2);
}

export function shippingTtc(lineQuantities: number[]): number {
  return isFreeShipping(lineQuantities) ? 0 : SHIP_FLAT_TTC;
}
