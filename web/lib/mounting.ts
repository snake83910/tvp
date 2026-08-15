"use client";

import type { GarageNearby, GaragePricingRow } from "@/lib/api";

/** Code postal du visiteur, mémorisé d'un écran à l'autre.
 *
 *  Saisi une fois sur la fiche produit, il pré-remplit la recherche de
 *  garage au checkout : redemander la même information à trois écrans
 *  d'intervalle est le genre de friction qui fait abandonner. */
export const POSTCODE_KEY = "tvp_postcode";

/** Correspondance grossière entre famille de véhicule du catalogue et
 *  type de véhicule de la grille tarifaire du garage. */
const VEHICLE_BY_CATEGORY: Record<string, string> = {
  auto: "voiture",
  moto: "moto",
  camion: "utilitaire",
};

/** Prix du montage d'UN pneu chez ce garage, en centimes.
 *
 *  Cherche la ligne tarifaire qui couvre le diamètre de jante consulté,
 *  en préférant celle du bon type de véhicule. À défaut de grille, le
 *  prix forfaitaire de la fiche sert de repli — c'est exactement le rôle
 *  que lui donne le modèle. Renvoie null si rien n'est renseigné :
 *  afficher « 0 € » serait un engagement que le garage n'a pas pris.
 */
export function mountingPriceCents(
  garage: Pick<GarageNearby, "mounting_price_cents" | "pricing">,
  diameter: number | null | undefined,
  category?: string | null,
): number | null {
  const rows: GaragePricingRow[] = garage.pricing ?? [];
  if (rows.length > 0 && diameter != null) {
    const fits = rows.filter(
      (r) => diameter >= r.size_min && diameter <= r.size_max,
    );
    if (fits.length > 0) {
      const wanted = VEHICLE_BY_CATEGORY[category ?? "auto"] ?? "voiture";
      const preferred = fits.find((r) => r.vehicle === wanted);
      // À défaut du bon type de véhicule, la ligne la moins chère : on
      // annonce un « à partir de », jamais un prix trop élevé.
      const row =
        preferred ??
        fits.reduce((a, b) => (a.price_cents <= b.price_cents ? a : b));
      return row.price_cents;
    }
  }
  return garage.mounting_price_cents > 0 ? garage.mounting_price_cents : null;
}

/** Code postal valide (France métropolitaine et DOM : 5 chiffres). */
export function isPostcode(value: string): boolean {
  return /^\d{5}$/.test(value.trim());
}
