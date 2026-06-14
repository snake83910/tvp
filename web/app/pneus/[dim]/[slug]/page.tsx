import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { TyreDetail } from "@/components/TyreDetail";
import { api } from "@/lib/api";
import { parseProductSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tousvospneus.com";

async function load(params: { dim: string; slug: string }) {
  const parsed = parseProductSlug(params.dim, params.slug);
  if (!parsed) return null;
  try {
    const tyre = await api.getProduct(parsed.ref, parsed.width, parsed.ratio, parsed.diameter);
    return { tyre, parsed };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { dim: string; slug: string };
}): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: "Pneu | Tous Vos Pneus" };
  const { tyre } = data;
  const title = `${tyre.brand} ${tyre.model} ${tyre.dimension} — ${tyre.display_price.toFixed(2)}€`;
  const desc = `Pneu ${tyre.brand} ${tyre.model} en ${tyre.dimension}. Livraison rapide en France.`;
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

export default async function ProductSeoPage({
  params,
}: {
  params: { dim: string; slug: string };
}) {
  const data = await load(params);
  if (!data) notFound();
  return (
    <>
      <SiteHeader />
      <TyreDetail tyre={data.tyre} canonicalUrl={`/pneus/${params.dim}/${params.slug}`} />
    </>
  );
}
