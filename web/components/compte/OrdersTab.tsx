"use client";

import Link from "next/link";
import { useState } from "react";
import type { OrderSummary } from "@/lib/auth";
import { SkeletonList } from "@/components/Skeleton";
import { STATUS_LABEL, StatusBadge } from "@/components/compte/shared";

export function OrdersTab({ orders }: { orders: OrderSummary[] | null }) {
  const [filter, setFilter] = useState<string>("");

  if (orders === null) return <SkeletonList count={3} itemClass="h-24" />;

  const filtered = filter ? orders.filter((o) => o.status === filter) : orders;
  const statusesPresent = Array.from(new Set(orders.map((o) => o.status)));

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-paper p-10 text-center shadow-card">
        <p className="text-4xl">🛒</p>
        <p className="mt-3 text-ink-muted">Aucune commande pour l&apos;instant.</p>
        <Link
          href="/recherche"
          className="mt-4 inline-block rounded-full bg-signal px-6 py-3 text-sm font-bold text-white hover:bg-signal-dark"
        >
          Rechercher des pneus
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Filtres statut */}
      {statusesPresent.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              !filter ? "border-signal bg-signal text-white" : "border-line text-ink-soft hover:border-signal hover:text-signal"
            }`}
          >
            Toutes ({orders.length})
          </button>
          {statusesPresent.map((s) => {
            const count = orders.filter((o) => o.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  filter === s ? "border-signal bg-signal text-white" : "border-line text-ink-soft hover:border-signal hover:text-signal"
                }`}
              >
                {STATUS_LABEL[s]} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Desktop : tableau */}
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-paper shadow-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-paper-dim">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-muted">N° commande</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-muted">Date</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-muted">Articles</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-muted">Statut</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-ink-muted">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.order_number} className="border-t border-line hover:bg-paper-dim">
                <td className="px-4 py-3 font-mono font-bold text-ink">{o.order_number}</td>
                <td className="px-4 py-3 text-ink-soft">
                  {new Date(o.created_at).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {o.item_count} pneu{o.item_count > 1 ? "s" : ""}
                </td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 text-right font-display font-black text-ink">
                  {o.total_ttc.toFixed(2).replace(".", ",")} €
                </td>
                <td className="px-4 py-3 text-right">
                  {o.status === "pending_payment" && (
                    <Link
                      href={`/paiement/${o.order_number}`}
                      className="mr-3 rounded-full bg-signal px-3 py-1 text-xs font-bold text-white hover:bg-signal-dark"
                    >
                      Payer
                    </Link>
                  )}
                  <Link
                    href={`/commandes/${o.order_number}`}
                    className="text-sm font-semibold text-signal hover:underline"
                  >
                    Détail →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile : cartes */}
      <ul className="space-y-3 md:hidden">
        {filtered.map((o) => (
          <li key={o.order_number} className="rounded-xl border border-line bg-paper p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono font-bold text-ink">{o.order_number}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {new Date(o.created_at).toLocaleDateString("fr-FR")} · {o.item_count} pneu{o.item_count > 1 ? "s" : ""}
                </p>
              </div>
              <StatusBadge status={o.status} />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <p className="font-display text-lg font-black text-ink">
                {o.total_ttc.toFixed(2).replace(".", ",")} €
              </p>
              <div className="flex items-center gap-3">
                {o.status === "pending_payment" && (
                  <Link
                    href={`/paiement/${o.order_number}`}
                    className="rounded-full bg-signal px-3 py-1 text-xs font-bold text-white"
                  >
                    Payer
                  </Link>
                )}
                <Link
                  href={`/commandes/${o.order_number}`}
                  className="text-sm font-semibold text-signal"
                >
                  Voir →
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
