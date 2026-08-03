"use client";

import type { PartnerOrder } from "@/lib/partner";
import { TabHeader } from "@/components/partner/ui";

export function RdvTab({ orders }: { orders: PartnerOrder[] }) {
  const withRdv = orders
    .filter((o) => o.mounting_at)
    .sort((a, b) => (a.mounting_at! < b.mounting_at! ? -1 : 1));

  const now = new Date();
  const upcoming = withRdv.filter((o) => new Date(o.mounting_at!) >= now);
  const past = withRdv.filter((o) => new Date(o.mounting_at!) < now);

  return (
    <div>
      <TabHeader
        title="Rendez-vous de montage"
        subtitle="Le planning des montages que vous avez programmés depuis l'onglet Commandes."
      />

      {withRdv.length === 0 ? (
        <p className="rounded-xl border border-line bg-paper p-6 text-ink-muted">
          Aucun rendez-vous programmé. Fixez un RDV depuis l&apos;onglet
          Commandes.
        </p>
      ) : (
        <div className="space-y-6">
          <Section title="À venir" orders={upcoming} emptyLabel="Aucun rendez-vous à venir." />
          {past.length > 0 && <Section title="Passés" orders={past} muted />}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  orders,
  emptyLabel,
  muted,
}: {
  title: string;
  orders: PartnerOrder[];
  emptyLabel?: string;
  muted?: boolean;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">{title}</h3>
      {orders.length === 0 ? (
        <p className="text-sm text-ink-muted">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div
              key={o.order_number}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3 text-sm ${
                muted ? "opacity-60" : ""
              }`}
            >
              <div>
                <p className="font-semibold text-ink">
                  {new Date(o.mounting_at!).toLocaleString("fr-FR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="text-ink-soft">
                  {o.customer_name ?? "—"}
                  {o.customer_phone && ` · ${o.customer_phone}`}
                  {" — "}
                  <span className="font-mono text-ink-muted">{o.order_number}</span>
                </p>
                <p className="text-ink-muted">
                  {o.items.map((it) => `${it.quantity}× ${it.label}`).join(", ")}
                </p>
                {o.mounting_note && <p className="text-ink-muted">Note : {o.mounting_note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
