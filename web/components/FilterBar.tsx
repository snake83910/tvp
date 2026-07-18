"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
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
  const [mobileOpen, setMobileOpen] = useState(false);

  function setParam(key: string, value: string | null) {
    const q = new URLSearchParams(params.toString());
    if (value) q.set(key, value);
    else q.delete(key);
    if (key !== "page") q.delete("page"); // tout changement de filtre -> page 1
    router.push(`/recherche?${q.toString()}`);
  }

  const currentBrands = (params.get("brand") ?? "")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
  const currentSeason = params.get("season") ?? "";
  const currentSort = params.get("sort") ?? "price_asc";
  const current3pmsf = params.get("three_pmsf") === "1";
  const currentMin = params.get("min_price") ?? "";
  const currentMax = params.get("max_price") ?? "";

  function toggleBrand(brand: string) {
    const next = currentBrands.includes(brand)
      ? currentBrands.filter((b) => b !== brand)
      : [...currentBrands, brand];
    setParam("brand", next.length ? next.join(",") : null);
  }

  // Chips des filtres actifs, effaçables individuellement
  const activeChips: { label: string; clear: () => void }[] = [
    ...currentBrands.map((b) => ({
      label: b,
      clear: () => toggleBrand(b),
    })),
    ...(currentSeason
      ? [{ label: SEASON_LABEL[currentSeason] ?? currentSeason, clear: () => setParam("season", null) }]
      : []),
    ...(current3pmsf
      ? [{ label: "❄ 3PMSF", clear: () => setParam("three_pmsf", null) }]
      : []),
    ...(currentMin
      ? [{ label: `≥ ${currentMin} €`, clear: () => setParam("min_price", null) }]
      : []),
    ...(currentMax
      ? [{ label: `≤ ${currentMax} €`, clear: () => setParam("max_price", null) }]
      : []),
  ];

  function clearAll() {
    const q = new URLSearchParams(params.toString());
    ["brand", "season", "three_pmsf", "min_price", "max_price", "page"].forEach(
      (k) => q.delete(k),
    );
    router.push(`/recherche?${q.toString()}`);
  }

  const filtersContent = (
    <div className="space-y-8">
      <div>
        <p className="mb-1 font-display text-2xl font-black">{total}</p>
        <p className="text-xs uppercase tracking-wider text-ink-muted">
          pneu{total > 1 ? "s" : ""} trouvé{total > 1 ? "s" : ""}
        </p>
      </div>

      {activeChips.length > 0 && (
        <div>
          <div className="flex flex-wrap gap-2">
            {activeChips.map((c) => (
              <button
                key={c.label}
                onClick={c.clear}
                className="inline-flex items-center gap-1.5 rounded-full border border-signal bg-signal/10 px-3 py-1 text-xs font-semibold text-signal transition hover:bg-signal hover:text-white"
                title="Retirer ce filtre"
              >
                {c.label} <span aria-hidden>✕</span>
              </button>
            ))}
          </div>
          <button
            onClick={clearAll}
            className="mt-2 text-xs font-semibold text-ink-muted underline hover:text-signal"
          >
            Tout effacer
          </button>
        </div>
      )}

      <FilterGroup label="Trier par">
        <select
          value={currentSort}
          onChange={(e) => setParam("sort", e.target.value)}
          className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-signal"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </FilterGroup>

      <FilterGroup label="Homologation hiver">
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2.5 text-sm text-ink-soft transition hover:border-signal/50">
          <input
            type="checkbox"
            checked={current3pmsf}
            onChange={(e) =>
              setParam("three_pmsf", e.target.checked ? "1" : null)
            }
            className="accent-signal"
          />
          <span>
            ❄ 3PMSF{" "}
            <span className="block text-[11px] text-ink-muted">
              Conforme Loi Montagne
            </span>
          </span>
        </label>
      </FilterGroup>

      <FilterGroup label="Marque">
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {facets.brands.map((b) => (
            <label
              key={b}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-soft transition hover:bg-paper-dim"
            >
              <input
                type="checkbox"
                checked={currentBrands.includes(b)}
                onChange={() => toggleBrand(b)}
                className="accent-signal"
              />
              <span className="flex-1 truncate">{b}</span>
              {facets.brand_counts?.[b] != null && (
                <span className="text-xs text-ink-muted">
                  {facets.brand_counts[b]}
                </span>
              )}
            </label>
          ))}
        </div>
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
        {/* form : les bornes s'appliquent sur Entrée ET à la perte de focus */}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const q = new URLSearchParams(params.toString());
            const min = String(fd.get("min") ?? "");
            const max = String(fd.get("max") ?? "");
            if (min) q.set("min_price", min);
            else q.delete("min_price");
            if (max) q.set("max_price", max);
            else q.delete("max_price");
            q.delete("page");
            router.push(`/recherche?${q.toString()}`);
          }}
        >
          <input
            type="number"
            name="min"
            placeholder="Min"
            defaultValue={currentMin}
            onBlur={(e) => {
              if (e.target.value !== currentMin)
                setParam("min_price", e.target.value || null);
            }}
            className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-signal"
          />
          <input
            type="number"
            name="max"
            placeholder="Max"
            defaultValue={currentMax}
            onBlur={(e) => {
              if (e.target.value !== currentMax)
                setParam("max_price", e.target.value || null);
            }}
            className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-signal"
          />
          <button type="submit" className="sr-only">
            Appliquer les prix
          </button>
        </form>
      </FilterGroup>
    </div>
  );

  return (
    <>
      {/* Desktop : colonne latérale classique */}
      <aside className="hidden lg:block">{filtersContent}</aside>

      {/* Mobile : bouton sticky + panneau plein écran — les résultats
          restent visibles immédiatement au lieu d'être poussés sous
          la pile de filtres */}
      <div className="lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink px-6 py-3 text-sm font-bold text-paper shadow-lift"
        >
          Filtres{activeChips.length > 0 ? ` (${activeChips.length})` : ""} · {total} pneus
        </button>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40"
            onClick={() => setMobileOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Filtres"
          >
            <div
              className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-paper p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="font-display text-lg font-black text-ink">Filtres</p>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-ink-soft"
                >
                  Fermer
                </button>
              </div>
              {filtersContent}
              <button
                onClick={() => setMobileOpen(false)}
                className="mt-6 w-full rounded-full bg-signal py-3 font-display font-bold uppercase tracking-wide text-white"
              >
                Voir les {total} résultats
              </button>
            </div>
          </div>
        )}
      </div>
    </>
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
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
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
          ? "border-signal bg-signal/10 text-signal"
          : "border-line text-ink-soft hover:border-signal/50"
      }`}
    >
      {label}
    </button>
  );
}
