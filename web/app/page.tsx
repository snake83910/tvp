import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SearchHero } from "@/components/SearchHero";
import { TrustBar } from "@/components/TrustBar";

const CATEGORIES = [
  { t: "Pneus été", q: "?season=ete" },
  { t: "Pneus hiver", q: "?season=hiver" },
  { t: "Pneus 4 saisons", q: "?season=4saisons" },
  { t: "Toutes dimensions", q: "" },
];

const CONSEILS = [
  { t: "Où lire ma dimension ?", d: "Le marquage sur le flanc du pneu, décrypté." },
  { t: "Quand changer ses pneus ?", d: "Témoins d'usure, âge, signes d'alerte." },
  { t: "Été, hiver ou 4 saisons ?", d: "Le bon choix selon votre usage." },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />

      <main>
        <section className="diag-accent">
          <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
            <div className="fade-up max-w-2xl">
              <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-white/70">
                Pneus en ligne · Particuliers
              </p>
              <h1 className="font-display text-4xl font-black leading-tight tracking-tightest text-white md:text-6xl">
                Le bon pneu,
                <br />
                au <span className="text-signal">meilleur prix</span>.
              </h1>
              <p className="mt-5 max-w-lg text-base text-white/75">
                Des milliers de références livrées chez vous ou montées
                chez un garage partenaire près de chez vous.
              </p>
            </div>

            <div className="fade-up mt-10 max-w-3xl">
              <SearchHero />
            </div>
          </div>
        </section>

        <TrustBar />

        <section className="mx-auto max-w-7xl px-6 py-14">
          <h2 className="mb-6 font-display text-2xl font-black tracking-tightest text-ink">
            Parcourir le catalogue
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {CATEGORIES.map((c) => (
              <Link
                key={c.t}
                href={`/recherche${c.q}`}
                className="group rounded-xl border border-line bg-paper p-6 transition hover:border-signal hover:shadow-lift"
              >
                <span className="font-display text-lg font-bold text-ink group-hover:text-signal">
                  {c.t}
                </span>
                <p className="mt-1 text-sm text-ink-muted">Voir les offres →</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-t border-line bg-paper">
          <div className="mx-auto max-w-7xl px-6 py-14">
            <h2 className="mb-6 font-display text-2xl font-black tracking-tightest text-ink">
              Conseils &amp; guides
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {CONSEILS.map((c) => (
                <div
                  key={c.t}
                  className="rounded-xl border border-line p-6"
                >
                  <h3 className="font-display text-lg font-bold text-ink">
                    {c.t}
                  </h3>
                  <p className="mt-2 text-sm text-ink-muted">{c.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-ink">
        <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-paper/60">
          <p className="font-display font-bold text-paper">
            TOUSVOSPNEUS<span className="text-signal">.COM</span>
          </p>
          <p className="mt-3">
            SAS · SIREN 977 671 965 · TVA FR38 977 671 965
          </p>
          <p className="mt-1">35 B Chemin des Beaumouilles, 13710 Fuveau</p>
        </div>
      </footer>
    </>
  );
}
