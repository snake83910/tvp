/**
 * Formatage monétaire centralisé.
 *
 * Remplace les `x.toFixed(2).replace(".", ",")` dispersés : un seul
 * endroit pour le format français (virgule, espace insécable, €).
 */
const fmt = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

/** 1234.5 -> "1 234,50 €" */
export function formatEuro(amount: number): string {
  return fmt.format(amount);
}
