import type { TyreResult } from "@/lib/api";

const SEASON_LABEL: Record<string, string> = {
  ete: "Été",
  hiver: "Hiver",
  "4saisons": "4 saisons",
  inconnu: "—",
};

export function TyreCard({ tyre }: { tyre: TyreResult }) {
  const price = tyre.display_price.toFixed(2).replace(".", ",");

  return (
    <article className="group flex flex-col rounded-xl border border-ink-muted bg-ink-soft p-5 transition hover:border-signal/60">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold leading-tight">
            {tyre.brand}
          </p>
          <p className="text-sm text-bone-dim">{tyre.model}</p>
        </div>
        <span className="shrink-0 rounded-full border border-ink-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-bone-dim">
          {SEASON_LABEL[tyre.season] ?? tyre.season}
        </span>
      </div>

      <p className="mb-4 font-mono text-sm text-bone">
        {tyre.dimension}
      </p>

      {/* Label UE simplifié */}
      <div className="mb-5 flex gap-3 text-xs text-bone-dim">
        {tyre.load_index && (
          <span>
            Charge{" "}
            <span className="text-bone">{tyre.load_index}</span>
          </span>
        )}
        {tyre.speed_rating && (
          <span>
            Vitesse{" "}
            <span className="text-bone">{tyre.speed_rating}</span>
          </span>
        )}
      </div>

      <div className="mt-auto flex items-end justify-between border-t border-ink-muted pt-4">
        <div>
          <p className="font-display text-2xl font-black text-bone">
            {price} €
          </p>
          <p className="text-[11px] uppercase tracking-wider text-bone-dim">
            prix {tyre.display_mode}
          </p>
        </div>
        <button
          className="rounded-full bg-signal px-5 py-2.5 text-sm font-bold text-bone transition hover:bg-signal-dark"
          disabled
          title="Disponible en sous-phase suivante (panier)"
        >
          Ajouter
        </button>
      </div>
    </article>
  );
}
