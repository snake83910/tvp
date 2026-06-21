import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SearchHero } from "@/components/SearchHero";
import { TrustBar } from "@/components/TrustBar";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Brands } from "@/components/home/Brands";
import { PopularDimensions } from "@/components/home/PopularDimensions";
import { Testimonials } from "@/components/home/Testimonials";
import { Faq } from "@/components/home/Faq";

const CONSEILS = [
  {
    t: "Où lire ma dimension ?",
    d: "Le marquage sur le flanc du pneu, décrypté.",
    icon: "📐",
  },
  {
    t: "Quand changer ses pneus ?",
    d: "Témoins d'usure, âge, signes d'alerte.",
    icon: "⚙️",
  },
  {
    t: "Été, hiver ou 4 saisons ?",
    d: "Le bon choix selon votre usage.",
    icon: "🌦️",
  },
];

// JSON-LD Organization + WebSite (SEO)
const ORG_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Tous Vos Pneus",
  url: "https://tousvospneus.com",
  logo: "https://tousvospneus.com/logo.png",
  sameAs: [],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: "contact@tousvospneus.com",
    availableLanguage: ["French"],
  },
};

const SITE_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Tous Vos Pneus",
  url: "https://tousvospneus.com",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://tousvospneus.com/recherche?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_LD) }} />

      <SiteHeader />

      <main>
        {/* ── Hero ────────────────────────────────────────────────── */}
        <section className="diag-accent">
          <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
            <div className="fade-up max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white/90 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                Livraison 48-72h en France
              </span>
              <h1 className="mt-5 font-display text-4xl font-black leading-[1.05] tracking-tightest text-white md:text-6xl">
                Le bon pneu,
                <br />
                au <span className="text-signal">meilleur prix</span>.
              </h1>
              <p className="mt-5 max-w-lg text-base text-white/75 md:text-lg">
                Des milliers de références au meilleur prix, livrées chez vous
                ou directement chez un garage partenaire pour le montage.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/recherche"
                  className="rounded-full bg-signal px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark"
                >
                  Voir le catalogue
                </Link>
                <a
                  href="#comment-ca-marche"
                  className="rounded-full border border-white/30 bg-white/5 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-white/10"
                >
                  Comment ça marche
                </a>
              </div>
            </div>

            <div className="fade-up mt-12 max-w-3xl">
              <SearchHero />
            </div>
          </div>
        </section>

        <TrustBar />

        {/* ── Comment ça marche ───────────────────────────────────── */}
        <div id="comment-ca-marche">
          <HowItWorks />
        </div>

        {/* ── Tailles populaires ──────────────────────────────────── */}
        <PopularDimensions />

        {/* ── Marques ─────────────────────────────────────────────── */}
        <Brands />

        {/* ── Avis clients ────────────────────────────────────────── */}
        <Testimonials />

        {/* ── CTA banner promo ────────────────────────────────────── */}
        <section className="bg-ink">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-12 md:flex-row">
            <div>
              <p className="font-display text-2xl font-black text-paper md:text-3xl">
                Livraison <span className="text-signal">offerte</span> dès 2 pneus
              </p>
              <p className="mt-1 text-sm text-paper/70">
                Sur toutes les commandes de 2 pneus identiques minimum. Sans engagement.
              </p>
            </div>
            <Link
              href="/recherche"
              className="rounded-full bg-signal px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark"
            >
              Rechercher mes pneus
            </Link>
          </div>
        </section>

        {/* ── Conseils ────────────────────────────────────────────── */}
        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="mb-10">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-signal">
              Conseils &amp; guides
            </p>
            <h2 className="font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
              Bien choisir, sans se tromper
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {CONSEILS.map((c) => (
              <article
                key={c.t}
                className="rounded-2xl border border-line bg-paper p-7 shadow-card transition hover:border-signal hover:shadow-lift"
              >
                <span className="text-3xl" aria-hidden>{c.icon}</span>
                <h3 className="mt-4 font-display text-lg font-bold text-ink">
                  {c.t}
                </h3>
                <p className="mt-2 text-sm text-ink-muted">{c.d}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <Faq />
      </main>
    </>
  );
}
