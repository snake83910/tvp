"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, type AdminOrderSummary, type AdminStats } from "@/lib/admin";
import { STATUS_LABEL } from "@/lib/orderStatus";
import { OrderTable } from "@/components/admin/OrderTable";

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recent, setRecent] = useState<AdminOrderSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      adminApi.getStats(),
      adminApi.listOrders({ per_page: 5 } as Parameters<typeof adminApi.listOrders>[0]),
    ])
      .then(([s, o]) => { setStats(s); setRecent(o); })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"));
  }, []);

  if (error) {
    return <p className="rounded-xl bg-signal-light px-4 py-3 text-sm text-signal-dark">{error}</p>;
  }

  const PAID = ["paid", "sent_to_supplier", "shipped", "delivered"];
  const totalOrders = stats
    ? Object.values(stats.orders_by_status).reduce((a, b) => a + b, 0)
    : null;
  const activeOrders = stats
    ? PAID.reduce((s, k) => s + (stats.orders_by_status[k] ?? 0), 0)
    : null;

  return (
    <div>
      <h1 className="mb-8 font-display text-3xl font-black text-ink">
        Tableau de bord
      </h1>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="CA total"
          value={stats ? `${stats.revenue_total_ttc.toFixed(2).replace(".", ",")} €` : "…"}
        />
        <Kpi
          label="CA aujourd'hui"
          value={stats ? `${stats.revenue_today_ttc.toFixed(2).replace(".", ",")} €` : "…"}
          sub={stats ? `${stats.orders_today} commande${stats.orders_today > 1 ? "s" : ""}` : undefined}
        />
        <Kpi label="Commandes totales" value={totalOrders ?? "…"} />
        <Kpi label="En cours" value={activeOrders ?? "…"} />
      </div>

      {/* Commandes par statut */}
      {stats && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-lg font-black text-ink">
            Par statut
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.orders_by_status).map(([s, count]) => (
              <Link
                key={s}
                href={`/admin/commandes?status=${s}`}
                className="rounded-full border border-line bg-paper px-4 py-1.5 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal"
              >
                {STATUS_LABEL[s] ?? s}
                <span className="ml-2 font-bold text-ink">{count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Dernières commandes */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-black text-ink">
            Dernières commandes
          </h2>
          <Link href="/admin/commandes" className="text-sm font-semibold text-signal hover:underline">
            Voir tout →
          </Link>
        </div>
        <OrderTable orders={recent} />
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-5 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-black text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}

