"use client";

import { useState } from "react";
import { partnerApi, type PartnerOrder } from "@/lib/partner";

/** ISO -> valeur pour <input type="datetime-local"> (YYYY-MM-DDTHH:mm). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Fixe, déplace ou annule le rendez-vous de montage d'une commande.
 *
 *  Partagé par l'onglet Commandes et le planning RDV : les deux écrans
 *  agissent sur la même donnée, et deux formulaires divergents finiraient
 *  par ne plus se comporter pareil. */
export function AppointmentEditor({
  order,
  onUpdate,
  compact,
}: {
  order: PartnerOrder;
  onUpdate: (o: PartnerOrder) => void;
  compact?: boolean;
}) {
  const [when, setWhen] = useState(toLocalInput(order.mounting_at));
  const [note, setNote] = useState(order.mounting_note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Corriger la seule note, sans toucher à la date, doit rester possible.
  const changed =
    when !== toLocalInput(order.mounting_at) || note !== (order.mounting_note ?? "");

  async function save(cancel = false) {
    setSaving(true);
    setError(null);
    try {
      const updated = await partnerApi.setAppointment(
        order.order_number,
        cancel ? null : when || null,
        cancel ? null : note || null,
      );
      onUpdate(updated);
      if (cancel) {
        setWhen("");
        setNote("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="rounded-lg border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-signal"
        />
        {!compact && (
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optionnel)"
            className="min-w-[140px] flex-1 rounded-lg border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-signal"
          />
        )}
        <button
          onClick={() => save(false)}
          disabled={saving || !when || !changed}
          className="rounded-lg bg-signal px-4 py-1.5 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-50"
        >
          {saving ? "…" : order.mounting_at ? "Déplacer" : "Enregistrer le RDV"}
        </button>
        {order.mounting_at && (
          <button
            onClick={() => save(true)}
            disabled={saving}
            className="text-xs font-semibold text-ink-muted underline hover:text-signal"
          >
            Annuler le RDV
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-signal">{error}</p>}
    </div>
  );
}
