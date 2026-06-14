"use client";

import Link from "next/link";
import { useState } from "react";
import type { TyreResult } from "@/lib/api";
import { useCart } from "@/components/CartProvider";

const DEFAULT_QTY = 2;
const MIN_QTY = 1;
const MAX_QTY = 20;

export function ProductActions({ tyre }: { tyre: TyreResult }) {
  const { add } = useCart();
  const [qty, setQty] = useState(DEFAULT_QTY);
  const [state, setState] = useState<
    "idle" | "adding" | "done" | "error"
  >("idle");

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
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mt-6">
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-muted">
        Quantité
      </label>
      <div className="mb-4 flex items-center rounded-lg border border-line w-fit">
        <button
          type="button"
          onClick={() => setQty(clamp(qty - 1))}
          disabled={qty <= MIN_QTY}
          className="px-4 py-2 text-ink-soft transition hover:text-signal disabled:opacity-30"
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
          className="w-14 border-x border-line bg-transparent py-2 text-center font-bold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          aria-label="Quantité"
        />
        <button
          type="button"
          onClick={() => setQty(clamp(qty + 1))}
          disabled={qty >= MAX_QTY}
          className="px-4 py-2 text-ink-soft transition hover:text-signal disabled:opacity-30"
          aria-label="Augmenter la quantité"
        >
          +
        </button>
      </div>

      {state === "done" ? (
        <div className="space-y-3">
          <p className="rounded-lg bg-ok/10 px-4 py-3 text-center text-sm font-semibold text-ok">
            ✓ {qty} pneu{qty > 1 ? "s" : ""} ajouté
            {qty > 1 ? "s" : ""} au panier
          </p>
          <Link
            href="/panier"
            className="block rounded-full bg-ink py-3 text-center font-display font-bold uppercase tracking-wide text-paper transition hover:bg-signal"
          >
            Voir mon panier
          </Link>
        </div>
      ) : (
        <button
          onClick={handleAdd}
          disabled={state === "adding"}
          className="w-full rounded-full bg-signal py-3 font-display font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark disabled:opacity-60"
        >
          {state === "adding"
            ? "Ajout…"
            : state === "error"
              ? "Erreur, réessayer"
              : `Ajouter ${qty} pneu${qty > 1 ? "s" : ""} au panier`}
        </button>
      )}
    </div>
  );
}
