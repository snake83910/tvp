"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, type AdminOrderSummary, type AdminStats } from "@/lib/admin";
import { OrderTable } from "@/components/admin/OrderTable";
import { Sparkline } from "@/components/admin/Sparkline";
import { SkeletonList } from "@/components/Skeleton";

const POLL_INTERVAL = 30000; // 30s

interface Spark {
  days: string[];
  revenue: number[];
  orders: number[];
}

interface Attention {
  to_ship: AdminOrderSummary[];
  late: AdminOrderSummary[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recent, setRecent] = useState<AdminOrderSummary[]>([]);
  const [spark, setSpark] = useState<Spark | null>(null);
  const [attention, setAttention] = useState<Attention | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadAll() {
    Promise.all([
      adminApi.getStats(),
      adminApi.listOrders({ per_page: 5 } as Parameters<typeof adminApi.listOrders>[0]),
      adminApi.getSparkline().catch(() => null),
      adminApi.getAttention().catch(() => null),
    ])
      .then(([s, o, sp, att]) => {
        setStats(s); setRecent(o); setSpark(sp as Spark | null); setAttention(att as Attention | null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"));
  }

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, POLL_INTERVAL);
    return () => clearInterval(t);
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
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl font-black text-ink">Tableau de bord</h1>
        <p className="text-xs text-ink-muted">Actualisation auto · 30s</p>
      </div>

      {/* KPI avec sparkline */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="CA 30 jours"
          value={stats ? `${(stats.revenue_30d_ttc ?? 0).toFixed(2).replace(".", ",")} €` : "…"}
          sub={stats ? `${stats.orders_30d ?? 0} commande${(stats.orders_30d ?? 0) > 1 ? "s" : ""}` : undefined}
          spark={spark?.revenue}
        />
        <Kpi
          label="CA aujourd'hui"
          value={stats ? `${stats.revenue_today_ttc.toFixed(2).replace(".", ",")} €` : "…"}
          sub={stats ? `${stats.orders_today} commande${stats.orders_today > 1 ? "s" : ""}` : undefined}
        />
        <Kpi
          label="Panier moyen"
          value={stats ? `${(stats.avg_cart_ttc ?? 0).toFixed(2).replace(".", ",")} €` : "…"}
          sub="30 derniers jours"
        />
        <Kpi label="Commandes en cours" value={activeOrders ?? "…"} sub={totalOrders ? `${totalOrders} total` : undefined} />
      </div>

      {/* Widgets attention */}
      {attention && (attention.to_ship.length > 0 || attention.late.length > 0) && (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {attention.to_ship.length > 0 && (
            <AttentionCard
              tone="info"
              title={`${attention.to_ship.length} à expédier`}
              hint="Paiement confirmé, en attente de transmission fournisseur."
              orders={attention.to_ship}
            />
          )}
          {attention.late.length > 0 && (
            <AttentionCard
              tone="warn"
              title={`${attention.late.length} en retard`}
              hint="Envoyée au fournisseur depuis +48h, sans expédition."
              orders={attention.late}
            />
          )}
        </div>
      )}

      {/* Top produits */}
      {stats?.top_products && stats.top_products.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-lg font-black text-ink">Top produits (30 jours)</h2>
          <div className="overflow-hidden rounded-xl border border-line bg-paper shadow-card">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-paper-dim text-xs font-bold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-2 text-left">Réf</th>
                  <th className="px-4 py-2 text-left">Modèle</th>
                  <th className="px-4 py-2 text-right">Qté</th>
                  <th className="px-4 py-2 text-right">CA TTC</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_products.map((p) => (
                  <tr key={p.ref} className="border-t border-line">
                    <td className="px-4 py-2 font-mono text-xs text-ink-soft">{p.ref}</td>
                    <td className="px-4 py-2 text-ink">{p.label}</td>
                    <td className="px-4 py-2 text-right font-semibold text-ink">{p.qty}</td>
                    <td className="px-4 py-2 text-right font-display font-black text-ink">
                      {p.revenue_ttc.toFixed(2).replace(".", ",")} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Commandes par statut */}
      {stats && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-lg font-black text-ink">Par statut</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.orders_by_status).map(([s, count]) => (
              <Link
                key={s}
                href={`/admin/commandes?status=${s}`}
                className="rounded-full border border-line bg-paper px-4 py-1.5 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal"
              >
                {s} <span className="ml-2 font-bold text-ink">{count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Dernières commandes */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-black text-ink">Dernières commandes</h2>
          <Link href="/admin/commandes" className="text-sm font-semibold text-signal hover:underline">
            Voir tout →
          </Link>
        </div>
        {stats === null ? <SkeletonList count={3} itemClass="h-16" /> : <OrderTable orders={recent} />}
      </div>
    </div>
  );
}

function Kpi({
  label, value, sub, spark,
}: { label: string; value: string | number; sub?: string; spark?: number[] }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-5 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-black text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
      {spark && spark.length > 1 && (
        <div className="mt-3">
          <Sparkline values={spark} width={200} height={36} />
        </div>
      )}
    </div>
  );
}

function AttentionCard({
  tone, title, hint, orders,
}: { tone: "info" | "warn"; title: string; hint: string; orders: AdminOrderSummary[] }) {
  const border = tone === "warn" ? "border-amber-300" : "border-blue-200";
  const bg = tone === "warn" ? "bg-amber-50" : "bg-blue-50";
  const text = tone === "warn" ? "text-amber-800" : "text-blue-800";
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-5`}>
      <p className={`font-display text-lg font-black ${text}`}>{title}</p>
      <p className={`mt-1 text-xs ${text} opacity-80`}>{hint}</p>
      <ul className="mt-4 space-y-1.5">
        {orders.slice(0, 5).map((o) => (
          <li key={o.order_number} className="flex items-center justify-between text-sm">
            <Link
              href={`/admin/commandes/${o.order_number}`}
              className={`font-mono font-bold ${text} hover:underline`}
            >
              {o.order_number}
            </Link>
            <span className={`text-xs ${text} opacity-80`}>{o.customer_email}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
