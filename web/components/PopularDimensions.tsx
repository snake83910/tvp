import Link from "next/link";
import { POPULAR_DIMENSIONS } from "@/lib/dimensions";
import { dimensionUrl, formatDimension } from "@/lib/slug";

/** Grille de liens vers les dimensions les plus recherchées. Sert le
 * maillage interne SEO (pages saison et pages dimension). */
export function PopularDimensions({
  title = "Dimensions populaires",
}: {
  title?: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {POPULAR_DIMENSIONS.map(([w, r, d]) => (
          <Link
            key={`${w}-${r}-${d}`}
            href={dimensionUrl(w, r, d)}
            className="rounded-lg border border-line bg-paper px-3 py-2.5 text-center font-mono text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal"
          >
            {formatDimension(w, r, d)}
          </Link>
        ))}
      </div>
    </section>
  );
}
