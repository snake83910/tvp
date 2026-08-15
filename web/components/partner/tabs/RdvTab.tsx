"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { Garage, PartnerEditablePayload, PartnerOrder } from "@/lib/partner";
import { TabHeader } from "@/components/partner/ui";
import { AppointmentEditor } from "@/components/partner/AppointmentEditor";
import { SlotBlocks } from "@/components/partner/SlotBlocks";
import { DAYS } from "@/components/partner/constants";

const SLOT_DURATIONS = [15, 20, 30, 45, 60, 90];

type DayCfg = {
  open?: string;
  close?: string;
  closed?: boolean;
  break_start?: string;
  break_end?: string;
};

function minutesOf(hhmm?: string): number | null {
  if (!hhmm || !hhmm.includes(":")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/** Nombre de créneaux offerts un jour donné. Reproduit le découpage du
 *  serveur (`booking.day_slot_starts`) pour donner au partenaire un aperçu
 *  immédiat de sa capacité, sans aller-retour réseau. */
function slotsPerDay(cfg: DayCfg | undefined, step: number, capacity: number): number {
  if (!cfg || cfg.closed) return 0;
  const open = minutesOf(cfg.open);
  const close = minutesOf(cfg.close);
  if (open === null || close === null || close <= open) return 0;
  const bs = minutesOf(cfg.break_start);
  const be = minutesOf(cfg.break_end);
  const ranges: [number, number][] =
    bs !== null && be !== null && open < bs && bs < be && be < close
      ? [
          [open, bs],
          [be, close],
        ]
      : [[open, close]];
  const count = ranges.reduce((n, [a, b]) => n + Math.floor((b - a) / step), 0);
  return count * capacity;
}

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
  const [cfg, setCfg] = useState({
    slot_minutes: garage.slot_minutes ?? 30,
    slot_capacity: garage.slot_capacity ?? 1,
  });

  const hours = (garage.hours ?? {}) as Record<string, DayCfg>;
  const hoursFilled = DAYS.some((d) => {
    const c = hours[d.key];
    return c && !c.closed && c.open && c.close;
  });

  const weekly = DAYS.map((d) => ({
    ...d,
    count: slotsPerDay(hours[d.key], cfg.slot_minutes, cfg.slot_capacity),
  }));
  const weeklyTotal = weekly.reduce((n, d) => n + d.count, 0);

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
      <div>
        <TabHeader
          title="Rendez-vous de montage"
          subtitle="Activez la prise de rendez-vous pour que vos clients réservent leur créneau directement au moment de la commande."
        />

        {/* Activation */}
        <div
          className={`rounded-xl border-2 p-5 transition ${
            garage.appointments_enabled
              ? "border-ok/40 bg-ok/5"
              : "border-line bg-paper"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-bold text-ink">
                Prise de rendez-vous en ligne{" "}
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 align-middle text-xs font-bold ${
                    garage.appointments_enabled
                      ? "bg-ok/15 text-ok"
                      : "bg-paper-dim text-ink-muted"
                  }`}
                >
                  {garage.appointments_enabled ? "Active" : "Inactive"}
                </span>
              </p>
              <p className="mt-1.5 text-sm text-ink-muted">
                {garage.appointments_enabled ? (
                  <>
                    Quand un client vous choisit au moment de la commande, il
                    voit vos créneaux libres et réserve le sien. Le rendez-vous
                    apparaît immédiatement dans votre planning ci-dessous.
                  </>
                ) : (
                  <>
                    Aujourd&apos;hui, les clients vous choisissent sans créneau
                    et le montage se cale par téléphone. En activant la prise de
                    rendez-vous, ils réservent eux-mêmes — moins d&apos;appels,
                    et un planning déjà rempli.
                  </>
                )}
              </p>
            </div>
            <button
              onClick={() =>
                save({ appointments_enabled: !garage.appointments_enabled })
              }
              disabled={saving || (!garage.appointments_enabled && !hoursFilled)}
              className={`shrink-0 rounded-lg px-5 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
                garage.appointments_enabled
                  ? "border border-line text-ink-soft hover:border-signal hover:text-signal"
                  : "bg-signal text-white hover:bg-signal-dark"
              }`}
            >
              {saving
                ? "…"
                : garage.appointments_enabled
                  ? "Désactiver"
                  : "Activer"}
            </button>
          </div>

          {!hoursFilled && (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Renseignez d&apos;abord vos horaires d&apos;ouverture dans
              l&apos;onglet <strong>Horaires</strong> : les créneaux en sont
              directement déduits, sans eux aucun rendez-vous ne peut être
              proposé.
            </p>
          )}
        </div>
      </div>

      {/* Réglages des créneaux */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(cfg);
        }}
      >
        <TabHeader
          title="Réglage des créneaux"
          subtitle="Les créneaux sont générés depuis vos horaires d'ouverture — rien à ressaisir ici."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-muted">
              Durée d&apos;un créneau
            </span>
            <select
              value={cfg.slot_minutes}
              onChange={(e) =>
                setCfg((c) => ({ ...c, slot_minutes: Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
            >
              {SLOT_DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-muted">
              Véhicules en parallèle
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={cfg.slot_capacity}
              onChange={(e) =>
                setCfg((c) => ({
                  ...c,
                  slot_capacity: Math.max(1, Number(e.target.value) || 1),
                }))
              }
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
            />
            <span className="mt-1 block text-xs text-ink-muted">
              Nombre de ponts ou de monteurs disponibles en même temps.
            </span>
          </label>

          {/* Réglage du site, pas du centre : il engage la promesse faite
              au client dès la fiche produit. Affiché ici pour que le
              partenaire sache à quoi s'en tenir, mais non modifiable. */}
          <div>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-muted">
              Délai après livraison
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-paper-dim px-3 py-2 text-sm text-ink">
              <span className="font-semibold">
                J+{garage.appointment_lead_days ?? 1} minimum
              </span>
              <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-semibold text-ink-muted">
                fixé par tousvospneus.com
              </span>
            </div>
            <span className="mt-1 block text-xs text-ink-muted">
              Aucun rendez-vous ne peut être pris avant ce délai après la
              livraison estimée des pneus chez vous. Contactez-nous si votre
              organisation demande un délai différent.
            </span>
          </div>
        </div>

        {/* Aperçu de capacité */}
        <div className="mt-4 rounded-xl border border-line bg-paper p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Capacité hebdomadaire estimée — {weeklyTotal} rendez-vous
          </p>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {weekly.map((d) => (
              <div
                key={d.key}
                className={`rounded-lg border px-1 py-2 ${
                  d.count > 0
                    ? "border-signal/30 bg-signal/5"
                    : "border-line bg-paper-dim"
                }`}
              >
                <p className="text-[11px] font-bold uppercase text-ink-muted">
                  {d.label.slice(0, 3)}
                </p>
                <p
                  className={`font-display text-lg font-black ${
                    d.count > 0 ? "text-ink" : "text-ink-muted"
                  }`}
                >
                  {d.count || "—"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-signal px-6 py-2.5 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-60"
          >
            {saving ? "Enregistrement…" : "Enregistrer les réglages"}
          </button>
        </div>
      </form>

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
