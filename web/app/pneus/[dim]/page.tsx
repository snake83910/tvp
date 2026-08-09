import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { TyreCard } from "@/components/TyreCard";
import { PopularDimensions } from "@/components/PopularDimensions";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { api, type SearchResponse } from "@/lib/api";
import { parseDimSlug, formatDimension } from "@/lib/slug";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tousvospneus.com";

export async function generateMetadata(
  props: {
    params: Promise<{ dim: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const parsed = parseDimSlug(params.dim);
  if (!parsed) return { title: "Pneus | Tous Vos Pneus" };
  const label = formatDimension(parsed.width, parsed.ratio, parsed.diameter);
  return {
    title: `Pneus ${label} au meilleur prix — tousvospneus.com`,
    description: `Achetez vos pneus en ${label} : comparez les prix de nombreuses marques, livraison rapide en France ou montage chez un garage partenaire.`,
    alternates: { canonical: `/pneus/${params.dim}` },
  };
}

export default async function DimensionLandingPage(
  props: {
    params: Promise<{ dim: string }>;
  }
) {
  const params = await props.params;
  const parsed = parseDimSlug(params.dim);
  if (!parsed) notFound();

  const label = formatDimension(parsed.width, parsed.ratio, parsed.diameter);
  const searchHref = `/recherche?width=${parsed.width}&ratio=${parsed.ratio}&diameter=${parsed.diameter}`;

  let data: SearchResponse | null = null;
  try {
    data = await api.searchByDimensions({
      width: parsed.width,
      ratio: parsed.ratio,
      diameter: parsed.diameter,
      sort: "price_asc",
      page: 1,
    });
  } catch {
    data = null;
  }

  const items = data?.items.slice(0, 12) ?? [];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "Accueil", href: "/" },
            { label: "Pneus", href: "/recherche" },
            { label: label },
          ]}
        />

        <h1 className="mt-2 font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
          Pneus {label}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft">
          Retrouvez tous les pneus en <strong>{label}</strong> aux meilleurs
          prix, du modèle budget au premium. Livraison à domicile en France ou
          montage chez l&apos;un de nos garages partenaires. Vérifiez toujours
          que les indices de charge et de vitesse correspondent à ceux de votre
          carte grise —{" "}
          <Link href="/guide" className="font-semibold text-signal hover:underline">
            voir le guide du pneu
          </Link>
          .
        </p>

        {data && data.total > 0 && (
          <p className="mt-4 text-sm text-ink-muted">
            <strong className="text-ink">{data.total}</strong> pneus disponibles
            en {label}
            {typeof data.facets?.price_min === "number" &&
              data.facets.price_min > 0 &&
              ` — à partir de ${data.facets.price_min} €`}
            .
          </p>
        )}

        {items.length > 0 ? (
          <>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((t) => (
                <TyreCard key={t.supplier_ref} tyre={t} />
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                href={searchHref}
                className="inline-block rounded-full bg-signal px-8 py-3 font-display text-sm font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark"
              >
                Voir tous les pneus {label}
              </Link>
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-2xl border border-line bg-paper p-8 text-center">
            <p className="text-ink-muted">
              Lancez une recherche pour voir les pneus disponibles en {label}.
            </p>
            <Link
              href={searchHref}
              className="mt-4 inline-block rounded-full bg-signal px-6 py-3 text-sm font-bold text-white hover:bg-signal-dark"
            >
              Rechercher
            </Link>
          </div>
        )}

        <PopularDimensions title="Autres dimensions recherchées" />
      </main>

      {/* JSON-LD : fil d'Ariane pour Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: SITE },
              { "@type": "ListItem", position: 2, name: "Pneus", item: `${SITE}/recherche` },
              { "@type": "ListItem", position: 3, name: `Pneus ${label}`, item: `${SITE}/pneus/${params.dim}` },
            ],
          }),
        }}
      />
    </>
  );
}
