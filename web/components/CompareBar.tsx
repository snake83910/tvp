"use client";

import Link from "next/link";
import { useCompare } from "@/components/CompareProvider";

/** Barre flottante récapitulant les pneus sélectionnés pour comparaison.
 * Placée au-dessus du bouton « Filtres » mobile pour ne pas le masquer. */
export function CompareBar() {
  const { items, count, max, remove, clear } = useCompare();
  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 px-4 lg:bottom-4">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-line bg-paper p-3 shadow-lift">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          Comparateur ({count}/{max})
        </span>

        <div className="flex flex-1 flex-wrap gap-2">
          {items.map((t) => (
            <span
              key={t.supplier_ref}
              className="inline-flex items-center gap-1.5 rounded-full bg-paper-dim px-2.5 py-1 text-xs font-semibold text-ink-soft"
            >
              <span className="max-w-[120px] truncate">
                {t.brand} {t.model}
              </span>
              <button
                onClick={() => remove(t.supplier_ref)}
                className="text-ink-muted hover:text-signal"
                aria-label={`Retirer ${t.brand} ${t.model}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        <button
          onClick={clear}
          className="text-xs font-semibold text-ink-muted underline hover:text-signal"
        >
          Effacer
        </button>

        {count >= 2 ? (
          <Link
            href="/comparer"
            className="rounded-full bg-signal px-5 py-2 text-sm font-bold text-white transition hover:bg-signal-dark"
          >
            Comparer
          </Link>
        ) : (
          <span className="rounded-full bg-paper-dim px-5 py-2 text-sm font-semibold text-ink-muted">
            Ajoutez-en un 2ᵉ
          </span>
        )}
      </div>
    </div>
  );
}
