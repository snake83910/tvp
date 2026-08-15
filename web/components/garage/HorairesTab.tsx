"use client";

import { useState } from "react";
import type { Garage, PartnerEditablePayload } from "@/lib/partner";
import { SaveButton, TabHeader } from "@/components/garage/ui";
import { DAYS } from "@/components/garage/constants";

type DayHours = {
  open: string;
  close: string;
  closed: boolean;
  break_start: string;
  break_end: string;
};

function initDay(h: Record<string, unknown>, key: string): DayHours {
  const d =
    (h?.[key] as {
      open?: string;
      close?: string;
      closed?: boolean;
      break_start?: string;
      break_end?: string;
    }) || {};
  return {
    open: d.open ?? "",
    close: d.close ?? "",
    closed: d.closed ?? false,
    break_start: d.break_start ?? "",
    break_end: d.break_end ?? "",
  };
}

export function HorairesTab({
  garage,
  save,
  saving,
}: {
  garage: Garage;
  save: (p: PartnerEditablePayload) => Promise<void>;
  saving: boolean;
}) {
  const hours = (garage.hours as Record<string, unknown>) || {};
  const [days, setDays] = useState<Record<string, DayHours>>(
    Object.fromEntries(DAYS.map((d) => [d.key, initDay(hours, d.key)])),
  );

  function setDay(key: string, patch: Partial<DayHours>) {
    setDays((p) => ({ ...p, [key]: { ...p[key], ...patch } }));
  }

  /** Recopie le premier jour ouvré renseigné sur tous les autres :
   *  la plupart des centres ont le même horaire du lundi au vendredi. */
  function applyToWeekdays() {
    const src = DAYS.map((d) => days[d.key]).find((v) => !v.closed && v.open && v.close);
    if (!src) return;
    setDays((p) => {
      const next = { ...p };
      for (const d of DAYS.slice(0, 5)) next[d.key] = { ...src };
      return next;
    });
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
      className="max-w-2xl"
    >
      <TabHeader
        title="Horaires d'ouverture"
        subtitle="Renseignez vos plages d'ouverture par jour. Si la prise de rendez-vous en ligne est active, les créneaux proposés aux clients en découlent directement."
      />

      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={applyToWeekdays}
          className="text-sm font-semibold text-signal hover:underline"
        >
          Appliquer au lundi–vendredi
        </button>
      </div>

      <div className="space-y-2">
        {DAYS.map((d) => {
          const v = days[d.key];
          const invalid = !v.closed && v.open && v.close && v.close <= v.open;
          return (
            <div
              key={d.key}
              className="rounded-lg border border-line px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-3">
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

              {/* Pause déjeuner : sans elle, un garage rideau baissé se
                  verrait proposer des rendez-vous à 12h30. */}
              {!v.closed && (
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-24 text-xs text-ink-muted">
                  <span>Pause</span>
                  <input
                    type="time"
                    value={v.break_start}
                    onChange={(e) => setDay(d.key, { break_start: e.target.value })}
                    className="rounded-lg border border-line bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-signal"
                  />
                  <span>→</span>
                  <input
                    type="time"
                    value={v.break_end}
                    onChange={(e) => setDay(d.key, { break_end: e.target.value })}
                    className="rounded-lg border border-line bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-signal"
                  />
                  {(v.break_start || v.break_end) && (
                    <button
                      type="button"
                      onClick={() => setDay(d.key, { break_start: "", break_end: "" })}
                      className="hover:text-signal"
                    >
                      retirer
                    </button>
                  )}
                </div>
              )}

              {invalid && (
                <p className="mt-1 pl-24 text-xs font-semibold text-signal">
                  L&apos;heure de fermeture doit être après l&apos;ouverture.
                </p>
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
