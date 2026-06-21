"use client";

import Link from "next/link";
import { useState } from "react";
import type { TyreResult } from "@/lib/api";
import { useCart } from "@/components/CartProvider";
import { TyreImage } from "@/components/TyreImage";
import { BrandLogo } from "@/components/BrandLogo";
import { productUrl } from "@/lib/slug";

const SEASON: Record<string, string> = {
  ete: "Été",
  hiver: "Hiver",
  "4saisons": "4 saisons",
  inconnu: "—",
};

const DEFAULT_QTY = 2; // métier pneu : par essieu
const MIN_QTY = 1;
const MAX_QTY = 20;

export function TyreCard({ tyre }: { tyre: TyreResult }) {
  const { add } = useCart();
  const [qty, setQty] = useState(DEFAULT_QTY);
  const [state, setState] = useState<
    "idle" | "adding" | "done" | "error"
  >("idle");

  const price = tyre.display_price.toFixed(2).replace(".", ",");
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
        })
      : `/produit/${encodeURIComponent(tyre.supplier_ref)}`;

  function clamp(n: number) {
    if (Number.isNaN(n)) return DEFAULT_QTY;
    return Math.max(MIN_QTY, Math.min(MAX_QTY, Math.floor(n)));
  }

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
    try {
      await add({
        supplier_ref: tyre.supplier_ref,
        width: tyre.width,
        ratio: tyre.aspect_ratio,
        diameter: tyre.diameter,
        quantity: qty,
      });
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch {
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

      <p className="mb-4 font-mono text-sm text-ink-soft">
        {tyre.dimension}
      </p>

      <div className="mb-5 flex gap-3 text-xs text-ink-muted">
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

      <div className="mt-auto border-t border-line pt-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="font-display text-2xl font-black text-ink">
              {price} €
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
              max={MAX_QTY}
              value={qty}
              onChange={(e) => setQty(clamp(parseInt(e.target.value, 10)))}
              className="w-10 border-x border-line bg-transparent py-1.5 text-center text-sm font-bold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="Quantité"
            />
            <button
              type="button"
              onClick={() => setQty(clamp(qty + 1))}
              disabled={qty >= MAX_QTY}
              className="px-3 py-1.5 text-ink-soft transition hover:text-signal disabled:opacity-30"
              aria-label="Augmenter la quantité"
            >
              +
            </button>
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={state === "adding"}
          className={`w-full rounded-full px-5 py-2.5 text-sm font-bold text-white transition ${
            state === "done"
              ? "bg-ok"
              : "bg-signal hover:bg-signal-dark disabled:opacity-60"
          }`}
        >
          {state === "adding" && "Ajout…"}
          {state === "done" && "✓ Ajouté au panier"}
          {state === "error" && "Erreur, réessayer"}
          {state === "idle" &&
            `Ajouter ${qty} pneu${qty > 1 ? "s" : ""}`}
        </button>
      </div>
    </article>
  );
}
