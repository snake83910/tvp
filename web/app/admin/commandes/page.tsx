"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { adminApi, type AdminOrderSummary } from "@/lib/admin";
import { STATUS_LABEL } from "@/lib/orderStatus";
import { OrderTable } from "@/components/admin/OrderTable";

const STATUSES = [
  "paid",
  "sent_to_supplier",
  "shipped",
  "delivered",
  "pending_payment",
  "cancelled",
  "refunded",
];

export default function AdminOrders() {
  const sp = useSearchParams();
  const router = useRouter();

  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState(sp.get("q") ?? "");
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [page, setPage] = useState(Number(sp.get("page") ?? 1));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fetch_(s: string, st: string, p: number) {
    setLoading(true);
    setError(null);
    adminApi
      .listOrders({ q: s || undefined, status: st || undefined, page: p })
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));

    const params = new URLSearchParams();
    if (s) params.set("q", s);
    if (st) params.set("status", st);
    if (p > 1) params.set("page", String(p));
    router.replace(`/admin/commandes${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  useEffect(() => { fetch_(search, status, page); }, []); // eslint-disable-line

  function onSearch(val: string) {
    setSearch(val);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetch_(val, status, 1), 350);
  }

  function onStatus(val: string) {
    setStatus(val);
    setPage(1);
    fetch_(search, val, 1);
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-black text-ink">Commandes</h1>

      {/* Filtres */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Recherche n° commande ou email…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-10 flex-1 rounded-lg border border-line bg-paper px-4 text-sm text-ink outline-none transition focus:border-signal"
        />
        <select
          value={status}
          onChange={(e) => onStatus(e.target.value)}
          className="h-10 rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none transition focus:border-signal"
        >
          <option value="">Tous les statuts</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-signal-light px-4 py-3 text-sm text-signal-dark">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : (
        <OrderTable orders={orders} />
      )}

      {/* Pagination simple */}
      {!loading && orders.length > 0 && (
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetch_(search, status, p); }}
            disabled={page === 1}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft disabled:opacity-40 hover:border-signal hover:text-signal"
          >
            ← Précédent
          </button>
          <span className="flex items-center px-3 text-sm text-ink-muted">Page {page}</span>
          <button
            onClick={() => { const p = page + 1; setPage(p); fetch_(search, status, p); }}
            disabled={orders.length < 25}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft disabled:opacity-40 hover:border-signal hover:text-signal"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
