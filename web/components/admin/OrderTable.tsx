"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminOrderSummary } from "@/lib/admin";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { CopyButton } from "@/components/admin/CopyButton";
import { EmptyState } from "@/components/admin/EmptyState";
import { formatEuro } from "@/lib/money";

type SortKey = "order_number" | "customer_email" | "created_at" | "status" | "total_ttc";
type SortDir = "asc" | "desc";

interface Props {
  orders: AdminOrderSummary[];
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (orderNumber: string) => void;
  onToggleAll?: () => void;
}

export function OrderTable({
  orders,
  selectable = false,
  selected,
  onToggle,
  onToggleAll,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [dense, setDense] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("tvp_admin_dense") === "1";
  });

  function toggleDense() {
    const next = !dense;
    setDense(next);
    if (typeof window !== "undefined") localStorage.setItem("tvp_admin_dense", next ? "1" : "0");
  }

  const rowPy = dense ? "py-1.5" : "py-3";

  function sort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        title="Aucune commande"
        description="Aucune commande ne correspond à vos filtres."
      />
    );
  }

  const sorted = [...orders].sort((a, b) => {
    const av = a[sortKey] as string | number;
    const bv = b[sortKey] as string | number;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const allSelected = selectable && selected && orders.length > 0 && orders.every((o) => selected.has(o.order_number));

  return (
    <>
      {/* Toolbar densité */}
      <div className="mb-2 hidden justify-end md:flex">
        <button
          onClick={toggleDense}
          className="rounded border border-line bg-paper px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:border-signal hover:text-signal"
          aria-pressed={dense}
          title="Basculer densité (compact/aéré)"
        >
          {dense ? "▥ Aéré" : "▤ Compact"}
        </button>
      </div>

      {/* Desktop : tableau */}
      <div className="hidden overflow-hidden rounded-xl border border-line bg-paper shadow-card md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-line bg-paper-dim text-xs font-bold uppercase tracking-wider text-ink-muted">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    className="h-4 w-4 cursor-pointer accent-signal"
                    aria-label="Tout sélectionner"
                  />
                </th>
              )}
              <SortableTh label="N° commande" col="order_number" sortKey={sortKey} sortDir={sortDir} onSort={sort} />
              <SortableTh label="Client" col="customer_email" sortKey={sortKey} sortDir={sortDir} onSort={sort} />
              <SortableTh label="Date" col="created_at" sortKey={sortKey} sortDir={sortDir} onSort={sort} />
              <SortableTh label="Statut" col="status" sortKey={sortKey} sortDir={sortDir} onSort={sort} />
              <SortableTh label="Total TTC" col="total_ttc" sortKey={sortKey} sortDir={sortDir} onSort={sort} align="right" />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((o) => (
              <tr key={o.order_number} className="border-t border-line transition hover:bg-paper-dim">
                {selectable && (
                  <td className={`px-3 ${rowPy}`}>
                    <input
                      type="checkbox"
                      checked={selected?.has(o.order_number) ?? false}
                      onChange={() => onToggle?.(o.order_number)}
                      className="h-4 w-4 cursor-pointer accent-signal"
                    />
                  </td>
                )}
                <td className={`px-4 ${rowPy}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-ink">{o.order_number}</span>
                    <CopyButton value={o.order_number} />
                  </div>
                </td>
                <td className={`px-4 ${rowPy}`}>
                  <p className="text-ink">{o.customer_name ?? "—"}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-ink-muted">{o.customer_email}</p>
                    <CopyButton value={o.customer_email} label="Copier email" />
                  </div>
                </td>
                <td className={`px-4 ${rowPy} text-ink-soft`}>
                  {new Date(o.created_at).toLocaleDateString("fr-FR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                  })}
                </td>
                <td className={`px-4 ${rowPy}`}>
                  <StatusBadge status={o.status} />
                </td>
                <td className={`px-4 ${rowPy} text-right font-display font-black text-ink`}>
                  {formatEuro(o.total_ttc)}
                </td>
                <td className={`relative px-4 ${rowPy} text-right`}>
                  <button
                    onClick={() => setMenuOpen(menuOpen === o.order_number ? null : o.order_number)}
                    className="rounded p-1 text-ink-muted hover:bg-paper-dim hover:text-signal"
                    aria-label="Actions"
                  >
                    ⋯
                  </button>
                  {menuOpen === o.order_number && (
                    <div
                      className="absolute right-4 top-10 z-20 w-48 rounded-lg border border-line bg-paper py-1 shadow-card"
                      onMouseLeave={() => setMenuOpen(null)}
                    >
                      <Link
                        href={`/admin/commandes/${o.order_number}`}
                        className="block px-3 py-2 text-sm text-ink hover:bg-paper-dim"
                      >
                        Voir le détail
                      </Link>
                      <a
                        href={`mailto:${o.customer_email}`}
                        className="block px-3 py-2 text-sm text-ink hover:bg-paper-dim"
                      >
                        Envoyer un email
                      </a>
                      <button
                        onClick={() => { navigator.clipboard.writeText(o.order_number); setMenuOpen(null); }}
                        className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-paper-dim"
                      >
                        Copier le n°
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile : cartes */}
      <ul className="space-y-3 md:hidden">
        {sorted.map((o) => (
          <li key={o.order_number} className="rounded-xl border border-line bg-paper p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono font-bold text-ink">{o.order_number}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{o.customer_email}</p>
              </div>
              <StatusBadge status={o.status} />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-xs text-ink-soft">
                {new Date(o.created_at).toLocaleDateString("fr-FR")}
              </p>
              <p className="font-display text-lg font-black text-ink">
                {formatEuro(o.total_ttc)}
              </p>
            </div>
            <Link
              href={`/admin/commandes/${o.order_number}`}
              className="mt-3 inline-block text-sm font-semibold text-signal"
            >
              Voir le détail →
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function SortableTh({
  label, col, sortKey, sortDir, onSort, align = "left",
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === col;
  return (
    <th className={`px-4 py-3 text-${align}`}>
      <button
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 transition ${active ? "text-ink" : "hover:text-ink"}`}
      >
        {label}
        <span className={`text-[10px] ${active ? "opacity-100" : "opacity-30"}`}>
          {active && sortDir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}
