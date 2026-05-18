"use client";

import Link from "next/link";
import { useState } from "react";
import type { TyreResult } from "@/lib/api";
import { useCart } from "@/components/CartProvider";
import { TyreImage } from "@/components/TyreImage";

const SEASON: Record<string, string> = {
  ete: "Été", hiver: "Hiver", "4saisons": "4 saisons", inconnu: "—",
};
const QTY_CHOICES = [1, 2, 4];

export function TyreCard({ tyre }: { tyre: TyreResult }) {
  const { add } = useCart();
  const [qty, setQty] = useState(2);
  const [state, setState] = useState<"idle"|"adding"|"done"|"error">("idle");
  const price = tyre.display_price.toFixed(2).replace(".", ",");
  const detailHref = `/produit/${encodeURIComponent(tyre.supplier_ref)}?w=${tyre.width}&h=${tyre.aspect_ratio}&d=${tyre.diameter}`;

  async function handleAdd() {
    if (tyre.width == null || tyre.aspect_ratio == null || tyre.diameter == null) {
      setState("error"); return;
    }
    setState("adding");
    try {
      await add({
        supplier_ref: tyre.supplier_ref,
        width: tyre.width, ratio: tyre.aspect_ratio, diameter: tyre.diameter,
        quantity: qty,
      });
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch { setState("error"); }
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
        <div>
          <Link
            href={detailHref}
            className="font-display text-lg font-bold text-ink hover:text-signal"
          >
            {tyre.brand}
          </Link>
          <p className="text-sm text-ink-muted">{tyre.model}</p>
        </div>
        <span className="shrink-0 rounded-full bg-paper-dim px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
          {SEASON[tyre.season] ?? tyre.season}
        </span>
      </div>

      <p className="mb-4 font-mono text-sm text-ink-soft">{tyre.dimension}</p>

      <div className="mb-5 flex gap-3 text-xs text-ink-muted">
        {tyre.load_index && <span>Charge <span className="font-semibold text-ink">{tyre.load_index}</span></span>}
        {tyre.speed_rating && <span>Vitesse <span className="font-semibold text-ink">{tyre.speed_rating}</span></span>}
      </div>

      <div className="mt-auto border-t border-line pt-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="font-display text-2xl font-black text-ink">{price} €</p>
            <p className="text-[11px] uppercase tracking-wider text-ink-muted">prix {tyre.display_mode}</p>
          </div>
          <div className="flex items-center gap-1">
            {QTY_CHOICES.map((q) => (
              <button key={q} onClick={() => setQty(q)}
                className={`h-8 w-8 rounded-md border text-sm font-bold transition ${
                  qty === q ? "border-signal bg-signal text-white"
                            : "border-line text-ink-soft hover:border-signal/50"}`}>
                {q}
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleAdd} disabled={state === "adding"}
          className={`w-full rounded-full px-5 py-2.5 text-sm font-bold text-white transition ${
            state === "done" ? "bg-ok" : "bg-signal hover:bg-signal-dark disabled:opacity-60"}`}>
          {state === "adding" && "Ajout…"}
          {state === "done" && "✓ Ajouté au panier"}
          {state === "error" && "Erreur, réessayer"}
          {state === "idle" && `Ajouter ${qty} pneu${qty > 1 ? "s" : ""}`}
        </button>
      </div>
    </article>
  );
}
