import type { TyreResult } from "@/lib/api";

const SEASON: Record<string, string> = {
  ete: "Été", hiver: "Hiver", "4saisons": "4 saisons", inconnu: "—",
};

export function TyreCard({ tyre }: { tyre: TyreResult }) {
  const price = tyre.display_price.toFixed(2).replace(".", ",");
  return (
    <article className="flex flex-col rounded-xl border border-line bg-paper p-5 shadow-card transition hover:border-signal hover:shadow-lift">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-ink">{tyre.brand}</p>
          <p className="text-sm text-ink-muted">{tyre.model}</p>
        </div>
        <span className="shrink-0 rounded-full bg-paper-dim px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
          {SEASON[tyre.season] ?? tyre.season}
        </span>
      </div>
      <p className="mb-4 font-mono text-sm text-ink-soft">{tyre.dimension}</p>
      <div className="mb-5 flex gap-3 text-xs text-ink-muted">
        {tyre.load_index && <span>Charge <span className="font-semibold text-ink">{tyre.load_index}</span></span>}
        {tyre.speed_rating && <span>Vitesse <span className="font-semibold text-ink">{tyre.speed_rating}</span></span>}
      </div>
      <div className="mt-auto flex items-end justify-between border-t border-line pt-4">
        <div>
          <p className="font-display text-2xl font-black text-ink">{price} €</p>
          <p className="text-[11px] uppercase tracking-wider text-ink-muted">prix {tyre.display_mode}</p>
        </div>
        <button
          className="rounded-full bg-signal px-5 py-2.5 text-sm font-bold text-white transition hover:bg-signal-dark disabled:bg-line disabled:text-ink-muted"
          disabled
          title="Panier : sous-phase suivante"
        >
          Ajouter
        </button>
      </div>
    </article>
  );
}
