"use client";

import Link from "next/link";
import type { Address, OrderSummary } from "@/lib/auth";
import { StatusBadge, type Tab } from "@/components/compte/shared";
import { formatEuro } from "@/lib/money";

export function OverviewTab({
  user, orders, addresses, onTabChange,
}: {
  user: { account_type: string };
  orders: OrderSummary[] | null;
  addresses: Address[] | null;
  onTabChange: (t: Tab) => void;
}) {
  const PAID = ["paid", "sent_to_supplier", "shipped", "delivered"];
  const totalSpent = orders?.filter((o) => PAID.includes(o.status))
    .reduce((s, o) => s + o.total_ttc, 0) ?? 0;
  const orderCount = orders?.length ?? 0;
  const inProgressCount = orders?.filter((o) =>
    ["paid", "sent_to_supplier", "shipped"].includes(o.status)).length ?? 0;
  const lastOrder = orders?.[0];

  return (
    <div className="space-y-8">
      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Commandes passées" value={orderCount.toString()} />
        <Kpi
          label="Total dépensé"
          value={formatEuro(totalSpent)}
          hint={user.account_type === "pro" ? "HT" : "TTC"}
        />
        <Kpi label="En cours" value={inProgressCount.toString()} />
      </div>

      {/* Dernière commande */}
      {lastOrder && (
        <section className="rounded-2xl border border-line bg-paper p-6 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-black text-ink">Dernière commande</h2>
            <button
              onClick={() => onTabChange("orders")}
              className="text-sm font-semibold text-signal hover:underline"
            >
              Voir toutes →
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
            <div>
              <p className="font-mono font-bold text-ink">{lastOrder.order_number}</p>
              <p className="text-xs text-ink-muted">
                {new Date(lastOrder.created_at).toLocaleDateString("fr-FR", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              </p>
            </div>
            <StatusBadge status={lastOrder.status} />
            <p className="font-display text-lg font-black text-ink">
              {formatEuro(lastOrder.total_ttc)}
            </p>
            <Link
              href={`/commandes/${lastOrder.order_number}`}
              className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper hover:bg-signal"
            >
              Détail
            </Link>
          </div>
        </section>
      )}

      {/* Raccourcis */}
      <section>
        <h2 className="mb-3 font-display text-lg font-black text-ink">Raccourcis</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/recherche"
            className="rounded-xl border border-line bg-paper p-5 transition hover:border-signal hover:shadow-lift"
          >
            <p className="font-display text-base font-bold text-ink">Nouvelle commande</p>
            <p className="mt-1 text-xs text-ink-muted">Rechercher des pneus →</p>
          </Link>
          <button
            onClick={() => onTabChange("addresses")}
            className="rounded-xl border border-line bg-paper p-5 text-left transition hover:border-signal hover:shadow-lift"
          >
            <p className="font-display text-base font-bold text-ink">
              {addresses?.length ?? 0} adresse{(addresses?.length ?? 0) > 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-xs text-ink-muted">Gérer mes adresses →</p>
          </button>
          <button
            onClick={() => onTabChange("security")}
            className="rounded-xl border border-line bg-paper p-5 text-left transition hover:border-signal hover:shadow-lift"
          >
            <p className="font-display text-base font-bold text-ink">Sécurité</p>
            <p className="mt-1 text-xs text-ink-muted">Mot de passe, email →</p>
          </button>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-5 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-black text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
