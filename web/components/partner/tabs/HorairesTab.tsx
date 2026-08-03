"use client";

import { useState } from "react";
import type { Garage, GaragePayload } from "@/lib/partner";
import { SaveButton, TabHeader } from "@/components/partner/ui";
import { DAYS } from "@/components/partner/constants";

type DayHours = { open: string; close: string; closed: boolean };

function initDay(h: Record<string, unknown>, key: string): DayHours {
  const d = (h?.[key] as { open?: string; close?: string; closed?: boolean }) || {};
  return {
    open: d.open ?? "",
    close: d.close ?? "",
    closed: d.closed ?? false,
  };
}

export function HorairesTab({
  garage,
  save,
  saving,
}: {
  garage: Garage;
  save: (p: Partial<GaragePayload>) => Promise<void>;
  saving: boolean;
}) {
  const hours = (garage.hours as Record<string, unknown>) || {};
  const [days, setDays] = useState<Record<string, DayHours>>(
    Object.fromEntries(DAYS.map((d) => [d.key, initDay(hours, d.key)])),
  );

  function setDay(key: string, patch: Partial<DayHours>) {
    setDays((p) => ({ ...p, [key]: { ...p[key], ...patch } }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // On ne garde que les jours renseignés / fermés
        const out: Record<string, DayHours> = {};
        for (const d of DAYS) {
          const v = days[d.key];
          if (v.closed || v.open || v.close) out[d.key] = v;
        }
        save({ hours: out });
      }}
      className="max-w-xl"
    >
      <TabHeader title="Horaires d'ouverture" subtitle="Renseignez vos plages d'ouverture par jour." />
      <div className="space-y-2">
        {DAYS.map((d) => {
          const v = days[d.key];
          return (
            <div key={d.key} className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2">
              <span className="w-24 text-sm font-semibold text-ink">{d.label}</span>
              <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={v.closed}
                  onChange={(e) => setDay(d.key, { closed: e.target.checked })}
                  className="accent-signal"
                />
                Fermé
              </label>
              {!v.closed && (
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="time"
                    value={v.open}
                    onChange={(e) => setDay(d.key, { open: e.target.value })}
                    className="rounded-lg border border-line bg-paper px-2 py-1.5 outline-none focus:border-signal"
                  />
                  <span className="text-ink-muted">→</span>
                  <input
                    type="time"
                    value={v.close}
                    onChange={(e) => setDay(d.key, { close: e.target.value })}
                    className="rounded-lg border border-line bg-paper px-2 py-1.5 outline-none focus:border-signal"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-5">
        <SaveButton saving={saving} />
      </div>
    </form>
  );
}
