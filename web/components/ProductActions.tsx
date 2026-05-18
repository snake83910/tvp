"use client";

import Link from "next/link";
import { useState } from "react";
import type { TyreResult } from "@/lib/api";
import { useCart } from "@/components/CartProvider";

export function ProductActions({ tyre }: { tyre: TyreResult }) {
  const { add } = useCart();
  const [qty, setQty] = useState(2);
  const [state, setState] = useState<
    "idle" | "adding" | "done" | "error"
  >("idle");

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
      <div className="mb-4 flex gap-2">
        {[1, 2, 4].map((q) => (
          <button
            key={q}
            onClick={() => setQty(q)}
            className={`h-10 w-12 rounded-lg border text-sm font-bold transition ${
              qty === q
                ? "border-signal bg-signal text-white"
                : "border-line text-ink-soft hover:border-signal/50"
            }`}
          >
            {q}
          </button>
        ))}
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
