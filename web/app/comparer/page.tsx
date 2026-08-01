"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { TyreImage } from "@/components/TyreImage";
import { TierBadge } from "@/components/TierBadge";
import { useCompare } from "@/components/CompareProvider";
import { brandTierLabel, type TyreResult } from "@/lib/api";
import { productUrl } from "@/lib/slug";
import { formatEuro } from "@/lib/money";

const SEASON: Record<string, string> = {
  ete: "Été",
  hiver: "Hiver",
  "4saisons": "4 saisons",
  inconnu: "—",
};

function link(t: TyreResult): string {
  return t.width != null && t.aspect_ratio != null && t.diameter != null
    ? productUrl({
        ref: t.supplier_ref,
        brand: t.brand,
        model: t.model,
        width: t.width,
        ratio: t.aspect_ratio,
        diameter: t.diameter,
        category: t.category,
      })
    : `/produit/${encodeURIComponent(t.supplier_ref)}`;
}

const grade = (v: unknown) => {
  const g = String(v ?? "").toUpperCase();
  return g && g !== "UNDEFINED" ? g : "—";
};

export default function ComparerPage() {
  const { items, remove, clear } = useCompare();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-black tracking-tightest text-ink">
            Comparateur de pneus
          </h1>
          {items.length > 0 && (
            <button
              onClick={clear}
              className="text-sm font-semibold text-ink-muted underline hover:text-signal"
            >
              Tout effacer
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-line bg-paper p-10 text-center">
            <p className="text-ink-muted">
              Aucun pneu sélectionné. Depuis les résultats de recherche,
              cliquez sur <strong>« ⇄ Comparer »</strong> sur 2 ou 3 pneus.
            </p>
            <Link
              href="/recherche"
              className="mt-4 inline-block rounded-full bg-signal px-6 py-3 text-sm font-bold text-white hover:bg-signal-dark"
            >
              Rechercher des pneus
            </Link>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr>
                  <th className="w-32" />
                  {items.map((t) => (
                    <th key={t.supplier_ref} className="p-3 align-top">
                      <div className="rounded-xl border border-line bg-paper p-3">
                        <div className="flex justify-end">
                          <button
                            onClick={() => remove(t.supplier_ref)}
                            className="text-ink-muted hover:text-signal"
                            aria-label={`Retirer ${t.brand} ${t.model}`}
                          >
                            ✕
                          </button>
                        </div>
                        <TyreImage
                          src={t.image_url}
                          alt={`${t.brand} ${t.model}`}
                          className="mx-auto h-24 w-full"
                        />
                        <p className="mt-2 text-center font-display text-sm font-black text-ink">
                          {t.brand}
                        </p>
                        <p className="truncate text-center text-xs text-ink-muted" title={t.model}>
                          {t.model}
                        </p>
                        <div className="mt-2 text-center">
                          <Link
                            href={link(t)}
                            className="text-xs font-semibold text-signal hover:underline"
                          >
                            Voir la fiche
                          </Link>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-sm">
                <CompareRow label="Prix">
                  {items.map((t) => (
                    <td key={t.supplier_ref} className="p-3 text-center">
                      <span className="font-display text-lg font-black text-ink">
                        {formatEuro(t.display_price)}
                      </span>
                      <span className="block text-[11px] text-ink-muted">
                        {t.display_mode}
                      </span>
                    </td>
                  ))}
                </CompareRow>
                <CompareRow label="Gamme">
                  {items.map((t) => (
                    <td key={t.supplier_ref} className="p-3 text-center">
                      {t.brand_tier ? <TierBadge tier={t.brand_tier} /> : "—"}
                    </td>
                  ))}
                </CompareRow>
                <CompareRow label="Dimension">
                  {items.map((t) => (
                    <td key={t.supplier_ref} className="p-3 text-center font-mono text-ink">
                      {t.dimension}
                    </td>
                  ))}
                </CompareRow>
                <CompareRow label="Saison">
                  {items.map((t) => (
                    <td key={t.supplier_ref} className="p-3 text-center text-ink-soft">
                      {SEASON[t.season] ?? t.season}
                    </td>
                  ))}
                </CompareRow>
                <CompareRow label="Carburant">
                  {items.map((t) => (
                    <td key={t.supplier_ref} className="p-3 text-center text-ink-soft">
                      {grade(t.eu_label?.grip)}
                    </td>
                  ))}
                </CompareRow>
                <CompareRow label="Adhérence pluie">
                  {items.map((t) => (
                    <td key={t.supplier_ref} className="p-3 text-center text-ink-soft">
                      {grade(t.eu_label?.wet)}
                    </td>
                  ))}
                </CompareRow>
                <CompareRow label="Bruit">
                  {items.map((t) => (
                    <td key={t.supplier_ref} className="p-3 text-center text-ink-soft">
                      {t.eu_label?.noise ? `${t.eu_label.noise} dB` : "—"}
                    </td>
                  ))}
                </CompareRow>
                <CompareRow label="Charge / Vitesse">
                  {items.map((t) => (
                    <td key={t.supplier_ref} className="p-3 text-center text-ink-soft">
                      {t.load_index ?? "—"}
                      {t.speed_rating ? ` ${t.speed_rating}` : ""}
                    </td>
                  ))}
                </CompareRow>
                <CompareRow label="Homologué hiver">
                  {items.map((t) => (
                    <td key={t.supplier_ref} className="p-3 text-center">
                      {t.is_3pmsf ? (
                        <span className="text-ok">❄ 3PMSF</span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                  ))}
                </CompareRow>
                <CompareRow label="Disponibilité">
                  {items.map((t) => (
                    <td key={t.supplier_ref} className="p-3 text-center text-ink-soft">
                      {t.stock == null
                        ? "—"
                        : t.stock <= 0
                          ? "Indisponible"
                          : t.stock <= 5
                            ? `Stock limité (${t.stock})`
                            : "En stock"}
                    </td>
                  ))}
                </CompareRow>
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}

function CompareRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr className="border-t border-line">
      <th
        scope="row"
        className="p-3 text-left text-xs font-bold uppercase tracking-wider text-ink-muted"
      >
        {label}
      </th>
      {children}
    </tr>
  );
}
