"use client";

import { useEffect, useState } from "react";
import { cartApi, type MountingSlots } from "@/lib/cart";
import { accountApi } from "@/lib/auth";

function formatDay(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatLongDay(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Choix du créneau de montage chez le garage partenaire.
 *
 *  La liste des jours et la date au plus tôt viennent du serveur : elles
 *  dépendent de la livraison estimée, que le client ne doit pas pouvoir
 *  contourner. Le composant affiche, il ne calcule pas.
 *
 *  Deux sources selon le contexte : le panier au checkout, la commande
 *  quand le client redéplace son rendez-vous. D'où `garageId` (checkout)
 *  ou `orderNumber` (après commande) — l'un ou l'autre.
 *
 *  Le parent le remonte via `key=…` quand la source change : l'état
 *  repart de zéro sans réinitialisation manuelle. */
export function MountingSlotPicker({
  garageId,
  orderNumber,
  value,
  onChange,
  title = "Prenez rendez-vous pour le montage",
  optionalHint = true,
}: {
  garageId?: string;
  orderNumber?: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  title?: string;
  optionalHint?: boolean;
}) {
  const [data, setData] = useState<MountingSlots | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = orderNumber
      ? accountApi.orderSlots(orderNumber)
      : cartApi.mountingSlots(garageId!);
    load
      .then((res) => {
        if (cancelled) return;
        setData(res);
        // Ouvre le premier jour qui a réellement un créneau libre : sinon
        // le client tombe sur une journée vide et croit qu'il n'y a rien.
        const first =
          res.days.find((d) => d.slots.some((s) => s.available)) ?? res.days[0];
        setActiveDay(first?.date ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("Créneaux momentanément indisponibles.");
      });
    return () => {
      cancelled = true;
    };
  }, [garageId, orderNumber]);

  if (error) {
    return (
      <p className="mt-3 rounded-lg border border-line bg-paper p-4 text-sm text-ink-muted">
        {error} Le garage vous contactera pour convenir d&apos;un rendez-vous.
      </p>
    );
  }

  if (!data) {
    return (
      <p className="mt-3 rounded-lg border border-line bg-paper p-4 text-sm text-ink-muted">
        Chargement des créneaux…
      </p>
    );
  }

  const day = data.days.find((d) => d.date === activeDay) ?? data.days[0];
  const hasAny = data.days.some((d) => d.slots.some((s) => s.available));

  return (
    <div className="mt-3 rounded-lg border border-line bg-paper p-4">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">
        {data.delivery_estimate ? (
          <>
            Vos pneus sont estimés livrés au garage le{" "}
            <strong className="text-ink-soft">
              {formatLongDay(data.delivery_estimate)}
            </strong>
            . Le premier rendez-vous possible est donc le{" "}
            <strong className="text-ink-soft">
              {formatLongDay(data.earliest_date)}
            </strong>
            .
          </>
        ) : (
          <>
            Premier rendez-vous possible le{" "}
            <strong className="text-ink-soft">
              {formatLongDay(data.earliest_date)}
            </strong>
            , le temps que vos pneus arrivent au garage.
          </>
        )}
      </p>

      {!hasAny ? (
        <p className="mt-3 rounded-lg bg-paper-dim px-3 py-2 text-sm text-ink-muted">
          Aucun créneau libre sur les prochaines semaines. Vous pouvez
          commander sans rendez-vous : le garage vous contactera.
        </p>
      ) : (
        <>
          {/* Jours */}
          <div className="mt-4 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {data.days.map((d) => {
              const free = d.slots.filter((s) => s.available).length;
              const isActive = d.date === day?.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setActiveDay(d.date)}
                  disabled={free === 0}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-center text-xs transition disabled:opacity-40 ${
                    isActive
                      ? "border-signal bg-signal/5 text-ink"
                      : "border-line text-ink-soft hover:border-signal/50"
                  }`}
                >
                  <span className="block font-semibold capitalize">
                    {formatDay(d.date)}
                  </span>
                  <span className="block text-ink-muted">
                    {d.closure_label
                      ? d.closure_label
                      : free > 0
                        ? `${free} libre${free > 1 ? "s" : ""}`
                        : "fermé"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Créneaux du jour */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(day?.slots ?? []).length === 0 ? (
              <p className="text-sm text-ink-muted">
                {day?.closure_label ?? "Fermé ce jour-là."}
              </p>
            ) : (
              day!.slots.map((s) => {
                const selected = value === s.start;
                return (
                  <button
                    key={s.start}
                    type="button"
                    disabled={!s.available}
                    onClick={() => onChange(selected ? null : s.start)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                      selected
                        ? "border-signal bg-signal text-white"
                        : s.available
                          ? "border-line text-ink-soft hover:border-signal hover:text-signal"
                          : "cursor-not-allowed border-line text-ink-muted line-through opacity-50"
                    }`}
                  >
                    {formatHour(s.start)}
                  </button>
                );
              })
            )}
          </div>

          {(value || optionalHint) && (
            <p className="mt-3 text-xs text-ink-muted">
              {value ? (
                <span className="font-semibold text-ok">
                  ✓ Rendez-vous du {formatLongDay(value.slice(0, 10))} à{" "}
                  {formatHour(value)}
                  {optionalHint ? " — confirmé à la validation de la commande." : ""}
                </span>
              ) : (
                <>
                  Le rendez-vous est facultatif : sans créneau choisi, le garage
                  vous contactera pour convenir d&apos;une date.
                </>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
