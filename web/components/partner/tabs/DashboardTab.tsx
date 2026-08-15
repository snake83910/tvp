"use client";

import type { Garage, PartnerOrder } from "@/lib/partner";
import { formatEuro } from "@/lib/money";
import { paymentLabel, vehicleLabel } from "@/components/garage/constants";

export function DashboardTab({
  garage,
  orders,
}: {
  garage: Garage;
  orders: PartnerOrder[];
}) {
  return (
    <div className="space-y-6">
      {!garage.is_published && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Votre page n&apos;est pas encore publiée — elle le sera après
          validation de vos informations (SIRET, Kbis) par notre équipe.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Commandes reçues" value={String(orders.length)} />
        <Stat label="Lignes tarifaires" value={String((garage.pricing ?? []).length)} />
        <Stat
          label="Statut"
          value={garage.is_published ? "Publié" : "En attente"}
          tone={garage.is_published ? "ok" : "warn"}
        />
      </div>

      <Card title="Coordonnées du centre">
        <p className="text-sm text-ink-soft">
          {garage.address}
          <br />
          {garage.postal_code} {garage.city}
          {garage.phone && (
            <>
              <br />
              Tél. : {garage.phone}
            </>
          )}
          {garage.email && (
            <>
              <br />
              {garage.email}
            </>
          )}
        </p>
      </Card>

      <Card title="Moyens de paiement acceptés">
        {(garage.payment_methods ?? []).length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun renseigné.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {garage.payment_methods.map((p) => (
              <span key={p} className="rounded-full border border-line bg-paper-dim px-3 py-1 text-sm text-ink-soft">
                {paymentLabel(p)}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card title="Grille tarifaire de montage">
        {(garage.pricing ?? []).length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun tarif renseigné.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-muted">
                  <th className="py-2 pr-4">Véhicule</th>
                  <th className="py-2 pr-4">Prestation</th>
                  <th className="py-2 pr-4">Jantes</th>
                  <th className="py-2">Prix</th>
                </tr>
              </thead>
              <tbody>
                {garage.pricing.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 text-ink">{vehicleLabel(r.vehicle)}</td>
                    <td className="py-2 pr-4 text-ink-soft">{r.label || "—"}</td>
                    <td className="py-2 pr-4 text-ink-soft">{r.size_min}″ → {r.size_max}″</td>
                    <td className="py-2 font-semibold text-ink">{formatEuro(r.price_cents / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p
        className={`mt-1 font-display text-2xl font-black ${
          tone === "ok" ? "text-ok" : tone === "warn" ? "text-signal" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-5">
      <h3 className="mb-3 font-display text-base font-bold text-ink">{title}</h3>
      {children}
    </div>
  );
}
