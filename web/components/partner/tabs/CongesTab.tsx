"use client";

import { useState } from "react";
import type { Garage, GaragePayload, GarageClosure } from "@/lib/partner";
import { SaveButton, TabHeader } from "@/components/partner/ui";

export function CongesTab({
  garage,
  save,
  saving,
}: {
  garage: Garage;
  save: (p: Partial<GaragePayload>) => Promise<void>;
  saving: boolean;
}) {
  const [rows, setRows] = useState<GarageClosure[]>(garage.closures ?? []);
  const [draft, setDraft] = useState<GarageClosure>({ start: "", end: "", label: "" });

  function add() {
    if (!draft.start || !draft.end) return;
    setRows((r) => [...r, { ...draft }]);
    setDraft({ start: "", end: "", label: "" });
  }

  return (
    <div className="max-w-xl">
      <TabHeader
        title="Congés et fermetures"
        subtitle="Indiquez vos périodes de fermeture (congés, jours fériés…)."
      />

      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="rounded-lg border border-line bg-paper-dim p-3 text-sm text-ink-muted">
            Aucune période de fermeture.
          </p>
        )}
        {rows.map((c, i) => (
          <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
            <span className="text-ink">
              Du <strong>{c.start}</strong> au <strong>{c.end}</strong>
              {c.label ? ` — ${c.label}` : ""}
            </span>
            <button
              onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
              className="text-ink-muted hover:text-signal"
              aria-label="Retirer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-paper-dim p-3">
        <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          Du
          <input
            type="date"
            value={draft.start}
            onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
            className="mt-1 block rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-signal"
          />
        </label>
        <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          Au
          <input
            type="date"
            value={draft.end}
            onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
            className="mt-1 block rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-signal"
          />
        </label>
        <label className="flex-1 text-xs font-bold uppercase tracking-wider text-ink-muted">
          Motif
          <input
            type="text"
            value={draft.label ?? ""}
            placeholder="Congés d'été"
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-signal"
          />
        </label>
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-signal px-3 py-2 text-sm font-semibold text-signal hover:bg-signal hover:text-white"
        >
          + Ajouter
        </button>
      </div>

      <div className="mt-5">
        <button
          onClick={() => save({ closures: rows })}
          disabled={saving}
          className="rounded-lg bg-signal px-6 py-2.5 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
