"use client";

import { useState } from "react";
import type { Garage, PartnerEditablePayload } from "@/lib/partner";
import { TabHeader } from "@/components/garage/ui";
import { DAYS } from "@/components/garage/constants";

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

/**
 * Réglages de la prise de rendez-vous — partagés par l'espace partenaire
 * et l'admin.
 *
 * Ces quatre champs existaient en double : en <select> soignés côté
 * partenaire, en champs numériques bruts dans le formulaire admin. Deux
 * définitions du même réglage, donc deux occasions de diverger — c'est
 * déjà ce qui s'était produit avec les horaires.
 *
 * Le délai après livraison relève de la politique du site : le partenaire
 * le lit, l'admin le règle. D'où `canEditLeadDays`.
 */
export function RdvSettings({
  garage,
  save,
  saving,
  canEditLeadDays = false,
}: {
  garage: Garage;
  save: (p: PartnerEditablePayload) => Promise<void>;
  saving: boolean;
  canEditLeadDays?: boolean;
}) {
  const [cfg, setCfg] = useState({
    slot_minutes: garage.slot_minutes ?? 30,
    slot_capacity: garage.slot_capacity ?? 1,
    appointment_lead_days: garage.appointment_lead_days ?? 1,
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
        const { appointment_lead_days, ...partnerFields } = cfg;
        save(
          canEditLeadDays ? { ...partnerFields, appointment_lead_days } : partnerFields,
        );
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

        {/* Réglage du SITE, pas du centre : il engage la promesse faite
            au client dès la fiche produit. Le partenaire le lit, l'admin
            le règle — le backend refuse d'ailleurs ce champ sur
            /partner/garage (403). */}
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-muted">
            Délai après livraison
          </span>
          {canEditLeadDays ? (
            <select
              value={cfg.appointment_lead_days}
              onChange={(e) =>
                setCfg((c) => ({
                  ...c,
                  appointment_lead_days: Number(e.target.value),
                }))
              }
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
            >
              {[1, 2, 3, 5, 7].map((d) => (
                <option key={d} value={d}>
                  J+{d} minimum
                </option>
              ))}
            </select>
          ) : (
            <span className="flex items-center gap-2 rounded-lg border border-line bg-paper-dim px-3 py-2 text-sm text-ink">
              <span className="font-semibold">
                J+{garage.appointment_lead_days ?? 1} minimum
              </span>
              <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-semibold text-ink-muted">
                fixé par tousvospneus.com
              </span>
            </span>
          )}
          <span className="mt-1 block text-xs text-ink-muted">
            Aucun rendez-vous ne peut être pris avant ce délai après la
            livraison estimée des pneus au garage.
            {!canEditLeadDays &&
              " Contactez-nous si votre organisation demande un délai différent."}
          </span>
        </label>
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
    </div>
  );
}
