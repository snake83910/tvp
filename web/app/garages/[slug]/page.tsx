import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { api, type GaragePublic } from "@/lib/api";
import { formatEuro } from "@/lib/money";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tousvospneus.com";

async function load(slug: string): Promise<GaragePublic | null> {
  try {
    return await api.getGarage(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const g = await load(params.slug);
  if (!g) return { title: "Garage partenaire | Tous Vos Pneus" };
  return {
    title: `${g.name} — Montage de pneus à ${g.city} | tousvospneus.com`,
    description: `${g.name}, garage partenaire pour le montage de vos pneus à ${g.city} (${g.postal_code}). Commandez vos pneus et faites-les monter sur place.`,
    alternates: { canonical: `/garages/${params.slug}` },
  };
}

function mapsUrl(g: GaragePublic): string {
  const q =
    g.lat != null && g.lng != null
      ? `${g.lat},${g.lng}`
      : `${g.address}, ${g.postal_code} ${g.city}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export default async function GaragePage({
  params,
}: {
  params: { slug: string };
}) {
  const g = await load(params.slug);
  if (!g) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    name: g.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: g.address,
      postalCode: g.postal_code,
      addressLocality: g.city,
      addressCountry: "FR",
    },
    telephone: g.phone || undefined,
    url: `${SITE}/garages/${params.slug}`,
    ...(g.lat != null && g.lng != null
      ? { geo: { "@type": "GeoCoordinates", latitude: g.lat, longitude: g.lng } }
      : {}),
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "Accueil", href: "/" },
            { label: "Garages partenaires", href: "/recherche" },
            { label: g.name },
          ]}
        />

        <h1 className="mt-2 font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
          {g.name}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Garage partenaire pour le montage de vos pneus à {g.city}.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <InfoCard title="Adresse">
            <p className="text-ink-soft">
              {g.address}
              <br />
              {g.postal_code} {g.city}
            </p>
            <a
              href={mapsUrl(g)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-semibold text-signal hover:underline"
            >
              Itinéraire →
            </a>
          </InfoCard>

          <InfoCard title="Contact & horaires">
            {g.phone && (
              <p className="text-ink-soft">
                <a href={`tel:${g.phone}`} className="hover:text-signal">
                  {g.phone}
                </a>
              </p>
            )}
            {g.hours?.text && (
              <p className="mt-1 text-sm text-ink-soft">{g.hours.text}</p>
            )}
            {g.mounting_price_cents > 0 && (
              <p className="mt-2 text-sm">
                Montage :{" "}
                <strong className="text-ink">
                  {formatEuro(g.mounting_price_cents / 100)}/pneu
                </strong>{" "}
                <span className="text-ink-muted">(réglé sur place)</span>
              </p>
            )}
          </InfoCard>
        </div>

        {g.services.length > 0 && (
          <section className="mt-6">
            <h2 className="font-display text-lg font-bold text-ink">Prestations</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {g.services.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-line bg-paper-dim px-3 py-1 text-sm text-ink-soft"
                >
                  {s}
                </span>
              ))}
            </div>
          </section>
        )}

        {g.description && (
          <section className="mt-6">
            <h2 className="font-display text-lg font-bold text-ink">
              À propos du garage
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
              {g.description}
            </p>
          </section>
        )}

        <div className="mt-10 rounded-2xl border border-line bg-paper-dim p-6 text-center">
          <p className="font-display text-lg font-bold text-ink">
            Commandez vos pneus, montés ici
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Choisissez ce garage à l&apos;étape livraison de votre commande.
          </p>
          <Link
            href="/recherche"
            className="mt-4 inline-block rounded-full bg-signal px-8 py-3 font-display text-sm font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark"
          >
            Rechercher mes pneus
          </Link>
        </div>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
        {title}
      </p>
      {children}
    </div>
  );
}
