import Link from "next/link";
import type { TyreResult } from "@/lib/api";
import { ProductActions } from "@/components/ProductActions";
import { TyreImage } from "@/components/TyreImage";
import { EprelLabel } from "@/components/EprelLabel";
import { TyreBadges } from "@/components/TyreBadges";
import { TierBadge } from "@/components/TierBadge";
import { BrandLogo } from "@/components/BrandLogo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PriceComparator } from "@/components/PriceComparator";
import { MountingOffer } from "@/components/MountingOffer";
import { formatEuro } from "@/lib/money";

const SEASON: Record<string, string> = {
  ete: "Été", hiver: "Hiver", "4saisons": "4 saisons", inconnu: "Non précisé",
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tousvospneus.com";

function formatDelivery(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });
  } catch {
    return null;
  }
}

function stockMessage(stock: number | null | undefined): { tone: "ok" | "warn" | "out"; text: string } | null {
  if (stock == null) return null;
  if (stock <= 0) return { tone: "out", text: "Indisponible" };
  if (stock <= 5) return { tone: "warn", text: `Stock limité (${stock} restant${stock > 1 ? "s" : ""})` };
  return { tone: "ok", text: "En stock — expédition rapide" };
}

export function TyreDetail({
  tyre,
  canonicalUrl,
}: {
  tyre: TyreResult;
  canonicalUrl: string;
}) {
  const noise = tyre.eu_label?.noise as number | string | null | undefined;
  const noiseClass = tyre.eu_label?.noise_class as string | null | undefined;
  const fuel = tyre.eu_label?.grip as string | null | undefined;
  const wet = tyre.eu_label?.wet as string | null | undefined;

  const delivery = formatDelivery(tyre.delivery_estimate);
  const stock = stockMessage(tyre.stock);

  // Retour aux résultats : conserve dimension ET famille de véhicule
  const searchQ = new URLSearchParams({
    width: String(tyre.width ?? ""),
    ratio: String(tyre.aspect_ratio ?? ""),
    diameter: String(tyre.diameter ?? ""),
  });
  if (tyre.category && tyre.category !== "auto")
    searchQ.set("category", tyre.category);
  const searchHref = `/recherche?${searchQ.toString()}`;

  // JSON-LD enrichi : ajoute gtin13 (EAN) si disponible
  const productJsonLd: Record<string, unknown> = {
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
      availability: (tyre.stock ?? 1) > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
  if (tyre.ean) productJsonLd.gtin13 = tyre.ean;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Breadcrumbs items={[
          { label: "Accueil", href: "/" },
          { label: "Pneus", href: "/recherche" },
          { label: tyre.dimension, href: searchHref },
          { label: `${tyre.brand} ${tyre.model}` },
        ]} />
        <Link href={searchHref} className="text-sm text-ink-muted hover:text-signal">
          ← Retour aux résultats
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1fr]">
          {/* Colonne gauche : visuel + étiquette */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-line bg-paper p-8 shadow-card">
              <TyreImage
                src={tyre.image_url}
                alt={`${tyre.brand} ${tyre.model} ${tyre.dimension}`}
                className="mx-auto h-72 w-full"
              />
            </div>

            <div className="flex justify-center">
              <EprelLabel
                eprelId={tyre.eprel_id}
                fuel={fuel}
                wet={wet}
                noise={typeof noise === "string" ? noise : noise ? String(noise) : null}
              />
            </div>
          </div>

          {/* Colonne droite : infos + achat */}
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-block rounded-full bg-paper-dim px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
                  {SEASON[tyre.season] ?? tyre.season}
                </span>
                <TierBadge tier={tyre.brand_tier} />
                <TyreBadges tyre={tyre} />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <BrandLogo brand={tyre.brand} brandSlug={tyre.brand_slug} className="h-10" />
                <h1 className="font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
                  {tyre.brand}
                </h1>
              </div>
              <p className="text-xl text-ink-muted">{tyre.model}</p>
              <p className="mt-3 inline-block rounded-lg bg-ink px-4 py-2 font-mono text-sm font-bold text-paper">
                {tyre.dimension}
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
              <div className="flex items-baseline gap-2">
                <p className="font-display text-4xl font-black text-ink">
                  {formatEuro(tyre.display_price)}
                </p>
                <span className="text-sm text-ink-muted">/ unité {tyre.display_mode}</span>
              </div>

              {/* Stock + livraison */}
              {(stock || delivery) && (
                <div className="mt-3 space-y-1 text-sm">
                  {stock && (
                    <p className={`flex items-center gap-1.5 font-semibold ${
                      stock.tone === "ok" ? "text-ok"
                      : stock.tone === "warn" ? "text-amber-700"
                      : "text-signal-dark"
                    }`}>
                      <span>●</span> {stock.text}
                    </p>
                  )}
                  {delivery && (
                    <p className="text-ink-soft">
                      <span className="font-semibold text-ink">Livraison estimée :</span> {delivery}
                    </p>
                  )}
                </div>
              )}

              <ProductActions tyre={tyre} />
            </div>

            <MountingOffer tyre={tyre} />

            <PriceComparator
              ourPriceTtc={tyre.price_ttc}
              marketPrices={tyre.market_prices}
            />

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
              {/* Bruit en dB + classe */}
              {noise != null && (
                <Row
                  k="Bruit roulement"
                  v={`${noise} dB${noiseClass ? ` · Classe ${noiseClass}` : ""}`}
                />
              )}
              {fuel && <Row k="Consommation carburant" v={`Classe ${fuel}`} />}
              {wet && <Row k="Adhérence sur sol mouillé" v={`Classe ${wet}`} />}
              {tyre.ean && <Row k="EAN" v={tyre.ean} />}
            </dl>

            {/* Réassurance : reprise de l'ancienne fiche /produit lors de
                la fusion des deux gabarits. */}
            <ul className="space-y-2 rounded-2xl border border-line bg-paper p-6 text-sm text-ink-soft shadow-card">
              <li>Livraison à domicile ou chez un garage partenaire</li>
              <li>Paiement 100&nbsp;% sécurisé</li>
              <li>Retour sous 14 jours</li>
            </ul>

            <p className="text-center text-sm text-ink-muted">
              Besoin d&apos;aide pour choisir ?{" "}
              <Link href="/guide" className="font-semibold text-signal hover:underline">
                Consultez notre guide du pneu
              </Link>
            </p>
          </div>
        </div>

        {/* Description longue */}
        {tyre.description_html && (
          <section className="mt-10 rounded-2xl border border-line bg-paper p-8 shadow-card">
            <h2 className="mb-4 font-display text-xl font-black tracking-tightest text-ink">
              À propos de ce pneu
            </h2>
            <div
              className="prose-tvp text-sm leading-relaxed text-ink-soft"
              dangerouslySetInnerHTML={{ __html: tyre.description_html }}
            />
          </section>
        )}

        {/* Conseil générique, complémentaire du descriptif fournisseur :
            l'erreur d'indice est le premier motif de retour sur ce marché.
            Récupéré de l'ancienne fiche /produit à la fusion. */}
        <section className="mt-10 rounded-2xl border border-line bg-paper p-8 shadow-card">
          <h2 className="font-display text-xl font-black tracking-tightest text-ink">
            Bien choisir son pneu
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft">
            Les indices de charge et de vitesse inscrits sur le flanc doivent
            être au moins égaux à ceux préconisés sur votre carte grise. Il est
            autorisé de monter un indice supérieur (pneu renforcé, marqué XL),
            mais jamais inférieur. En cas de doute sur la compatibilité avec
            votre véhicule, vérifiez la monte d&apos;origine ou rapprochez-vous
            d&apos;un professionnel.
          </p>
        </section>
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
