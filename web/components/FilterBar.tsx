"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { SearchFacets } from "@/lib/api";

const SEASON_LABEL: Record<string, string> = {
  ete: "Été",
  hiver: "Hiver",
  "4saisons": "4 saisons",
  inconnu: "Non précisé",
};

const SORTS = [
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "brand", label: "Marque A→Z" },
];

export function FilterBar({
  facets,
  total,
}: {
  facets: SearchFacets;
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string | null) {
    const q = new URLSearchParams(params.toString());
    if (value) q.set(key, value);
    else q.delete(key);
    if (key !== "page") q.delete("page"); // tout changement de filtre -> page 1
    router.push(`/recherche?${q.toString()}`);
  }

  const currentBrand = params.get("brand") ?? "";
  const currentSeason = params.get("season") ?? "";
  const currentSort = params.get("sort") ?? "price_asc";

  return (
    <aside className="space-y-8">
      <div>
        <p className="mb-1 font-display text-2xl font-black">
          {total}
        </p>
        <p className="text-xs uppercase tracking-wider text-bone-dim">
          pneu{total > 1 ? "s" : ""} trouvé{total > 1 ? "s" : ""}
        </p>
      </div>

      <FilterGroup label="Trier par">
        <select
          value={currentSort}
          onChange={(e) => setParam("sort", e.target.value)}
          className="h-11 w-full rounded-lg border border-ink-muted bg-ink px-3 text-sm text-bone outline-none focus:border-signal"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </FilterGroup>

      <FilterGroup label="Marque">
        <select
          value={currentBrand}
          onChange={(e) => setParam("brand", e.target.value || null)}
          className="h-11 w-full rounded-lg border border-ink-muted bg-ink px-3 text-sm text-bone outline-none focus:border-signal"
        >
          <option value="">Toutes les marques</option>
          {facets.brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </FilterGroup>

      <FilterGroup label="Saison">
        <div className="space-y-2">
          <SeasonChip
            active={!currentSeason}
            label="Toutes"
            onClick={() => setParam("season", null)}
          />
          {facets.seasons.map((s) => (
            <SeasonChip
              key={s}
              active={currentSeason === s}
              label={SEASON_LABEL[s] ?? s}
              onClick={() => setParam("season", s)}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label={`Prix (${facets.price_min} – ${facets.price_max} €)`}>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            defaultValue={params.get("min_price") ?? ""}
            onBlur={(e) =>
              setParam("min_price", e.target.value || null)
            }
            className="h-11 w-full rounded-lg border border-ink-muted bg-ink px-3 text-sm text-bone outline-none focus:border-signal"
          />
          <input
            type="number"
            placeholder="Max"
            defaultValue={params.get("max_price") ?? ""}
            onBlur={(e) =>
              setParam("max_price", e.target.value || null)
            }
            className="h-11 w-full rounded-lg border border-ink-muted bg-ink px-3 text-sm text-bone outline-none focus:border-signal"
          />
        </div>
      </FilterGroup>
    </aside>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-bone-dim">
        {label}
      </p>
      {children}
    </div>
  );
}

function SeasonChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
        active
          ? "border-signal bg-signal/10 text-bone"
          : "border-ink-muted text-bone-dim hover:border-bone/40"
      }`}
    >
      {label}
    </button>
  );
}
