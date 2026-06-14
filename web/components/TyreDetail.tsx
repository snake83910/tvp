import Link from "next/link";
import { ProductActions } from "@/components/ProductActions";
import { TyreImage } from "@/components/TyreImage";
import { EuLabel } from "@/components/EuLabel";

const SEASON: Record<string, string> = {
  ete: "Été", hiver: "Hiver", "4saisons": "4 saisons", inconnu: "Non précisé",
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tousvospneus.com";

interface TyreLike {
  supplier_ref: string;
  brand: string;
  model: string;
  dimension: string;
  width?: number | null;
  aspect_ratio?: number | null;
  diameter?: number | null;
  load_index?: string | null;
  speed_rating?: string | null;
  season: string;
  image_url: string | null;
  eu_label?: Record<string, unknown>;
  display_price: number;
  display_mode: string;
  price_ht: number;
  price_ttc: number;
}

export function TyreDetail({
  tyre,
  canonicalUrl,
}: {
  tyre: TyreLike;
  canonicalUrl: string;
}) {
  const productJsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: `${tyre.brand} ${tyre.model} ${tyre.dimension}`,
    brand: { "@type": "Brand", name: tyre.brand },
    sku: tyre.supplier_ref,
    image: tyre.image_url || undefined,
    description: `Pneu ${tyre.brand} ${tyre.model} en ${tyre.dimension}, saison ${SEASON[tyre.season] ?? tyre.season}.`,
    offers: {
      "@type": "Offer",
      url: `${SITE}${canonicalUrl}`,
      priceCurrency: "EUR",
      price: tyre.display_price.toFixed(2),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/recherche" className="text-sm text-ink-muted hover:text-signal">
          ← Retour aux résultats
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-line bg-paper p-8 shadow-card">
              <TyreImage
                src={tyre.image_url}
                alt={`${tyre.brand} ${tyre.model} ${tyre.dimension}`}
                className="mx-auto h-72 w-full"
              />
            </div>
            <EuLabel
              fuel={(tyre.eu_label?.grip as string) ?? null}
              wet={(tyre.eu_label?.wet as string) ?? null}
              noise={(tyre.eu_label?.noise as string) ?? null}
            />
          </div>

          <div className="space-y-6">
            <div>
              <span className="inline-block rounded-full bg-paper-dim px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
                {SEASON[tyre.season] ?? tyre.season}
              </span>
              <h1 className="mt-3 font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
                {tyre.brand}
              </h1>
              <p className="text-xl text-ink-muted">{tyre.model}</p>
              <p className="mt-3 inline-block rounded-lg bg-ink px-4 py-2 font-mono text-sm font-bold text-paper">
                {tyre.dimension}
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
              <div className="flex items-baseline gap-2">
                <p className="font-display text-4xl font-black text-ink">
                  {tyre.display_price.toFixed(2).replace(".", ",")} €
                </p>
                <span className="text-sm text-ink-muted">/ unité {tyre.display_mode}</span>
              </div>
              <ProductActions tyre={tyre} />
            </div>

            <dl className="rounded-2xl border border-line bg-paper p-6 text-sm shadow-card">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
                Caractéristiques
              </p>
              <Row k="Marque" v={tyre.brand} />
              <Row k="Modèle" v={tyre.model} />
              <Row k="Dimension" v={tyre.dimension} />
              {tyre.load_index && <Row k="Indice de charge" v={String(tyre.load_index)} />}
              {tyre.speed_rating && <Row k="Indice de vitesse" v={tyre.speed_rating} />}
              <Row k="Saison" v={SEASON[tyre.season] ?? tyre.season} />
            </dl>
          </div>
        </div>
      </main>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-t border-line py-2 first:border-0">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="font-semibold text-ink">{v}</dd>
    </div>
  );
}
