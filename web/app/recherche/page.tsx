import { SiteHeader } from "@/components/SiteHeader";
import { SearchForm } from "@/components/SearchForm";
import { TyreCard } from "@/components/TyreCard";
import { api, type TyreResult } from "@/lib/api";

export const dynamic = "force-dynamic";

type SearchParams = {
  width?: string;
  ratio?: string;
  diameter?: string;
  season?: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { width, ratio, diameter, season } = searchParams;
  const hasQuery = width && ratio && diameter;

  let results: TyreResult[] = [];
  let error: string | null = null;

  if (hasQuery) {
    try {
      results = await api.searchByDimensions(
        Number(width),
        Number(ratio),
        Number(diameter),
        season || undefined,
      );
    } catch (e) {
      error =
        e instanceof Error
          ? e.message
          : "Erreur lors de la recherche";
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-7xl px-6 py-12">
        <h1 className="mb-8 font-display text-4xl font-black tracking-tightest md:text-5xl">
          Trouvez vos <span className="text-signal">pneus</span>
        </h1>

        <SearchForm />

        <div className="mt-12">
          {!hasQuery && (
            <p className="text-bone-dim">
              Renseignez les dimensions inscrites sur le flanc de
              votre pneu pour lancer la recherche.
            </p>
          )}

          {hasQuery && error && (
            <div className="rounded-xl border border-signal/40 bg-signal/5 p-6">
              <p className="font-semibold text-signal">
                La recherche a échoué
              </p>
              <p className="mt-1 text-sm text-bone-dim">{error}</p>
            </div>
          )}

          {hasQuery && !error && results.length === 0 && (
            <p className="text-bone-dim">
              Aucun pneu trouvé pour {width}/{ratio} R{diameter}.
              Vérifiez les dimensions ou essayez sans filtre de
              saison.
            </p>
          )}

          {results.length > 0 && (
            <>
              <p className="mb-6 text-sm text-bone-dim">
                <span className="font-bold text-bone">
                  {results.length}
                </span>{" "}
                pneu{results.length > 1 ? "s" : ""} pour {width}/
                {ratio} R{diameter}
              </p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((t) => (
                  <TyreCard key={t.supplier_ref} tyre={t} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
