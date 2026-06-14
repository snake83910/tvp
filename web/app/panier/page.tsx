"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { useCart } from "@/components/CartProvider";
import { getToken } from "@/lib/auth";

export default function CartPage() {
  // On passe désormais par les méthodes du CartProvider : elles mettent
  // à jour le state React directement avec la réponse de l'API, ce qui
  // redessine la page immédiatement (plus besoin de refresh manuel ni
  // de F5).
  const { cart, refresh, updateQty, removeItem } = useCart();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function changeQty(itemId: string, q: number) {
    if (q < 1) return;
    setBusy(itemId);
    try {
      await updateQty(itemId, q);
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(itemId: string) {
    setBusy(itemId);
    try {
      await removeItem(itemId);
    } finally {
      setBusy(null);
    }
  }

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="mb-8 font-display text-3xl font-black tracking-tightest text-ink">
          Mon panier
        </h1>

        {isEmpty ? (
          <div className="rounded-2xl border border-line bg-paper p-10 text-center shadow-card">
            <p className="text-ink-muted">Votre panier est vide.</p>
            <Link
              href="/recherche"
              className="mt-4 inline-block rounded-full bg-signal px-6 py-3 text-sm font-bold text-white transition hover:bg-signal-dark"
            >
              Rechercher des pneus
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              {cart.items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-line bg-paper p-5 shadow-card"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display font-bold text-ink">
                      {it.label}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {it.price_ttc.toFixed(2).replace(".", ",")} €
                      l&apos;unité
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center rounded-lg border border-line">
                      <button
                        onClick={() => changeQty(it.id, it.quantity - 1)}
                        disabled={busy === it.id}
                        className="px-3 py-1.5 text-ink-soft hover:text-signal disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-bold">
                        {it.quantity}
                      </span>
                      <button
                        onClick={() => changeQty(it.id, it.quantity + 1)}
                        disabled={busy === it.id}
                        className="px-3 py-1.5 text-ink-soft hover:text-signal disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    <p className="w-24 text-right font-display font-black text-ink">
                      {(it.price_ttc * it.quantity)
                        .toFixed(2)
                        .replace(".", ",")}{" "}
                      €
                    </p>
                    <button
                      onClick={() => handleRemove(it.id)}
                      disabled={busy === it.id}
                      className="text-sm text-ink-muted hover:text-signal disabled:opacity-40"
                      title="Retirer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <aside className="h-fit rounded-2xl border border-line bg-paper p-6 shadow-card">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
                Récapitulatif
              </p>
              <div className="flex justify-between text-sm text-ink-soft">
                <span>Total HT</span>
                <span>
                  {cart.total_ht.toFixed(2).replace(".", ",")} €
                </span>
              </div>
              <div className="mt-2 flex justify-between border-t border-line pt-3 font-display text-xl font-black text-ink">
                <span>Total TTC</span>
                <span>
                  {cart.total_ttc.toFixed(2).replace(".", ",")} €
                </span>
              </div>

              <Link
                href={
                  getToken() ? "/checkout" : "/connexion?next=/checkout"
                }
                className="mt-6 block rounded-full bg-signal py-3 text-center font-display font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark"
              >
                Passer commande
              </Link>
              {!getToken() && (
                <p className="mt-3 text-center text-xs text-ink-muted">
                  Connexion requise pour finaliser la commande. Votre
                  panier sera conservé.
                </p>
              )}
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
