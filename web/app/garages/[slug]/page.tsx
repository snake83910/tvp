import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { api, type GaragePublic } from "@/lib/api";
import { formatEuro } from "@/lib/money";
import { paymentLabel, vehicleLabel } from "@/components/partner/constants";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tousvospneus.com";
const MEDIA_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

        {g.photos.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {g.photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p}
                src={`${MEDIA_BASE}/garages/media/${p}`}
                alt={`${g.name}`}
                className="h-40 w-full rounded-xl border border-line object-cover"
              />
            ))}
          </div>
        )}

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
            <HoursDisplay hours={g.hours} />
            {g.mounting_price_cents > 0 && g.pricing.length === 0 && (
              <p className="mt-2 text-sm">
                Montage :{" "}
                <strong className="text-ink">
                  {formatEuro(g.mounting_price_cents / 100)}/pneu
                </strong>{" "}
                <span className="text-ink-muted">(réglé sur place)</span>
              </p>
            )}
            {g.payment_methods.length > 0 && (
              <p className="mt-2 text-sm text-ink-soft">
                Paiement : {g.payment_methods.map(paymentLabel).join(", ")}
              </p>
            )}
          </InfoCard>
        </div>

        {g.pricing.length > 0 && (
          <section className="mt-6">
            <h2 className="font-display text-lg font-bold text-ink">Tarifs de montage</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper-dim text-left text-xs uppercase tracking-wider text-ink-muted">
                    <th className="p-3">Véhicule</th>
                    <th className="p-3">Prestation</th>
                    <th className="p-3">Jantes</th>
                    <th className="p-3">Prix / pneu</th>
                  </tr>
                </thead>
                <tbody>
                  {g.pricing.map((r, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="p-3 text-ink">{vehicleLabel(r.vehicle)}</td>
                      <td className="p-3 text-ink-soft">{r.label || "—"}</td>
                      <td className="p-3 text-ink-soft">{r.size_min}″ → {r.size_max}″</td>
                      <td className="p-3 font-semibold text-ink">{formatEuro(r.price_cents / 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-ink-muted">Montage réglé sur place, au garage.</p>
          </section>
        )}

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

const DAY_ORDER = [
  ["lundi", "Lun"],
  ["mardi", "Mar"],
  ["mercredi", "Mer"],
  ["jeudi", "Jeu"],
  ["vendredi", "Ven"],
  ["samedi", "Sam"],
  ["dimanche", "Dim"],
] as const;

function HoursDisplay({ hours }: { hours: Record<string, unknown> }) {
  if (!hours) return null;
  const text = hours.text;
  if (typeof text === "string" && text) {
    return <p className="mt-1 text-sm text-ink-soft">{text}</p>;
  }
  const rows = DAY_ORDER.map(([key, label]) => {
    const d = hours[key] as { open?: string; close?: string; closed?: boolean } | undefined;
    if (!d) return null;
    const value = d.closed ? "Fermé" : d.open && d.close ? `${d.open} – ${d.close}` : null;
    if (!value) return null;
    return (
      <div key={key} className="flex justify-between gap-4">
        <span className="text-ink-muted">{label}</span>
        <span className="text-ink-soft">{value}</span>
      </div>
    );
  }).filter(Boolean);
  if (rows.length === 0) return null;
  return <div className="mt-2 space-y-0.5 text-sm">{rows}</div>;
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
