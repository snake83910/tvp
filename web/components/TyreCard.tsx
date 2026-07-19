"use client";

import Link from "next/link";
import { useState } from "react";
import {
  defaultQty,
  isAlwaysFreeShipping,
  type TyreResult,
} from "@/lib/api";
import { useCart } from "@/components/CartProvider";
import { TyreImage } from "@/components/TyreImage";
import { BrandLogo } from "@/components/BrandLogo";
import { productUrl } from "@/lib/slug";
import { formatEuro } from "@/lib/money";

const SEASON: Record<string, string> = {
  ete: "Été",
  hiver: "Hiver",
  "4saisons": "4 saisons",
  inconnu: "—",
};

const MIN_QTY = 1;
const MAX_QTY = 20;

const GRADE_COLOR: Record<string, string> = {
  A: "bg-ok",
  B: "bg-ok/80",
  C: "bg-yellow-500",
  D: "bg-orange-500",
  E: "bg-signal",
};

/** Mini-pastille de note européenne (A→E) pour les cartes résultats. */
function GradeDot({ label, value, title }: { label: string; value: unknown; title: string }) {
  const grade = String(value ?? "").toUpperCase();
  if (!GRADE_COLOR[grade]) return null;
  return (
    <span className="inline-flex items-center gap-1" title={title}>
      <span className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</span>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black text-white ${GRADE_COLOR[grade]}`}
      >
        {grade}
      </span>
    </span>
  );
}

export function TyreCard({ tyre }: { tyre: TyreResult }) {
  const { add } = useCart();
  // Quantité par défaut selon la famille (moto : 1, sinon 2 par essieu)
  const DEFAULT_QTY = defaultQty(tyre.category);
  // Quantité bornée au stock fournisseur : « 1 restant » ne doit pas
  // permettre d'en mettre 2 au panier (le backend refuse aussi).
  const maxQty =
    tyre.stock != null ? Math.min(MAX_QTY, Math.max(tyre.stock, 0)) : MAX_QTY;
  const outOfStock = maxQty < 1;
  const [qty, setQty] = useState(Math.max(MIN_QTY, Math.min(DEFAULT_QTY, maxQty)));
  const [state, setState] = useState<
    "idle" | "adding" | "done" | "error"
  >("idle");

  const price = formatEuro(tyre.display_price);
  // URL SEO-friendly avec brand/model dans le path
  const detailHref =
    tyre.width != null && tyre.aspect_ratio != null && tyre.diameter != null
      ? productUrl({
          ref: tyre.supplier_ref,
          brand: tyre.brand,
          model: tyre.model,
          width: tyre.width,
          ratio: tyre.aspect_ratio,
          diameter: tyre.diameter,
          category: tyre.category,
        })
      : `/produit/${encodeURIComponent(tyre.supplier_ref)}`;

  function clamp(n: number) {
    if (Number.isNaN(n)) return Math.min(DEFAULT_QTY, maxQty);
    return Math.max(MIN_QTY, Math.min(maxQty, Math.floor(n)));
  }

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleAdd() {
    if (
      tyre.width == null ||
      tyre.aspect_ratio == null ||
      tyre.diameter == null
    ) {
      setState("error");
      return;
    }
    setState("adding");
    setErrorMsg(null);
    try {
      await add({
        supplier_ref: tyre.supplier_ref,
        width: tyre.width,
        ratio: tyre.aspect_ratio,
        diameter: tyre.diameter,
        quantity: qty,
        category: tyre.category,
      });
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch (e) {
      // Message backend (ex. « Stock insuffisant : il ne reste que 1
      // pneu... ») bien plus utile qu'un « Erreur » générique
      setErrorMsg(e instanceof Error ? e.message : null);
      setState("error");
    }
  }

  return (
    <article className="flex flex-col rounded-xl border border-line bg-paper p-5 shadow-card transition hover:border-signal hover:shadow-lift">
      <Link href={detailHref} className="mb-4 block">
        <TyreImage
          src={tyre.image_url}
          alt={`${tyre.brand} ${tyre.model} ${tyre.dimension}`}
          className="h-40 w-full rounded-lg"
        />
      </Link>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 h-6">
            <BrandLogo brand={tyre.brand} brandSlug={tyre.brand_slug} className="h-6" />
          </div>
          <Link
            href={detailHref}
            className="block truncate text-sm font-semibold text-ink hover:text-signal"
            title={tyre.model}
          >
            {tyre.model}
          </Link>
        </div>
        <span className="shrink-0 rounded-full bg-paper-dim px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
          {SEASON[tyre.season] ?? tyre.season}
        </span>
      </div>

      <p className="mb-3 font-mono text-sm text-ink-soft">
        {tyre.dimension}
      </p>

      <div className="mb-2 flex gap-3 text-xs text-ink-muted">
        {tyre.load_index && (
          <span>
            Charge{" "}
            <span className="font-semibold text-ink">
              {tyre.load_index}
            </span>
          </span>
        )}
        {tyre.speed_rating && (
          <span>
            Vitesse{" "}
            <span className="font-semibold text-ink">
              {tyre.speed_rating}
            </span>
          </span>
        )}
      </div>

      {/* Étiquette EU compacte + homologation hiver : critères de choix,
          affichés dès les résultats au lieu d'attendre la fiche */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <GradeDot
          label="Conso"
          value={tyre.eu_label?.grip}
          title="Efficacité carburant (résistance au roulement)"
        />
        <GradeDot
          label="Pluie"
          value={tyre.eu_label?.wet}
          title="Adhérence sur sol mouillé"
        />
        {tyre.is_3pmsf && (
          <span
            className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800"
            title="Symbole montagne + 3 pics : conforme Loi Montagne"
          >
            ❄ 3PMSF
          </span>
        )}
      </div>

      {/* Disponibilité */}
      {tyre.stock != null && (
        <p
          className={`mb-2 text-xs font-semibold ${
            tyre.stock <= 0
              ? "text-signal"
              : tyre.stock <= 5
                ? "text-amber-700"
                : "text-ok"
          }`}
        >
          ●{" "}
          {tyre.stock <= 0
            ? "Indisponible"
            : tyre.stock <= 5
              ? `Stock limité (${tyre.stock} restants)`
              : "En stock"}
        </p>
      )}

      <div className="mt-auto border-t border-line pt-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="font-display text-2xl font-black text-ink">
              {price}
            </p>
            <p className="text-[11px] uppercase tracking-wider text-ink-muted">
              prix {tyre.display_mode}
            </p>
          </div>

          {/* Sélecteur de quantité +/- avec saisie libre */}
          <div className="flex items-center rounded-lg border border-line">
            <button
              type="button"
              onClick={() => setQty(clamp(qty - 1))}
              disabled={qty <= MIN_QTY}
              className="px-3 py-1.5 text-ink-soft transition hover:text-signal disabled:opacity-30"
              aria-label="Diminuer la quantité"
            >
              −
            </button>
            <input
              type="number"
              min={MIN_QTY}
              max={maxQty}
              value={qty}
              onChange={(e) => setQty(clamp(parseInt(e.target.value, 10)))}
              className="w-10 border-x border-line bg-transparent py-1.5 text-center text-sm font-bold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="Quantité"
            />
            <button
              type="button"
              onClick={() => setQty(clamp(qty + 1))}
              disabled={qty >= maxQty}
              className="px-3 py-1.5 text-ink-soft transition hover:text-signal disabled:opacity-30"
              aria-label="Augmenter la quantité"
            >
              +
            </button>
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={state === "adding" || outOfStock}
          className={`w-full rounded-full px-5 py-2.5 text-sm font-bold text-white transition ${
            state === "done"
              ? "bg-ok"
              : "bg-signal hover:bg-signal-dark disabled:opacity-60"
          }`}
        >
          {outOfStock
            ? "Indisponible"
            : state === "adding"
              ? "Ajout…"
              : state === "done"
                ? "✓ Ajouté au panier"
                : state === "error"
                  ? "Erreur, réessayer"
                  : `Ajouter ${qty} pneu${qty > 1 ? "s" : ""}`}
        </button>

        {errorMsg && (
          <p className="mt-2 rounded-lg bg-signal-light px-3 py-2 text-xs text-signal-dark">
            {errorMsg}
          </p>
        )}

        {/* Règle métier : moto toujours offerte ; sinon offerte dès
            2 pneus par référence */}
        <p
          className={`mt-2 text-center text-[11px] font-semibold ${
            isAlwaysFreeShipping(tyre.category) || qty >= 2
              ? "text-ok"
              : "text-ink-muted"
          }`}
        >
          {isAlwaysFreeShipping(tyre.category) || qty >= 2
            ? "✓ Livraison offerte"
            : "Livraison offerte dès 2 pneus"}
        </p>
      </div>
    </article>
  );
}
