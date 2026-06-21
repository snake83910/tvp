import Image from "next/image";
import Link from "next/link";

// Slug Maxityre (utilisé dans l'URL CDN du logo)
const BRANDS: { name: string; slug: string }[] = [
  { name: "Michelin", slug: "michelin" },
  { name: "Continental", slug: "continental" },
  { name: "Goodyear", slug: "goodyear" },
  { name: "Bridgestone", slug: "bridgestone" },
  { name: "Pirelli", slug: "pirelli" },
  { name: "Dunlop", slug: "dunlop" },
  { name: "Hankook", slug: "hankook" },
  { name: "Yokohama", slug: "yokohama" },
  { name: "Kleber", slug: "kleber" },
  { name: "Uniroyal", slug: "uniroyal" },
  { name: "BFGoodrich", slug: "bfgoodrich" },
  { name: "Falken", slug: "falken" },
];

const LOGO_BASE = "https://cdn.maxityre.com/assets/img/brand/medium";

export function Brands() {
  return (
    <section className="border-y border-line bg-paper-dim">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-8 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-signal">
            Toutes les grandes marques
          </p>
          <h2 className="font-display text-2xl font-black tracking-tightest text-ink md:text-3xl">
            Des références premium aux marques accessibles
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {BRANDS.map((b) => (
            <Link
              key={b.slug}
              href={`/recherche?brand=${encodeURIComponent(b.name)}`}
              className="group flex h-24 items-center justify-center rounded-lg border border-line bg-paper p-4 transition hover:border-signal hover:shadow-card"
              title={b.name}
              aria-label={b.name}
            >
              <Image
                src={`${LOGO_BASE}/${b.slug}.jpg`}
                alt={b.name}
                width={120}
                height={60}
                className="h-full w-auto object-contain opacity-80 transition group-hover:opacity-100"
                unoptimized
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
