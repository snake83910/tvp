import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { MontageFaq } from "@/components/montage/MontageFaq";
import { GaragesMap } from "@/components/montage/GaragesMap";
import { api, type GarageNearby } from "@/lib/api";
import { formatEuro } from "@/lib/money";

export const metadata = {
  title: "Montage de pneus en garage partenaire — tousvospneus.com",
  description:
    "Trouvez un garage partenaire près de chez vous et faites monter vos pneus. Commandez en ligne, vos pneus sont livrés au garage et montés sur rendez-vous : équilibrage, valves et contrôle inclus.",
  alternates: { canonical: "/montage-pneu" },
};

const RADII = [10, 20, 50, 100] as const;

type SP = {
  q?: string;
  radius?: string;
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

function GarageCard({ g }: { g: GarageNearby }) {
  return (
    <li className="rounded-2xl border border-line bg-paper p-6 shadow-card transition hover:border-signal">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-ink">{g.name}</h3>
          <p className="mt-1 text-sm text-ink-muted">
            {g.address}, {g.postal_code} {g.city}
          </p>
        </div>
        {g.distance_km != null && (
          <span className="shrink-0 rounded-full bg-signal-light px-3 py-1 text-xs font-bold text-signal">
            à {g.distance_km} km
          </span>
        )}
      </div>

      {g.services.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {g.services.slice(0, 6).map((s) => (
            <span
              key={s}
              className="rounded-full bg-paper-dim px-2.5 py-1 text-xs font-medium text-ink-soft"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {g.mounting_price_cents > 0 ? (
          <span className="text-sm text-ink-soft">
            Montage{" "}
            <span className="font-bold text-ink">
              {formatEuro(g.mounting_price_cents / 100)}
            </span>
            /pneu <span className="text-ink-muted">(réglé sur place)</span>
          </span>
        ) : (
          <span className="text-sm text-ink-muted">
            Tarif de montage indiqué sur la fiche
          </span>
        )}
        <Link
          href={`/garages/${g.slug}`}
          className="rounded-full bg-ink px-5 py-2 text-sm font-bold text-paper transition hover:bg-signal"
        >
          Voir la fiche
        </Link>
      </div>
    </li>
  );
}

export default async function MontagePneuPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const q = (searchParams.q || "").trim();
  const radius = RADII.includes(
    Number(searchParams.radius) as (typeof RADII)[number],
  )
    ? Number(searchParams.radius)
    : 0; // 0 = pas de filtre de rayon
  const hasQuery = q.length >= 2;

  let garages: GarageNearby[] | null = null;
  let error: string | null = null;

  if (hasQuery) {
    try {
      const res = await api.nearestGarages(q, 20);
      garages = radius
        ? res.filter((g) => g.distance_km != null && g.distance_km <= radius)
        : res;
    } catch {
      error = "Recherche momentanément indisponible. Réessayez dans un instant.";
    }
  }

  const mappable = (garages || []).filter((g) => g.lat != null && g.lng != null);

  // JSON-LD : service de montage (SEO)
  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Montage de pneus",
    provider: { "@type": "Organization", name: "tousvospneus.com" },
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

      {/* Hero + recherche */}
      <section className="border-b border-line bg-paper-dim">
        <div className="mx-auto max-w-5xl px-6 py-14 text-center md:py-16">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-signal-dark">
            Montage en garage partenaire
          </p>
          <h1 className="mx-auto max-w-3xl font-display text-3xl font-black tracking-tightest text-ink md:text-5xl">
            Vos pneus livrés et montés près de chez vous
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft md:text-base">
            Commandez vos pneus en ligne au meilleur prix, faites-les livrer chez
            un garage partenaire et prenez rendez-vous pour un montage clé en
            main. Zéro manutention, une pose par des professionnels.
          </p>

          {/* Formulaire GET : l'URL porte la recherche (partageable, indexable) */}
          <form
            method="get"
            className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 rounded-2xl border border-line bg-paper p-4 text-left shadow-card sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label
                htmlFor="q"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted"
              >
                Ville ou code postal
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Ex. Rians ou 83560"
                className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-signal"
              />
            </div>
            <div className="sm:w-32">
              <label
                htmlFor="radius"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted"
              >
                Rayon
              </label>
              <select
                id="radius"
                name="radius"
                defaultValue={radius ? String(radius) : ""}
                className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-signal"
              >
                <option value="">Tous</option>
                {RADII.map((r) => (
                  <option key={r} value={r}>
                    {r} km
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="h-11 shrink-0 rounded-lg bg-signal px-6 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark"
            >
              Trouver un garage
            </button>
          </form>
        </div>
      </section>

      {/* Résultats de recherche (si une recherche a été lancée) */}
      {hasQuery && (
        <section className="mx-auto max-w-5xl px-6 py-10">
          {error && (
            <p className="rounded-lg bg-signal-light px-4 py-3 text-sm text-signal-dark">
              {error}
            </p>
          )}

          {!error && garages && garages.length === 0 && (
            <div className="rounded-2xl border border-line bg-paper p-8 text-center">
              <p className="font-display text-lg font-bold text-ink">
                Aucun garage partenaire trouvé
              </p>
              <p className="mt-2 text-sm text-ink-soft">
                {radius
                  ? `Aucun garage dans un rayon de ${radius} km. Élargissez le rayon ou optez pour la livraison à domicile.`
                  : "Aucun garage partenaire pour cette recherche. Optez pour la livraison à domicile."}
              </p>
              <Link
                href="/recherche"
                className="mt-5 inline-block rounded-full bg-signal px-7 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark"
              >
                Rechercher mes pneus
              </Link>
            </div>
          )}

          {!error && garages && garages.length > 0 && (
            <>
              <h2 className="mb-4 font-display text-xl font-bold text-ink">
                {garages.length} garage{garages.length > 1 ? "s" : ""} partenaire
                {garages.length > 1 ? "s" : ""}
                {radius ? ` dans un rayon de ${radius} km` : ""}
              </h2>
              <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
                <ul className="order-2 space-y-4 lg:order-1">
                  {garages.map((g) => (
                    <GarageCard key={g.id} g={g} />
                  ))}
                </ul>
                {mappable.length > 0 && (
                  <div className="order-1 lg:order-2 lg:sticky lg:top-24 lg:h-fit">
                    <GaragesMap garages={mappable} />
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* Comment ça marche */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-signal-dark">
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
              <span
                className="absolute right-5 top-5 font-display text-3xl font-black text-paper-dim"
                aria-hidden
              >
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
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-signal-dark">
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
            </div>
          </div>
        </div>
      </section>

      {/* Prestations incluses */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-signal-dark">
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
