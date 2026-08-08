import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { api, type GarageNearby } from "@/lib/api";
import { formatEuro } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Trouver un garage partenaire pour le montage — tousvospneus.com",
  description:
    "Recherchez un garage partenaire près de chez vous pour le montage de vos pneus. Saisissez votre code postal et découvrez les garages, leurs prestations et leurs tarifs.",
  alternates: { canonical: "/garages" },
};

const RADII = [10, 20, 50, 100] as const;

type SP = {
  cp?: string;
  q?: string;
  radius?: string;
};

function GarageCard({ g }: { g: GarageNearby }) {
  return (
    <li className="rounded-2xl border border-line bg-paper p-6 shadow-card transition hover:border-signal">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-ink">{g.name}</h3>
          <p className="mt-1 text-sm text-ink-muted">
            {g.address}, {g.postal_code} {g.city}
          </p>
        </div>
        {g.distance_km != null && (
          <span className="shrink-0 rounded-full bg-signal-light px-3 py-1 text-xs font-bold text-signal">
            à {g.distance_km} km
          </span>
        )}
      </div>

      {g.services.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
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
            /pneu{" "}
            <span className="text-ink-muted">(réglé sur place)</span>
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

export default async function GaragesSearchPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const cp = (searchParams.cp || "").trim();
  const q = (searchParams.q || "").trim();
  const radius = RADII.includes(Number(searchParams.radius) as (typeof RADII)[number])
    ? Number(searchParams.radius)
    : 0; // 0 = pas de filtre de rayon
  const hasQuery = cp.length >= 4;

  let garages: GarageNearby[] | null = null;
  let error: string | null = null;

  if (hasQuery) {
    try {
      const res = await api.nearestGarages(cp, q || undefined, 20);
      // Filtre de rayon appliqué côté serveur (les garages sans distance
      // calculable sont conservés seulement si aucun rayon n'est demandé).
      garages = radius
        ? res.filter((g) => g.distance_km != null && g.distance_km <= radius)
        : res;
    } catch {
      error = "Recherche momentanément indisponible. Réessayez dans un instant.";
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-signal">
          Réseau partenaire
        </p>
        <h1 className="font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
          Trouver un garage partenaire
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Saisissez votre code postal pour découvrir les garages partenaires les
          plus proches, leurs prestations et leurs tarifs de montage. Le garage
          se choisit ensuite au moment de la commande.
        </p>

        {/* Formulaire GET : l'URL porte la recherche (partageable, indexable) */}
        <form
          method="get"
          className="mt-8 grid gap-3 rounded-2xl border border-line bg-paper p-5 shadow-card sm:grid-cols-[1fr_1fr_auto_auto]"
        >
          <div>
            <label
              htmlFor="cp"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted"
            >
              Code postal
            </label>
            <input
              id="cp"
              name="cp"
              defaultValue={cp}
              inputMode="numeric"
              placeholder="83560"
              className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-signal"
            />
          </div>
          <div>
            <label
              htmlFor="q"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted"
            >
              Ville (facultatif)
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Rians"
              className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-signal"
            />
          </div>
          <div>
            <label
              htmlFor="radius"
              className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted"
            >
              Rayon
            </label>
            <select
              id="radius"
              name="radius"
              defaultValue={radius ? String(radius) : ""}
              className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-signal"
            >
              <option value="">Tous</option>
              {RADII.map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="h-11 w-full rounded-lg bg-signal px-6 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark sm:w-auto"
            >
              Chercher
            </button>
          </div>
        </form>

        {/* Résultats */}
        <div className="mt-8">
          {!hasQuery && (
            <div className="rounded-2xl border border-dashed border-line bg-paper-dim p-8 text-center text-sm text-ink-muted">
              Entrez un code postal (au moins 4 chiffres) pour lancer la
              recherche.
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-signal-light px-4 py-3 text-sm text-signal-dark">
              {error}
            </p>
          )}

          {hasQuery && !error && garages && garages.length === 0 && (
            <div className="rounded-2xl border border-line bg-paper p-8 text-center">
              <p className="font-display text-lg font-bold text-ink">
                Aucun garage partenaire trouvé
              </p>
              <p className="mt-2 text-sm text-ink-soft">
                {radius
                  ? `Aucun garage dans un rayon de ${radius} km. Élargissez le rayon ou optez pour la livraison à domicile.`
                  : "Aucun garage partenaire près de ce code postal. Optez pour la livraison à domicile."}
              </p>
              <Link
                href="/recherche"
                className="mt-5 inline-block rounded-full bg-signal px-7 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark"
              >
                Rechercher mes pneus
              </Link>
            </div>
          )}

          {hasQuery && garages && garages.length > 0 && (
            <>
              <p className="mb-4 text-sm text-ink-muted">
                {garages.length} garage{garages.length > 1 ? "s" : ""} partenaire
                {garages.length > 1 ? "s" : ""} trouvé
                {garages.length > 1 ? "s" : ""}
                {radius ? ` dans un rayon de ${radius} km` : ""}.
              </p>
              <ul className="space-y-4">
                {garages.map((g) => (
                  <GarageCard key={g.id} g={g} />
                ))}
              </ul>
            </>
          )}
        </div>

        <p className="mt-10 text-sm text-ink-soft">
          En savoir plus sur le{" "}
          <Link href="/montage-pneu" className="font-semibold text-signal hover:underline">
            montage en garage partenaire
          </Link>
          .
        </p>
      </main>
    </>
  );
}
