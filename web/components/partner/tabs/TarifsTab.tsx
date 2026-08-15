"use client";

import { useState } from "react";
import type { Garage, PartnerEditablePayload, GaragePricingRow } from "@/lib/partner";
import { TabHeader } from "@/components/partner/ui";
import { VEHICLE_TYPES, vehicleLabel } from "@/components/partner/constants";

const emptyRow: GaragePricingRow = {
  vehicle: "voiture",
  size_min: 14,
  size_max: 17,
  price_cents: 0,
  label: "",
};

export function TarifsTab({
  garage,
  save,
  saving,
}: {
  garage: Garage;
  save: (p: PartnerEditablePayload) => Promise<void>;
  saving: boolean;
}) {
  const [rows, setRows] = useState<GaragePricingRow[]>(garage.pricing ?? []);

  function update(i: number, patch: Partial<GaragePricingRow>) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  return (
    <div>
      <TabHeader
        title="Prestations & tarifs de montage"
        subtitle="Votre grille de prix de montage par type de véhicule et diamètre de jante (réglé sur place)."
      />

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line bg-paper-dim text-left text-xs uppercase tracking-wider text-ink-muted">
              <th className="p-3">Véhicule</th>
              <th className="p-3">Prestation</th>
              <th className="p-3">Jante min (″)</th>
              <th className="p-3">Jante max (″)</th>
              <th className="p-3">Prix / pneu (€)</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-ink-muted">
                  Aucune ligne. Ajoutez vos tarifs ci-dessous.
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="p-2">
                  <select
                    value={row.vehicle}
                    onChange={(e) => update(i, { vehicle: e.target.value })}
                    className="rounded-lg border border-line bg-paper px-2 py-1.5 outline-none focus:border-signal"
                  >
                    {VEHICLE_TYPES.map((v) => (
                      <option key={v.key} value={v.key}>{v.label}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <input
                    value={row.label ?? ""}
                    placeholder="Toutes jantes"
                    onChange={(e) => update(i, { label: e.target.value })}
                    className="w-36 rounded-lg border border-line bg-paper px-2 py-1.5 outline-none focus:border-signal"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={row.size_min}
                    onChange={(e) => update(i, { size_min: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-line bg-paper px-2 py-1.5 outline-none focus:border-signal"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={row.size_max}
                    onChange={(e) => update(i, { size_max: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-line bg-paper px-2 py-1.5 outline-none focus:border-signal"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    step="0.5"
                    value={(row.price_cents / 100).toString()}
                    onChange={(e) =>
                      update(i, { price_cents: Math.round((parseFloat(e.target.value) || 0) * 100) })
                    }
                    className="w-24 rounded-lg border border-line bg-paper px-2 py-1.5 outline-none focus:border-signal"
                  />
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                    className="text-ink-muted hover:text-signal"
                    aria-label="Retirer"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => setRows((r) => [...r, { ...emptyRow }])}
          className="rounded-lg border border-signal px-3 py-2 text-sm font-semibold text-signal hover:bg-signal hover:text-white"
        >
          + Ajouter une ligne
        </button>
        <button
          onClick={() => save({ pricing: rows })}
          disabled={saving}
          className="rounded-lg bg-signal px-6 py-2 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Exemple : {vehicleLabel("voiture")} · Toutes jantes · 14″→17″ · 15 €/pneu.
      </p>
    </div>
  );
}
