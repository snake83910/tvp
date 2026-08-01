import type { MarketPrice } from "@/lib/api";
import { formatEuro } from "@/lib/money";

/**
 * Comparateur de prix, façon Allopneus : on affiche uniquement les relevés
 * de concurrents PLUS CHERS que notre prix de vente TTC, pour mettre en
 * avant l'économie réalisée. Si aucun concurrent n'est plus cher (ou si on
 * n'a pas de relevé), le bloc ne s'affiche pas.
 */
export function PriceComparator({
  ourPriceTtc,
  marketPrices,
}: {
  ourPriceTtc: number;
  marketPrices?: MarketPrice[];
}) {
  const higher = (marketPrices ?? [])
    .filter((m) => m.price > ourPriceTtc)
    .sort((a, b) => b.price - a.price);

  if (higher.length === 0) return null;

  const maxSaving = higher[0].price - ourPriceTtc;

  return (
    <section className="rounded-2xl border border-line bg-paper p-6 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-black tracking-tightest text-ink">
          Comparatif des prix
        </h2>
        <p className="text-sm font-bold text-ok">
          Jusqu&apos;à {formatEuro(maxSaving)} d&apos;économie
        </p>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Prix TTC relevés chez d&apos;autres marchands pour ce pneu.
      </p>

      <ul className="mt-4 space-y-2">
        {/* Notre prix, mis en avant en tête de liste */}
        <li className="flex items-center justify-between gap-3 rounded-xl border-2 border-ok bg-ok/5 px-3 py-3 sm:px-4">
          <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-ink">
            <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-ok px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              Notre prix
            </span>
            <span className="hidden min-w-0 break-all sm:inline">tousvospneus.com</span>
          </span>
          <span className="shrink-0 font-display text-lg font-black text-ink">
            {formatEuro(ourPriceTtc)}
          </span>
        </li>

        {higher.map((m) => {
          const saving = m.price - ourPriceTtc;
          return (
            <li
              key={`${m.host}-${m.price}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-3 sm:px-4"
            >
              <span className="min-w-0 break-all text-sm text-ink-soft">
                {cleanHost(m.host)}
              </span>
              <span className="flex shrink-0 items-baseline gap-2 sm:gap-3 whitespace-nowrap">
                <span className="text-xs font-semibold text-signal">
                  +{formatEuro(saving)}
                </span>
                <span className="font-mono text-sm font-semibold text-ink-muted line-through">
                  {formatEuro(m.price)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "https://www.123pneus.fr/…" ou "123pneus.fr" -> "123pneus.fr" */
function cleanHost(host: string): string {
  return host
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}
