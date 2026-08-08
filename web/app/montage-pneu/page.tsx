import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { MontageFaq } from "@/components/montage/MontageFaq";

export const metadata = {
  title: "Montage de pneus en garage partenaire — tousvospneus.com",
  description:
    "Faites monter vos pneus près de chez vous. Commandez en ligne, vos pneus sont livrés au garage partenaire et montés sur rendez-vous : équilibrage, valves et contrôle inclus.",
  alternates: { canonical: "/montage-pneu" },
};

const STEPS = [
  {
    n: "01",
    title: "Commandez vos pneus",
    body:
      "Trouvez vos pneus par dimensions ou par plaque, puis choisissez « Montage chez un garage partenaire » au moment du paiement.",
  },
  {
    n: "02",
    title: "Livraison au garage",
    body:
      "Vos pneus sont expédiés directement au garage que vous avez sélectionné. Aucune manutention, rien à transporter.",
  },
  {
    n: "03",
    title: "Montage sur rendez-vous",
    body:
      "Vous convenez de la date avec le garage. Un professionnel monte, équilibre et contrôle vos pneus. Vous réglez la prestation sur place.",
  },
];

const PRESTATIONS = [
  {
    title: "Montage & démontage",
    body: "Dépose des anciens pneus et pose des nouveaux sur vos jantes existantes.",
  },
  {
    title: "Équilibrage des roues",
    body: "Réparti au gramme près pour supprimer les vibrations et l'usure prématurée.",
  },
  {
    title: "Remplacement des valves",
    body: "Les valves caoutchouc sont remplacées à chaque montage pour une étanchéité durable.",
  },
  {
    title: "Contrôle de la pression",
    body: "Chaque pneu est gonflé à la pression préconisée par le constructeur.",
  },
  {
    title: "Serrage au couple",
    body: "Roues resserrées à la clé dynamométrique, selon les valeurs du constructeur.",
  },
  {
    title: "Reprise des pneus usagés",
    body: "Vos anciens pneus sont repris et recyclés dans les règles par le garage.",
  },
];

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MontagePneuPage() {
  // JSON-LD : service de montage (SEO)
  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Montage de pneus",
    provider: {
      "@type": "Organization",
      name: "tousvospneus.com",
    },
    areaServed: "FR",
    description:
      "Montage de pneus dans un réseau de garages partenaires : commande en ligne, livraison au garage et montage sur rendez-vous.",
  };

  return (
    <>
      <SiteHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }}
      />

      {/* Hero */}
      <section className="border-b border-line bg-paper-dim">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center md:py-20">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-signal">
            Montage en garage partenaire
          </p>
          <h1 className="mx-auto max-w-3xl font-display text-3xl font-black tracking-tightest text-ink md:text-5xl">
            Vos pneus livrés et montés près de chez vous
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft md:text-base">
            Commandez vos pneus en ligne au meilleur prix, faites-les livrer
            directement chez un garage partenaire et prenez rendez-vous pour un
            montage clé en main. Zéro manutention, une pose par des
            professionnels.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/recherche"
              className="rounded-full bg-signal px-8 py-3 font-display text-sm font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark"
            >
              Rechercher mes pneus
            </Link>
            <Link
              href="/garages"
              className="rounded-full border border-line bg-paper px-8 py-3 font-display text-sm font-bold uppercase tracking-wide text-ink-soft transition hover:border-signal hover:text-signal"
            >
              Trouver un garage
            </Link>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-signal">
            Comment ça marche
          </p>
          <h2 className="font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
            Le montage en trois étapes
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="relative rounded-2xl border border-line bg-paper p-7 shadow-card transition hover:border-signal hover:shadow-lift"
            >
              <span className="absolute right-5 top-5 font-display text-3xl font-black text-paper-dim">
                {s.n}
              </span>
              <h3 className="mt-2 max-w-[14ch] font-display text-lg font-bold text-ink">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Deux façons de recevoir */}
      <section className="border-y border-line bg-paper-dim">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="mb-10 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-signal">
              Deux formules
            </p>
            <h2 className="font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
              Livraison à domicile ou montage en garage
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-paper p-7 shadow-card">
              <h3 className="font-display text-lg font-bold text-ink">
                Livraison à domicile
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Recevez vos pneus chez vous sous 48–72 h et faites-les monter par
                le professionnel de votre choix. La livraison est offerte dès 2
                pneus par référence.
              </p>
            </div>
            <div className="rounded-2xl border-2 border-signal bg-paper p-7 shadow-card">
              <span className="inline-block rounded-full bg-signal-light px-3 py-1 text-xs font-bold uppercase tracking-wider text-signal">
                Clé en main
              </span>
              <h3 className="mt-3 font-display text-lg font-bold text-ink">
                Montage en garage partenaire
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Vos pneus sont livrés au garage et montés sur rendez-vous. Vous ne
                manipulez rien : équilibrage, valves et contrôle de pression sont
                inclus, la prestation est réglée sur place.
              </p>
              <Link
                href="/garages"
                className="mt-4 inline-block text-sm font-semibold text-signal hover:underline"
              >
                Trouver un garage près de chez moi →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Prestations incluses */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-signal">
            La prestation
          </p>
          <h2 className="font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
            Ce qui est inclus au montage
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRESTATIONS.map((p) => (
            <div
              key={p.title}
              className="flex gap-4 rounded-2xl border border-line bg-paper p-6 shadow-card"
            >
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal-light text-signal">
                <Check />
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-ink">
                  {p.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {p.body}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-ink-muted">
          Le détail exact des prestations et des tarifs est indiqué sur la page
          de chaque garage partenaire, choisi au moment de la commande.
        </p>
      </section>

      {/* FAQ */}
      <MontageFaq />

      {/* CTA final */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="rounded-2xl border border-line bg-paper-dim p-8 text-center md:p-10">
          <h2 className="font-display text-2xl font-black tracking-tightest text-ink md:text-3xl">
            Prêt à faire monter vos pneus ?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-soft">
            Recherchez vos pneus, puis choisissez le montage en garage partenaire
            au moment du paiement.
          </p>
          <Link
            href="/recherche"
            className="mt-6 inline-block rounded-full bg-signal px-8 py-3 font-display text-sm font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark"
          >
            Rechercher mes pneus
          </Link>
          <p className="mt-6 text-sm text-ink-muted">
            Vous êtes garagiste ?{" "}
            <Link
              href="/partenaire/inscription"
              className="font-semibold text-signal hover:underline"
            >
              Rejoignez le réseau partenaire
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
