import Link from "next/link";

// Marques principales disponibles — texte stylé (pas de logo pour éviter
// les soucis de droits d'image / hotlinking)
const BRANDS = [
  "Michelin", "Continental", "Goodyear", "Bridgestone", "Pirelli",
  "Dunlop", "Hankook", "Yokohama", "Kleber", "Uniroyal",
  "BFGoodrich", "Falken",
];

export function Brands() {
  return (
    <section className="border-y border-line bg-paper-dim">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-8 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-signal">
            Toutes les grandes marques
          </p>
          <h2 className="font-display text-2xl font-black tracking-tightest text-ink md:text-3xl">
            Des références premium et tribu accessibles
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {BRANDS.map((b) => (
            <Link
              key={b}
              href={`/recherche?brand=${encodeURIComponent(b)}`}
              className="flex items-center justify-center rounded-lg border border-line bg-paper px-3 py-4 text-center font-display text-sm font-bold text-ink-soft transition hover:border-signal hover:text-signal"
            >
              {b}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
