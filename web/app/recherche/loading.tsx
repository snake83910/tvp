import { SiteHeader } from "@/components/SiteHeader";
import { Skeleton } from "@/components/Skeleton";

/**
 * Affiché INSTANTANÉMENT par Next pendant que la page recherche
 * interroge Maxityre côté serveur (plusieurs secondes possibles).
 * Sans ce fichier, le clic sur « Rechercher » ne donnait aucun
 * feedback et les utilisateurs re-cliquaient.
 */
export default function SearchLoading() {
  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-7xl px-6 py-12">
        <h1 className="mb-8 font-display text-4xl font-black tracking-tightest md:text-5xl">
          Trouvez vos <span className="text-signal">pneus</span>
        </h1>

        {/* Formulaire de recherche */}
        <Skeleton className="h-40 w-full rounded-2xl" />

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[260px_1fr]">
          {/* Filtres */}
          <div className="hidden space-y-6 lg:block" aria-hidden>
            <Skeleton className="h-12 w-24" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>

          {/* Grille de cartes */}
          <div
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
            aria-busy="true"
            aria-label="Recherche des pneus en cours"
          >
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className="rounded-xl border border-line bg-paper p-5 shadow-card"
              >
                <Skeleton className="mb-4 h-40 w-full rounded-lg" />
                <Skeleton className="mb-2 h-5 w-2/3" />
                <Skeleton className="mb-4 h-4 w-1/2" />
                <Skeleton className="h-10 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-ink-muted">
          Interrogation du stock en temps réel…
        </p>
      </main>
    </>
  );
}
