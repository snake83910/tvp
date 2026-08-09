import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { TyreDetail } from "@/components/TyreDetail";
import { api } from "@/lib/api";
import { parseProductSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tousvospneus.com";

async function load(
  params: { dim: string; slug: string },
  category?: string,
) {
  const parsed = parseProductSlug(params.dim, params.slug);
  if (!parsed) return null;
  try {
    const tyre = await api.getProduct(
      parsed.ref, parsed.width, parsed.ratio, parsed.diameter,
      undefined, category,
    );
    return { tyre, parsed };
  } catch {
    return null;
  }
}

export async function generateMetadata(
  props: {
    params: Promise<{ dim: string; slug: string }>;
    searchParams: Promise<{ t?: string }>;
  }
): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const data = await load(params, searchParams.t);
  if (!data) return { title: "Pneu | Tous Vos Pneus" };
  const { tyre } = data;
  // Pas de prix dans le title : il se périme dans les SERP (le prix reste
  // dans le schema Product/offers). Titre riche en mots-clés à la place.
  const title = `Pneu ${tyre.brand} ${tyre.model} ${tyre.dimension}`;
  const desc = `Pneu ${tyre.brand} ${tyre.model} en ${tyre.dimension} au meilleur prix. Livraison en France ou montage en garage partenaire.`;
  const url = `${SITE}/pneus/${params.dim}/${params.slug}`;
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title, description: desc, url,
      type: "website",
      images: tyre.image_url ? [{ url: tyre.image_url, alt: title }] : [],
      siteName: "Tous Vos Pneus",
    },
    twitter: { card: "summary_large_image", title, description: desc },
  };
}

export default async function ProductSeoPage(
  props: {
    params: Promise<{ dim: string; slug: string }>;
    searchParams: Promise<{ t?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const data = await load(params, searchParams.t);
  if (!data) notFound();
  return (
    <>
      <SiteHeader />
      <TyreDetail tyre={data.tyre} canonicalUrl={`/pneus/${params.dim}/${params.slug}`} />
    </>
  );
}
