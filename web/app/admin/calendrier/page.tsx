"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { adminApi, type AdminOrderSummary } from "@/lib/admin";
import { formatEuro } from "@/lib/money";

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function iso(d: Date) { return d.toISOString().slice(0, 10); }

export default function AdminCalendrier() {
  const [cursor, setCursor] = useState(() => new Date());
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = useMemo(() => startOfMonth(cursor), [cursor]);
  const monthEnd = useMemo(() => endOfMonth(cursor), [cursor]);

  useEffect(() => {
    setLoading(true);
    adminApi.listOrders({
      from_date: iso(monthStart),
      to_date: iso(monthEnd),
      page: 1,
    } as Parameters<typeof adminApi.listOrders>[0])
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [monthStart.getTime(), monthEnd.getTime()]); // eslint-disable-line

  // Grouper par jour
  const byDay: Record<string, AdminOrderSummary[]> = {};
  let totalMois = 0;
  for (const o of orders) {
    const day = o.created_at.slice(0, 10);
    (byDay[day] ??= []).push(o);
    if (["paid", "sent_to_supplier", "shipped", "delivered"].includes(o.status))
      totalMois += o.total_ttc;
  }

  // Calendrier : 6 semaines × 7 jours (commence un lundi)
  const firstDow = (monthStart.getDay() + 6) % 7; // lundi = 0
  const days: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) days.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d++) {
    days.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  }
  while (days.length % 7 !== 0) days.push(null);

  function prev() { setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)); }
  function next() { setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)); }

  const monthLabel = cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-black text-ink">Calendrier</h1>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="rounded border border-line px-3 py-1 text-sm hover:border-signal">←</button>
          <span className="min-w-[180px] text-center font-display text-base font-bold text-ink capitalize">
            {monthLabel}
          </span>
          <button onClick={next} className="rounded border border-line px-3 py-1 text-sm hover:border-signal">→</button>
        </div>
        <div className="text-sm">
          <Link href="/admin/commandes" className="text-ink-muted hover:text-signal">Liste</Link>
          <span className="mx-2 text-ink-muted">·</span>
          <Link href="/admin/kanban" className="text-ink-muted hover:text-signal">Kanban</Link>
        </div>
      </div>

      <p className="mb-3 text-sm text-ink-muted">
        {orders.length} commande{orders.length > 1 ? "s" : ""} ·
        CA encaissé : <strong className="text-ink">{formatEuro(totalMois)}</strong>
      </p>

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-paper shadow-card">
          <div className="grid grid-cols-7 border-b border-line bg-paper-dim text-center text-xs font-bold uppercase text-ink-muted">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              if (!d) return <div key={i} className="min-h-[110px] border-r border-b border-line bg-paper-dim/40" />;
              const key = iso(d);
              const list = byDay[key] ?? [];
              const dayTotal = list.reduce((s, o) =>
                s + (["paid", "sent_to_supplier", "shipped", "delivered"].includes(o.status) ? o.total_ttc : 0), 0);
              return (
                <div key={i} className="min-h-[110px] border-r border-b border-line p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-soft">{d.getDate()}</span>
                    {list.length > 0 && (
                      <span className="rounded-full bg-signal-light px-1.5 text-[10px] font-bold text-signal-dark">
                        {list.length}
                      </span>
                    )}
                  </div>
                  {dayTotal > 0 && (
                    <p className="text-[10px] font-bold text-ok">
                      {dayTotal.toFixed(0)} €
                    </p>
                  )}
                  <ul className="mt-1 space-y-0.5">
                    {list.slice(0, 2).map((o) => (
                      <li key={o.order_number}>
                        <Link
                          href={`/admin/commandes/${o.order_number}`}
                          className="block truncate text-[10px] text-ink-muted hover:text-signal"
                          title={o.order_number}
                        >
                          {o.order_number}
                        </Link>
                      </li>
                    ))}
                    {list.length > 2 && (
                      <li className="text-[10px] text-ink-muted">+{list.length - 2} autres</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
