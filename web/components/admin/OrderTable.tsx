import Link from "next/link";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/orderStatus";
import type { AdminOrderSummary } from "@/lib/admin";

export function OrderTable({ orders }: { orders: AdminOrderSummary[] }) {
  if (orders.length === 0) {
    return <p className="text-sm text-ink-muted">Aucune commande.</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-paper shadow-card">
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-paper-dim text-xs font-bold uppercase tracking-wider text-ink-muted">
          <tr>
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
            <tr key={o.order_number} className="border-t border-line hover:bg-paper-dim">
              <td className="px-4 py-3 font-mono font-bold text-ink">{o.order_number}</td>
              <td className="px-4 py-3">
                <p className="text-ink">{o.customer_name ?? "—"}</p>
                <p className="text-xs text-ink-muted">{o.customer_email}</p>
              </td>
              <td className="px-4 py-3 text-ink-soft">
                {new Date(o.created_at).toLocaleDateString("fr-FR", {
                  day: "2-digit", month: "2-digit", year: "numeric",
                })}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_COLOR[o.status] ?? "bg-paper-dim text-ink-soft"}`}>
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
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
  );
}
