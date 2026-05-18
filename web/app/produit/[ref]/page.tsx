import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductActions } from "@/components/ProductActions";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

const SEASON: Record<string, string> = {
  ete: "Été",
  hiver: "Hiver",
  "4saisons": "4 saisons",
  inconnu: "Non précisé",
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
      const res = await api.searchByDimensions({
        width: Number(w),
        ratio: Number(h),
        diameter: Number(d),
        page: 1,
      });
      tyre =
        res.items.find((t) => t.supplier_ref === ref) ?? null;
    } catch (e) {
      error = e instanceof Error ? e.message : "Erreur";
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link
          href="/recherche"
          className="text-sm text-ink-muted hover:text-signal"
        >
          ← Retour aux résultats
        </Link>

        {!tyre && (
          <div className="mt-8 rounded-2xl border border-line bg-paper p-8 text-center shadow-card">
            <p className="text-ink-muted">
              {error ??
                "Ce pneu n'est plus disponible ou la référence est introuvable."}
            </p>
            <Link
              href="/recherche"
              className="mt-4 inline-block rounded-full bg-signal px-6 py-3 text-sm font-bold text-white hover:bg-signal-dark"
            >
              Nouvelle recherche
            </Link>
          </div>
        )}

        {tyre && (
          <div className="mt-6 grid gap-10 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-paper p-8 shadow-card">
              <span className="inline-block rounded-full bg-paper-dim px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
                {SEASON[tyre.season] ?? tyre.season}
              </span>
              <h1 className="mt-4 font-display text-3xl font-black tracking-tightest text-ink">
                {tyre.brand}
              </h1>
              <p className="text-lg text-ink-muted">
                {tyre.model}
              </p>
              <p className="mt-4 font-mono text-ink-soft">
                {tyre.dimension}
              </p>

              <dl className="mt-6 space-y-2 border-t border-line pt-4 text-sm">
                {tyre.load_index && (
                  <Row
                    k="Indice de charge"
                    v={String(tyre.load_index)}
                  />
                )}
                {tyre.speed_rating && (
                  <Row
                    k="Indice de vitesse"
                    v={tyre.speed_rating}
                  />
                )}
                <Row
                  k="Saison"
                  v={SEASON[tyre.season] ?? tyre.season}
                />
              </dl>
            </div>

            <div className="rounded-2xl border border-line bg-paper p-8 shadow-card">
              <p className="font-display text-4xl font-black text-ink">
                {tyre.display_price
                  .toFixed(2)
                  .replace(".", ",")}{" "}
                €
              </p>
              <p className="text-xs uppercase tracking-wider text-ink-muted">
                prix unitaire {tyre.display_mode}
              </p>

              <ProductActions tyre={tyre} />

              <ul className="mt-6 space-y-2 border-t border-line pt-4 text-sm text-ink-muted">
                <li>Livraison à domicile ou en garage partenaire</li>
                <li>Paiement sécurisé</li>
                <li>Retour sous 14 jours</li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="font-semibold text-ink">{v}</dd>
    </div>
  );
}
