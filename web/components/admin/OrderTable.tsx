"use client";

import Link from "next/link";
import type { AdminOrderSummary } from "@/lib/admin";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { CopyButton } from "@/components/admin/CopyButton";
import { EmptyState } from "@/components/admin/EmptyState";

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
  if (orders.length === 0) {
    return (
      <EmptyState
        title="Aucune commande"
        description="Aucune commande ne correspond à vos filtres."
      />
    );
  }
  const allSelected = selectable && selected && orders.length > 0 && orders.every((o) => selected.has(o.order_number));

  return (
    <>
      {/* Desktop : tableau */}
      <div className="hidden overflow-hidden rounded-xl border border-line bg-paper shadow-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-paper-dim text-xs font-bold uppercase tracking-wider text-ink-muted">
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
              <th className="px-4 py-3 text-left">N° commande</th>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-right">Total TTC</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.order_number} className="border-t border-line transition hover:bg-paper-dim">
                {selectable && (
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected?.has(o.order_number) ?? false}
                      onChange={() => onToggle?.(o.order_number)}
                      className="h-4 w-4 cursor-pointer accent-signal"
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-ink">{o.order_number}</span>
                    <CopyButton value={o.order_number} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-ink">{o.customer_name ?? "—"}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-ink-muted">{o.customer_email}</p>
                    <CopyButton value={o.customer_email} label="Copier email" />
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {new Date(o.created_at).toLocaleDateString("fr-FR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-4 py-3 text-right font-display font-black text-ink">
                  {o.total_ttc.toFixed(2).replace(".", ",")} €
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/commandes/${o.order_number}`}
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
        {orders.map((o) => (
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
                {o.total_ttc.toFixed(2).replace(".", ",")} €
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
