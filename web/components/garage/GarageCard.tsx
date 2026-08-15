import Link from "next/link";
import type { GarageNearby } from "@/lib/api";
import { formatEuro } from "@/lib/money";

/**
 * Carte d'un garage partenaire dans une liste.
 *
 * Partagée par la recherche (/montage-pneu) et les pages ville
 * (/montage-pneu/[ville]), qui en avaient chacune leur version. Les deux
 * avaient dérivé : la page ville ne montrait ni les prestations, ni la
 * précision « réglé sur place », et personne n'y avait ajouté la prise de
 * rendez-vous en ligne. C'est la version riche qui gagne — les données
 * étaient déjà là, seul l'affichage manquait.
 *
 * Les listes restent propres à chaque page : la recherche pose ses cartes
 * dans une grille à côté de la carte géographique, la page ville sur
 * toute la largeur. Seule la carte est commune.
 */
export function GarageCard({
  garage: g,
  // La page ville place ces cartes directement sous son h1 ; la recherche
  // les place sous un h2 de comptage. Le niveau de titre suit la
  // hiérarchie réelle du document plutôt qu'une valeur figée.
  headingLevel = "h3",
}: {
  garage: GarageNearby;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <li className="rounded-2xl border border-line bg-paper p-6 shadow-card transition hover:border-signal">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading className="font-display text-lg font-bold text-ink">
            {g.name}
          </Heading>
          <p className="mt-1 text-sm text-ink-muted">
            {g.address}, {g.postal_code} {g.city}
          </p>
        </div>
        {/* Absente des pages ville : la distance n'a de sens que
            relativement à une recherche. */}
        {g.distance_km != null && (
          <span className="shrink-0 rounded-full bg-signal-light px-3 py-1 text-xs font-bold text-signal">
            à {g.distance_km} km
          </span>
        )}
      </div>

      {(g.services.length > 0 || g.appointments_enabled) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {g.appointments_enabled && (
            <span className="rounded-full bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok">
              Rendez-vous en ligne
            </span>
          )}
          {g.services.slice(0, 6).map((s) => (
            <span
              key={s}
              className="rounded-full bg-paper-dim px-2.5 py-1 text-xs font-medium text-ink-soft"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {g.mounting_price_cents > 0 ? (
          <span className="text-sm text-ink-soft">
            Montage{" "}
            <span className="font-bold text-ink">
              {formatEuro(g.mounting_price_cents / 100)}
            </span>
            /pneu <span className="text-ink-muted">(réglé sur place)</span>
          </span>
        ) : (
          <span className="text-sm text-ink-muted">
            Tarif de montage indiqué sur la fiche
          </span>
        )}
        <Link
          href={`/garages/${g.slug}`}
          className="rounded-full bg-ink px-5 py-2 text-sm font-bold text-paper transition hover:bg-signal"
        >
          Voir la fiche
        </Link>
      </div>
    </li>
  );
}
