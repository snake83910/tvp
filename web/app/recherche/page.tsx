import { SiteHeader } from "@/components/SiteHeader";
import { SearchForm } from "@/components/SearchForm";
import { TyreCard } from "@/components/TyreCard";
import { FilterBar } from "@/components/FilterBar";
import { Pagination } from "@/components/Pagination";
import { api, type SearchResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

type SP = {
  width?: string;
  ratio?: string;
  diameter?: string;
  brand?: string;
  season?: string;
  min_price?: string;
  max_price?: string;
  sort?: string;
  page?: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const { width, ratio, diameter } = searchParams;
  const hasQuery = width && ratio && diameter;

  let data: SearchResponse | null = null;
  let error: string | null = null;

  if (hasQuery) {
    try {
      data = await api.searchByDimensions({
        width: Number(width),
        ratio: Number(ratio),
        diameter: Number(diameter),
        brand: searchParams.brand,
        season: searchParams.season,
        minPrice: searchParams.min_price
          ? Number(searchParams.min_price)
          : undefined,
        maxPrice: searchParams.max_price
          ? Number(searchParams.max_price)
          : undefined,
        sort: searchParams.sort,
        page: searchParams.page ? Number(searchParams.page) : 1,
      });
    } catch (e) {
      error =
        e instanceof Error ? e.message : "Erreur lors de la recherche";
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

        {!hasQuery && (
          <p className="mt-12 text-bone-dim">
            Renseignez les dimensions inscrites sur le flanc de votre
            pneu pour lancer la recherche.
          </p>
        )}

        {hasQuery && error && (
          <div className="mt-12 rounded-xl border border-signal/40 bg-signal/5 p-6">
            <p className="font-semibold text-signal">
              La recherche a échoué
            </p>
            <p className="mt-1 text-sm text-bone-dim">{error}</p>
          </div>
        )}

        {hasQuery && data && data.total === 0 && (
          <p className="mt-12 text-bone-dim">
            Aucun pneu trouvé pour {width}/{ratio} R{diameter} avec ces
            filtres. Essayez d&apos;élargir les critères.
          </p>
        )}

        {hasQuery && data && data.total > 0 && (
          <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[260px_1fr]">
            <FilterBar facets={data.facets} total={data.total} />

            <div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((t) => (
                  <TyreCard key={t.supplier_ref} tyre={t} />
                ))}
              </div>
              <Pagination page={data.page} pages={data.pages} />
              <p className="mt-6 text-center text-xs text-bone-dim">
                Page {data.page} sur {data.pages}
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
