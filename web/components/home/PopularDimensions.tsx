import Link from "next/link";

const DIMS = [
  { w: 195, r: 65, d: 15 },
  { w: 205, r: 55, d: 16 },
  { w: 195, r: 55, d: 16 },
  { w: 225, r: 45, d: 17 },
  { w: 225, r: 40, d: 18 },
  { w: 215, r: 60, d: 16 },
  { w: 205, r: 60, d: 16 },
  { w: 235, r: 45, d: 18 },
  { w: 225, r: 50, d: 17 },
  { w: 215, r: 65, d: 16 },
  { w: 185, r: 65, d: 15 },
  { w: 245, r: 40, d: 18 },
];

export function PopularDimensions() {
  return (
    <section className="border-y border-line bg-paper-dim">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-signal">
              Tailles populaires
            </p>
            <h2 className="font-display text-2xl font-black tracking-tightest text-ink md:text-3xl">
              Trouvez la vôtre directement
            </h2>
          </div>
          <Link
            href="/recherche"
            className="text-sm font-semibold text-signal hover:underline"
          >
            Toutes les dimensions →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {DIMS.map((d) => (
            <Link
              key={`${d.w}-${d.r}-${d.d}`}
              href={`/recherche?width=${d.w}&ratio=${d.r}&diameter=${d.d}`}
              className="rounded-lg border border-line bg-paper px-3 py-3 text-center font-mono text-sm font-bold text-ink-soft transition hover:border-signal hover:bg-signal hover:text-white"
            >
              {d.w}/{d.r} R{d.d}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
