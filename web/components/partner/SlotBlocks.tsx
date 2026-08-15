"use client";

import { useEffect, useState } from "react";
import { partnerApi, type SlotBlock } from "@/lib/partner";
import { TabHeader } from "@/components/partner/ui";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Date du jour au format attendu par <input type="date">. Lue à
 *  l'ouverture du formulaire (événement), jamais pendant le rendu. */
function todayValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const day = s.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const hm = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  // Blocage à cheval sur deux jours : on affiche les deux dates.
  if (s.toDateString() !== e.toDateString()) {
    return `${day} ${hm(s)} → ${e.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
    })} ${hm(e)}`;
  }
  return `${day}, ${hm(s)} → ${hm(e)}`;
}

/** Plages rendues indisponibles à la réservation en ligne.
 *
 *  Répond au cas le plus courant du terrain : un rendez-vous pris par
 *  téléphone. Sans ce garde-fou, le créneau reste réservable sur le site
 *  et deux véhicules se présentent pour un seul pont. */
export function SlotBlocks() {
  const [rows, setRows] = useState<SlotBlock[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    date: "",
    from: "09:00",
    to: "10:00",
    reason: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    partnerApi
      .listSlotBlocks()
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, []);

  async function add() {
    const day = draft.date || todayValue();
    if (draft.to <= draft.from) {
      setError("L'heure de fin doit être après celle de début.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await partnerApi.addSlotBlock(
        `${day}T${draft.from}:00`,
        `${day}T${draft.to}:00`,
        draft.reason.trim() || null,
      );
      setRows((r) =>
        [...(r ?? []), created].sort((a, b) =>
          a.starts_at < b.starts_at ? -1 : 1,
        ),
      );
      setDraft((d) => ({ ...d, reason: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setRows((r) => (r ?? []).filter((b) => b.id !== id));
    try {
      await partnerApi.removeSlotBlock(id);
    } catch {
      // Suppression refusée : on recharge pour ne pas mentir à l'écran.
      partnerApi.listSlotBlocks().then(setRows).catch(() => {});
    }
  }

  return (
    <div>
      <TabHeader
        title="Créneaux bloqués"
        subtitle="Rendez indisponible une plage horaire : rendez-vous pris par téléphone, pont immobilisé, livraison à réceptionner…"
      />

      <div className="space-y-2">
        {rows === null ? (
          <p className="text-sm text-ink-muted">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-line bg-paper-dim p-3 text-sm text-ink-muted">
            Aucune plage bloquée à venir.
          </p>
        ) : (
          rows.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm"
            >
              <span className="text-ink">
                <strong>{formatRange(b.starts_at, b.ends_at)}</strong>
                {b.reason ? ` — ${b.reason}` : ""}
              </span>
              <button
                onClick={() => remove(b.id)}
                className="text-ink-muted hover:text-signal"
                aria-label="Débloquer"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-paper-dim p-3">
        <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          Jour
          <input
            type="date"
            value={draft.date}
            onFocus={() =>
              setDraft((d) => (d.date ? d : { ...d, date: todayValue() }))
            }
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            className="mt-1 block rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-signal"
          />
        </label>
        <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          De
          <input
            type="time"
            value={draft.from}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            className="mt-1 block rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-signal"
          />
        </label>
        <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          À
          <input
            type="time"
            value={draft.to}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            className="mt-1 block rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-signal"
          />
        </label>
        <label className="min-w-[140px] flex-1 text-xs font-bold uppercase tracking-wider text-ink-muted">
          Motif
          <input
            type="text"
            value={draft.reason}
            placeholder="RDV par téléphone"
            onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-signal"
          />
        </label>
        <button
          type="button"
          onClick={add}
          disabled={busy || !draft.date}
          className="rounded-lg border border-signal px-3 py-2 text-sm font-semibold text-signal transition hover:bg-signal hover:text-white disabled:opacity-50"
        >
          {busy ? "…" : "+ Bloquer"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm font-semibold text-signal">{error}</p>}

      <p className="mt-2 text-xs text-ink-muted">
        Bloquer une plage n&apos;annule pas les rendez-vous déjà pris
        dessus : déplacez-les depuis votre planning, le client sera prévenu.
      </p>
    </div>
  );
}
