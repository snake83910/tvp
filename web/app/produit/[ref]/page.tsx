import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductActions } from "@/components/ProductActions";
import { TyreImage } from "@/components/TyreImage";
import { EuLabel } from "@/components/EuLabel";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

const SEASON: Record<string, string> = {
  ete: "Été", hiver: "Hiver", "4saisons": "4 saisons", inconnu: "Non précisé",
};

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: { ref: string };
  searchParams: { w?: string; h?: string; d?: string };
}) {
  const ref = decodeURIComponent(params.ref);
  const { w, h, d } = searchParams;

  let tyre = null;
  let error: string | null = null;

  if (w && h && d) {
    try {
      tyre = await api.getProduct(
        ref,
        Number(w),
        Number(h),
        Number(d),
      );
    } catch (e) {
      error = e instanceof Error ? e.message : "Erreur";
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/recherche" className="text-sm text-ink-muted hover:text-signal">
          ← Retour aux résultats
        </Link>

        {!tyre && (
          <div className="mt-8 rounded-2xl border border-line bg-paper p-8 text-center shadow-card">
            <p className="text-ink-muted">
              {error ?? "Ce pneu n'est plus disponible ou la référence est introuvable."}
            </p>
            <Link href="/recherche" className="mt-4 inline-block rounded-full bg-signal px-6 py-3 text-sm font-bold text-white hover:bg-signal-dark">
              Nouvelle recherche
            </Link>
          </div>
        )}

        {tyre && (
          <>
            <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1fr]">
              {/* Colonne image + étiquette */}
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

              {/* Colonne infos + achat */}
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
                    <span className="text-sm text-ink-muted">
                      / unité {tyre.display_mode}
                    </span>
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

                <ul className="space-y-2 rounded-2xl border border-line bg-paper p-6 text-sm text-ink-soft shadow-card">
                  <li>Livraison à domicile ou chez un garage partenaire</li>
                  <li>Paiement 100% sécurisé</li>
                  <li>Retour sous 14 jours</li>
                </ul>
              </div>
            </div>

            {/* Bloc info indice de charge/vitesse (pédagogique, type Allopneus) */}
            <section className="mt-10 rounded-2xl border border-line bg-paper p-8 shadow-card">
              <h2 className="font-display text-xl font-black tracking-tightest text-ink">
                Bien choisir son pneu
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft">
                Les indices de charge et de vitesse inscrits sur le flanc
                doivent être au moins égaux à ceux préconisés sur votre
                carte grise. Il est autorisé de monter un indice supérieur
                (pneu renforcé, marqué XL), mais jamais inférieur. En cas de
                doute sur la compatibilité avec votre véhicule, vérifiez la
                monte d&apos;origine ou rapprochez-vous d&apos;un
                professionnel.
              </p>
            </section>
          </>
        )}
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
