"use client";

import { useState } from "react";
import type { Garage, GaragePayload } from "@/lib/partner";
import { TabHeader } from "@/components/partner/ui";
import { PAYMENT_METHODS } from "@/components/partner/constants";

export function PaiementTab({
  garage,
  save,
  saving,
}: {
  garage: Garage;
  save: (p: Partial<GaragePayload>) => Promise<void>;
  saving: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(garage.payment_methods ?? []);

  function toggle(key: string) {
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  }

  return (
    <div className="max-w-md">
      <TabHeader
        title="Moyens de paiement acceptés"
        subtitle="Ce que le client peut utiliser pour régler le montage sur place."
      />
      <div className="space-y-2">
        {PAYMENT_METHODS.map((p) => (
          <label
            key={p.key}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-4 py-3 text-sm transition hover:border-signal/50"
          >
            <input
              type="checkbox"
              checked={selected.includes(p.key)}
              onChange={() => toggle(p.key)}
              className="accent-signal"
            />
            <span className="font-semibold text-ink">{p.label}</span>
          </label>
        ))}
      </div>
      <div className="mt-5">
        <button
          onClick={() => save({ payment_methods: selected })}
          disabled={saving}
          className="rounded-lg bg-signal px-6 py-2.5 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
