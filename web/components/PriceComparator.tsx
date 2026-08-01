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
        <li className="flex items-center justify-between rounded-xl border-2 border-ok bg-ok/5 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-bold text-ink">
            <span className="inline-flex items-center rounded-full bg-ok px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              Notre prix
            </span>
            tousvospneus.com
          </span>
          <span className="font-display text-lg font-black text-ink">
            {formatEuro(ourPriceTtc)}
          </span>
        </li>

        {higher.map((m) => {
          const saving = m.price - ourPriceTtc;
          return (
            <li
              key={`${m.host}-${m.price}`}
              className="flex items-center justify-between rounded-xl border border-line px-4 py-3"
            >
              <span className="text-sm text-ink-soft">
                {cleanHost(m.host)}
              </span>
              <span className="flex items-baseline gap-3">
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
