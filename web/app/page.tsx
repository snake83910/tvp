import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function HomePage() {
  return (
    <>
      <SiteHeader />

      <main className="relative z-10">
        {/* HERO */}
        <section className="mx-auto max-w-7xl px-6 pb-24 pt-20 md:pt-32">
          <div className="fade-up">
            <p className="mb-6 inline-block border-l-2 border-signal pl-3 text-sm font-semibold uppercase tracking-[0.25em] text-bone-dim">
              Dropshipping pneumatique · Particuliers &amp; Pros
            </p>
            <h1 className="max-w-4xl font-display text-5xl font-black leading-[0.95] tracking-tightest md:text-7xl lg:text-8xl">
              LE BON PNEU.
              <br />
              <span className="text-signal">LE BON PRIX.</span>
              <br />
              LIVRÉ CHEZ VOUS.
            </h1>
            <p className="mt-8 max-w-xl text-lg text-bone-dim">
              Des milliers de références, sans intermédiaire inutile.
              Livraison à domicile ou montage chez un garage
              partenaire près de chez vous.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/recherche"
                className="sweep-line rounded-full bg-signal px-8 py-4 font-display text-base font-bold uppercase tracking-wide text-bone transition hover:bg-signal-dark"
              >
                Trouver mes pneus
              </Link>
              <Link
                href="/pro"
                className="rounded-full border border-ink-muted px-8 py-4 font-display text-base font-bold uppercase tracking-wide text-bone-dim transition hover:border-bone hover:text-bone"
              >
                Je suis un professionnel
              </Link>
            </div>
          </div>
        </section>

        {/* BANDE ARGUMENTS */}
        <section className="border-y border-ink-muted bg-ink-soft">
          <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-ink-muted md:grid-cols-3 md:divide-x md:divide-y-0">
            {[
              {
                k: "01",
                t: "Recherche précise",
                d: "Par dimensions ou par plaque d'immatriculation.",
              },
              {
                k: "02",
                t: "Prix transparent",
                d: "TTC pour les particuliers, HT pour les pros.",
              },
              {
                k: "03",
                t: "Livraison flexible",
                d: "À domicile ou chez un garage partenaire.",
              },
            ].map((f) => (
              <div key={f.k} className="px-6 py-10">
                <span className="font-display text-sm font-bold text-signal">
                  {f.k}
                </span>
                <h3 className="mt-3 font-display text-xl font-bold">
                  {f.t}
                </h3>
                <p className="mt-2 text-sm text-bone-dim">{f.d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-ink-muted">
        <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-bone-dim">
          <p>
            tousvospneus.com — SAS · SIREN 977 671 965 · TVA FR38
            977 671 965
          </p>
          <p className="mt-1">
            35 B Chemin des Beaumouilles, 13710 Fuveau
          </p>
        </div>
      </footer>
    </>
  );
}
