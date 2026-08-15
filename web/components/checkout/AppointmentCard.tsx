"use client";

import { useState } from "react";
import { MountingSlotPicker } from "@/components/checkout/MountingSlotPicker";
import { accountApi, type OrderDetail } from "@/lib/auth";
import { ErrorCode, errorCode, errorMessage } from "@/lib/errors";

/** Statuts pendant lesquels le client peut encore bouger son créneau.
 *  Une fois la commande livrée, le montage a eu lieu — le backend refuse
 *  d'ailleurs la modification, on n'affiche donc pas les boutons. */
const EDITABLE = new Set(["paid", "sent_to_supplier", "shipped"]);

function formatAppointment(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Bloc « Montage » de la page commande : garage, créneau réservé, et de
 *  quoi le déplacer ou l'annuler sans passer un coup de fil. */
export function AppointmentCard({
  order,
  onChange,
}: {
  order: OrderDetail;
  onChange: (o: OrderDetail) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Incrémenté pour remonter le sélecteur et donc relire les créneaux.
  const [reloadKey, setReloadKey] = useState(0);

  const garage = order.garage ?? {};
  const editable = EDITABLE.has(order.status);

  async function apply(mountingAt: string | null) {
    setBusy(true);
    setError(null);
    try {
      onChange(await accountApi.setOrderAppointment(order.order_number, mountingAt));
      setEditing(false);
      setSlot(null);
    } catch (e) {
      setError(errorMessage(e, "Modification impossible"));
      // Le créneau visé vient d'être pris, ou n'est plus proposé (le
      // garage a changé ses horaires entre-temps) : afficher le message
      // sans rafraîchir laisserait le client recliquer sur une case morte.
      if (
        errorCode(e) === ErrorCode.slotTaken ||
        errorCode(e) === ErrorCode.slotNotOffered
      ) {
        setSlot(null);
        setReloadKey((k) => k + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
        Montage
      </p>

      {garage.name && (
        <p className="text-sm font-semibold text-ink">{garage.name}</p>
      )}
      {(garage.address || garage.city) && (
        <p className="mt-1 text-sm text-ink-soft">
          {garage.address}
          <br />
          {garage.postal_code} {garage.city}
        </p>
      )}
      {garage.phone && (
        <p className="mt-1 text-sm text-ink-soft">
          Tél. :{" "}
          <a
            href={`tel:${garage.phone.replace(/\s/g, "")}`}
            className="text-signal hover:underline"
          >
            {garage.phone}
          </a>
        </p>
      )}

      {order.mounting_at ? (
        <p className="mt-3 rounded-lg bg-ok/10 px-3 py-2 text-sm font-semibold text-ok">
          Rendez-vous le {formatAppointment(order.mounting_at)}
          {order.mounting_note ? ` — ${order.mounting_note}` : ""}
        </p>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">
          Aucun rendez-vous fixé pour l&apos;instant.
          {editable
            ? " Choisissez votre créneau ci-dessous."
            : " Le garage vous contactera dès réception de vos pneus."}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-signal/40 bg-signal-light px-3 py-2 text-sm text-signal">
          {error}
        </p>
      )}

      {editable && (
        <>
          {editing ? (
            <>
              <MountingSlotPicker
                key={`${order.order_number}-${reloadKey}`}
                orderNumber={order.order_number}
                value={slot}
                onChange={setSlot}
                title="Choisissez un nouveau créneau"
                optionalHint={false}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => apply(slot)}
                  disabled={busy || !slot}
                  className="rounded-full bg-signal px-5 py-2 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-50"
                >
                  {busy ? "…" : "Confirmer ce créneau"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setSlot(null);
                    setError(null);
                  }}
                  disabled={busy}
                  className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal"
                >
                  Annuler
                </button>
              </div>
            </>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setEditing(true)}
                className="rounded-full bg-ink px-5 py-2 text-sm font-bold text-paper transition hover:bg-signal"
              >
                {order.mounting_at
                  ? "Déplacer mon rendez-vous"
                  : "Prendre rendez-vous"}
              </button>
              {order.mounting_at && (
                <button
                  onClick={() => apply(null)}
                  disabled={busy}
                  className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal disabled:opacity-50"
                >
                  Annuler le rendez-vous
                </button>
              )}
            </div>
          )}
        </>
      )}

      <p className="mt-3 text-xs text-ink-muted">
        La prestation de montage est réglée directement au garage.
      </p>
    </div>
  );
}
