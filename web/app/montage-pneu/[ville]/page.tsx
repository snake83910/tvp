import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { GarageCard } from "@/components/garage/GarageCard";
import { api, type GarageNearby } from "@/lib/api";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tousvospneus.com";

/** Garages publiés dont la ville correspond au slug d'URL. */
async function garagesInCity(ville: string): Promise<GarageNearby[]> {
  try {
    const all = await api.publishedGarages();
    return all.filter((g) => slugify(g.city) === ville);
  } catch {
    return [];
  }
}

export async function generateMetadata(
  props: {
    params: Promise<{ ville: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const list = await garagesInCity(params.ville);
  if (list.length === 0) return { title: "Montage de pneus | tousvospneus.com" };
  const city = list[0].city;
  return {
    title: `Montage de pneus à ${city} — garages partenaires`,
    description: `${list.length} garage${list.length > 1 ? "s" : ""} partenaire${list.length > 1 ? "s" : ""} à ${city} pour le montage de vos pneus. Commandez en ligne, faites livrer et monter sur place.`,
    alternates: { canonical: `/montage-pneu/${params.ville}` },
  };
}

export default async function MontageVillePage(
  props: {
    params: Promise<{ ville: string }>;
  }
) {
  const params = await props.params;
  const list = await garagesInCity(params.ville);
  if (list.length === 0) notFound();
  const city = list[0].city;

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Garages de montage de pneus à ${city}`,
    itemListElement: list.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "AutoRepair",
        name: g.name,
        url: `${SITE}/garages/${g.slug}`,
        address: {
          "@type": "PostalAddress",
          streetAddress: g.address,
          postalCode: g.postal_code,
          addressLocality: g.city,
          addressCountry: "FR",
        },
        ...(g.lat != null && g.lng != null
          ? { geo: { "@type": "GeoCoordinates", latitude: g.lat, longitude: g.lng } }
          : {}),
      },
    })),
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "Accueil", href: "/" },
            { label: "Montage en garage", href: "/montage-pneu" },
            { label: city },
          ]}
        />

        <h1 className="mt-2 font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
          Montage de pneus à {city}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Commandez vos pneus en ligne au meilleur prix et faites-les monter par
          l&apos;un de nos <strong>{list.length} garage{list.length > 1 ? "s" : ""} partenaire
          {list.length > 1 ? "s" : ""}</strong> à {city}. Livraison directe au garage,
          montage sur rendez-vous, réglé sur place.
        </p>

        <ul className="mt-8 space-y-4">
          {list.map((g) => (
            <GarageCard key={g.id} garage={g} headingLevel="h2" />
          ))}
        </ul>

        <div className="mt-10 rounded-2xl border border-line bg-paper-dim p-6 text-center">
          <p className="font-display text-lg font-bold text-ink">
            Trouvez vos pneus, montés à {city}
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
    </>
  );
}
