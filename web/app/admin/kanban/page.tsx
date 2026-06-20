"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, type AdminOrderSummary } from "@/lib/admin";
import { useToast } from "@/components/admin/Toast";
import { StatusBadge } from "@/components/admin/StatusBadge";

const COLUMNS: { key: string; label: string }[] = [
  { key: "pending_payment", label: "En attente paiement" },
  { key: "paid", label: "Payée" },
  { key: "sent_to_supplier", label: "Transmise" },
  { key: "shipped", label: "Expédiée" },
  { key: "delivered", label: "Livrée" },
];

const NEXT_OF: Record<string, string> = {
  paid: "sent_to_supplier",
  sent_to_supplier: "shipped",
  shipped: "delivered",
};

export default function AdminKanban() {
  const { toast } = useToast();
  const [byStatus, setByStatus] = useState<Record<string, AdminOrderSummary[]>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const all: Record<string, AdminOrderSummary[]> = {};
    await Promise.all(COLUMNS.map(async (c) => {
      try {
        const list = await adminApi.listOrders({ status: c.key, page: 1 });
        all[c.key] = list;
      } catch { all[c.key] = []; }
    }));
    setByStatus(all);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function moveNext(o: AdminOrderSummary) {
    const next = NEXT_OF[o.status];
    if (!next) return;
    try {
      await adminApi.updateStatus(o.order_number, { status: next });
      toast(`${o.order_number} → ${next}`, "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-black text-ink">Kanban</h1>
        <div className="flex gap-2 text-sm">
          <Link href="/admin/commandes" className="text-ink-muted hover:text-signal">Liste</Link>
          <span className="text-ink-muted">·</span>
          <Link href="/admin/calendrier" className="text-ink-muted hover:text-signal">Calendrier</Link>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {COLUMNS.map((col) => (
            <div key={col.key} className="rounded-xl border border-line bg-paper-dim p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-sm font-black text-ink">{col.label}</p>
                <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-bold text-ink-muted">
                  {byStatus[col.key]?.length ?? 0}
                </span>
              </div>
              <ul className="space-y-2">
                {(byStatus[col.key] ?? []).map((o) => (
                  <li key={o.order_number} className="rounded-lg border border-line bg-paper p-3 shadow-card">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/admin/commandes/${o.order_number}`}
                        className="font-mono text-xs font-bold text-ink hover:text-signal"
                      >
                        {o.order_number}
                      </Link>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-muted">{o.customer_email}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-sm font-bold text-ink">
                        {o.total_ttc.toFixed(2).replace(".", ",")} €
                      </p>
                      {NEXT_OF[o.status] && (
                        <button
                          onClick={() => moveNext(o)}
                          className="rounded bg-ink px-2 py-0.5 text-[10px] font-bold text-paper hover:bg-signal"
                          title={`Passer à ${NEXT_OF[o.status]}`}
                        >
                          →
                        </button>
                      )}
                    </div>
                  </li>
                ))}
                {(byStatus[col.key]?.length ?? 0) === 0 && (
                  <li className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-ink-muted">
                    Vide
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
