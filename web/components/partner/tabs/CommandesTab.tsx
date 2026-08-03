"use client";

import { useMemo, useState } from "react";
import type { PartnerOrder } from "@/lib/partner";
import { TabHeader } from "@/components/partner/ui";

const STATUS_LABEL: Record<string, string> = {
  paid: "Payée",
  sent_to_supplier: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
};

export function CommandesTab({ orders }: { orders: PartnerOrder[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return orders;
    return orders.filter((o) =>
      [o.order_number, o.customer_name, o.customer_phone, o.customer_email]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(s)),
    );
  }, [orders, q]);

  return (
    <div>
      <TabHeader
        title="Commandes"
        subtitle="Les commandes des clients ayant choisi votre garage pour le montage. Les prix de vente ne sont pas affichés."
      />

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher (n° commande, client, téléphone, email)…"
        className="mb-4 w-full max-w-md rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
      />

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-line bg-paper p-6 text-ink-muted">
          Aucune commande {orders.length > 0 ? "ne correspond à la recherche" : "pour le moment"}.
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map((o) => (
            <div key={o.order_number} className="rounded-xl border border-line bg-paper p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold text-ink">{o.order_number}</span>
                <span className="rounded-full bg-paper-dim px-3 py-0.5 text-xs font-bold text-ink-soft">
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {new Date(o.created_at).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>

              <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                {o.items.map((it, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>
                      <strong className="text-ink">{it.quantity}×</strong> {it.label}
                    </span>
                    {it.dimension && (
                      <span className="font-mono text-ink-muted">{it.dimension}</span>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-3 border-t border-line pt-3 text-sm">
                <p className="font-semibold text-ink">Client à contacter</p>
                <p className="text-ink-soft">
                  {o.customer_name ?? "—"}
                  {o.customer_phone && ` · ${o.customer_phone}`}
                </p>
                {o.customer_email && (
                  <a href={`mailto:${o.customer_email}`} className="text-signal hover:underline">
                    {o.customer_email}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
