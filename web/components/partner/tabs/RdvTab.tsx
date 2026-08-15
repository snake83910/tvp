"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { Garage, PartnerEditablePayload, PartnerOrder } from "@/lib/partner";
import { TabHeader } from "@/components/garage/ui";
import { AppointmentEditor } from "@/components/partner/AppointmentEditor";
import { SlotBlocks } from "@/components/partner/SlotBlocks";
import { RdvSettings } from "@/components/garage/RdvSettings";

/** L'heure courante, arrondie à la minute, comme source externe.
 *
 *  Lire `Date.now()` pendant le rendu rend le composant non idempotent
 *  (deux rendus identiques donneraient des résultats différents). En
 *  passant par un abonnement, la frontière « à venir / passé » est une
 *  valeur stable, et le planning bascule tout seul quand un créneau vient
 *  de s'écouler — sans rechargement de page.
 */
function subscribeToMinute(onChange: () => void): () => void {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}
const currentMinute = () => Math.floor(Date.now() / 60_000) * 60_000;
// SSR / premier rendu serveur : 0 place tout dans « à venir ».
const serverMinute = () => 0;

function useNow(): number {
  return useSyncExternalStore(subscribeToMinute, currentMinute, serverMinute);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayLabel(d: Date, now: number): string {
  const today = startOfDay(new Date(now));
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function RdvTab({
  garage,
  orders,
  onOrderUpdate,
  save,
  saving,
}: {
  garage: Garage;
  orders: PartnerOrder[];
  onOrderUpdate: (o: PartnerOrder) => void;
  save: (p: PartnerEditablePayload) => Promise<void>;
  saving: boolean;
}) {
  const now = useNow();

  /** RDV à venir, groupés par jour. */
  const upcoming = useMemo(() => {
    const withRdv = orders
      .filter((o) => o.mounting_at && new Date(o.mounting_at).getTime() >= now)
      .sort((a, b) => (a.mounting_at! < b.mounting_at! ? -1 : 1));
    const groups = new Map<string, { date: Date; items: PartnerOrder[] }>();
    for (const o of withRdv) {
      const d = new Date(o.mounting_at!);
      const key = startOfDay(d).toISOString();
      if (!groups.has(key)) groups.set(key, { date: d, items: [] });
      groups.get(key)!.items.push(o);
    }
    return [...groups.values()];
  }, [orders, now]);

  const past = useMemo(
    () =>
      orders
        .filter((o) => o.mounting_at && new Date(o.mounting_at).getTime() < now)
        .sort((a, b) => (a.mounting_at! < b.mounting_at! ? 1 : -1))
        .slice(0, 10),
    [orders, now],
  );

  const unscheduled = useMemo(
    () => orders.filter((o) => !o.mounting_at && o.status !== "delivered"),
    [orders],
  );

  const todayCount =
    upcoming[0] &&
    startOfDay(upcoming[0].date).getTime() === startOfDay(new Date(now)).getTime()
      ? upcoming[0].items.length
      : 0;

  return (
    <div className="space-y-8">
      <RdvSettings garage={garage} save={save} saving={saving} />

      {garage.appointments_enabled && <SlotBlocks />}

      {/* Planning */}
      <div>
        <TabHeader title="Planning" subtitle="Vos montages programmés." />

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Aujourd'hui" value={todayCount} />
          <Stat
            label="À venir"
            value={upcoming.reduce((n, g) => n + g.items.length, 0)}
          />
          <Stat label="Sans RDV" value={unscheduled.length} tone={unscheduled.length > 0 ? "warn" : undefined} />
        </div>

        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-line bg-paper p-6 text-ink-muted">
            Aucun rendez-vous à venir.
          </p>
        ) : (
          <div className="space-y-5">
            {upcoming.map((g) => (
              <div key={g.date.toISOString()}>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-signal">
                  {dayLabel(g.date, now)} · {g.items.length} RDV
                </h4>
                <div className="space-y-2">
                  {g.items.map((o) => (
                    <RdvCard key={o.order_number} order={o} onUpdate={onOrderUpdate} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Commandes sans rendez-vous */}
      {unscheduled.length > 0 && (
        <div>
          <TabHeader
            title="À planifier"
            subtitle="Ces commandes vous sont rattachées mais n'ont pas encore de créneau."
          />
          <div className="space-y-2">
            {unscheduled.map((o) => (
              <RdvCard key={o.order_number} order={o} onUpdate={onOrderUpdate} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <TabHeader title="Historique" subtitle="Les 10 derniers montages passés." />
          <div className="space-y-2 opacity-60">
            {past.map((o) => (
              <RdvCard key={o.order_number} order={o} onUpdate={onOrderUpdate} readOnly />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn";
}) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-2xl font-black ${
          tone === "warn" ? "text-signal" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RdvCard({
  order: o,
  onUpdate,
  readOnly,
}: {
  order: PartnerOrder;
  onUpdate: (o: PartnerOrder) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const time = o.mounting_at
    ? new Date(o.mounting_at).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="rounded-lg border border-line bg-paper p-3">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <span className="w-14 shrink-0 font-display text-lg font-black text-ink">
          {time ?? "—"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {o.customer_name ?? "Client"}
            {o.customer_phone && (
              <a
                href={`tel:${o.customer_phone.replace(/\s/g, "")}`}
                className="ml-2 font-normal text-signal hover:underline"
              >
                {o.customer_phone}
              </a>
            )}
          </p>
          <p className="text-sm text-ink-soft">
            {o.items.map((it) => `${it.quantity}× ${it.label}`).join(", ")}
          </p>
          <p className="text-xs text-ink-muted">
            <span className="font-mono">{o.order_number}</span>
            {o.mounting_note ? ` · ${o.mounting_note}` : ""}
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 text-xs font-semibold text-ink-muted underline hover:text-signal"
          >
            {open ? "Fermer" : o.mounting_at ? "Déplacer / annuler" : "Fixer un RDV"}
          </button>
        )}
      </div>

      {open && !readOnly && (
        <div className="mt-3 border-t border-line pt-3">
          <AppointmentEditor order={o} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}
