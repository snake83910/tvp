"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { TyreImage } from "@/components/TyreImage";
import { useCart } from "@/components/CartProvider";
import { getToken } from "@/lib/auth";
import { SHIP_FLAT_TTC, isFreeShipping } from "@/lib/shipping";

const SEASON: Record<string, string> = {
  ete: "Été",
  hiver: "Hiver",
  "4saisons": "4 saisons",
};

export default function CartPage() {
  // On passe désormais par les méthodes du CartProvider : elles mettent
  // à jour le state React directement avec la réponse de l'API, ce qui
  // redessine la page immédiatement (plus besoin de refresh manuel ni
  // de F5).
  const { cart, refresh, updateQty, removeItem } = useCart();
  const [busy, setBusy] = useState<string | null>(null);
  const [qtyError, setQtyError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function changeQty(itemId: string, q: number) {
    if (q < 1) return;
    setBusy(itemId);
    setQtyError(null);
    try {
      await updateQty(itemId, q);
    } catch (e) {
      // Ex. « Stock insuffisant : il ne reste que 1 pneu... »
      setQtyError(e instanceof Error ? e.message : "Erreur");
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

  const quantities = cart?.items.map((i) => i.quantity) ?? [];
  const freeShipping = isFreeShipping(quantities);
  const shipTtc = freeShipping ? 0 : SHIP_FLAT_TTC;
  const singles = cart?.items.filter((i) => i.quantity === 1) ?? [];

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
              {qtyError && (
                <p className="rounded-lg border border-signal/40 bg-signal-light px-4 py-3 text-sm text-signal-dark">
                  {qtyError}
                </p>
              )}
              {cart.items.map((it) => (
                <div
                  key={it.id}
                  className="rounded-xl border border-line bg-paper p-5 shadow-card"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <TyreImage
                        src={it.image_url ?? null}
                        alt={it.label}
                        className="hidden h-16 w-16 shrink-0 rounded-lg sm:block"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-display font-bold text-ink">
                          {it.label}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                          {it.dimension && (
                            <span className="font-mono">{it.dimension}</span>
                          )}
                          {it.season && SEASON[it.season] && (
                            <span className="rounded-full bg-paper-dim px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                              {SEASON[it.season]}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-ink-muted">
                          {it.price_ttc.toFixed(2).replace(".", ",")} €
                          l&apos;unité
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center rounded-lg border border-line">
                        <button
                          onClick={() => changeQty(it.id, it.quantity - 1)}
                          disabled={busy === it.id}
                          className="px-3 py-1.5 text-ink-soft hover:text-signal disabled:opacity-40"
                          aria-label="Diminuer la quantité"
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
                          aria-label="Augmenter la quantité"
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

                  {/* Upsell métier : les pneus se montent par 2, et la
                      livraison est offerte quand chaque référence >= 2 */}
                  {it.quantity === 1 && (
                    <button
                      onClick={() => changeQty(it.id, 2)}
                      disabled={busy === it.id}
                      className="mt-3 w-full rounded-lg border border-ok/40 bg-ok/5 px-4 py-2 text-left text-sm font-semibold text-ok transition hover:bg-ok/10 disabled:opacity-50"
                    >
                      + Passez à 2 pneus — les pneus se remplacent par
                      essieu, et la livraison devient offerte
                    </button>
                  )}
                </div>
              ))}
            </div>

            <aside className="h-fit rounded-2xl border border-line bg-paper p-6 shadow-card">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
                Récapitulatif
              </p>
              <div className="flex justify-between text-sm text-ink-soft">
                <span>Articles TTC</span>
                <span>
                  {cart.total_ttc.toFixed(2).replace(".", ",")} €
                </span>
              </div>
              <div className="mt-2 flex justify-between text-sm text-ink-soft">
                <span>Livraison estimée</span>
                <span className={freeShipping ? "font-bold text-ok" : ""}>
                  {freeShipping
                    ? "Offerte"
                    : `${SHIP_FLAT_TTC.toFixed(2).replace(".", ",")} €`}
                </span>
              </div>
              {!freeShipping && singles.length > 0 && (
                <p className="mt-2 rounded-lg bg-ok/5 px-3 py-2 text-xs text-ok">
                  💡 Passez chaque référence à 2 pneus et la livraison
                  est <strong>offerte</strong> (−
                  {SHIP_FLAT_TTC.toFixed(2).replace(".", ",")} €).
                </p>
              )}
              <div className="mt-3 flex justify-between border-t border-line pt-3 font-display text-xl font-black text-ink">
                <span>Total TTC</span>
                <span>
                  {(cart.total_ttc + shipTtc)
                    .toFixed(2)
                    .replace(".", ",")}{" "}
                  €
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
              <p className="mt-4 text-center text-[11px] text-ink-muted">
                🔒 Paiement sécurisé Société Générale · Rétractation 14 jours
              </p>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
