"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, defaultQty, type GarageNearby, type TyreResult } from "@/lib/api";
import { useLocalValue, writeLocal } from "@/lib/localStore";
import { isPostcode, mountingPriceCents, POSTCODE_KEY } from "@/lib/mounting";
import { formatEuro } from "@/lib/money";

/** « Montez-les chez un partenaire » — sur la fiche produit.
 *
 *  Le montage en garage est l'argument différenciant du site, et il
 *  n'apparaissait qu'à l'étape 2 du tunnel de commande, une fois la
 *  décision d'achat prise. Ici, le client compare encore : lui montrer un
 *  garage à 2 km et le prix posé, c'est lui donner l'information au
 *  moment où elle pèse.
 *
 *  Le code postal saisi est mémorisé et re-servira au checkout. */
export function MountingOffer({ tyre }: { tyre: TyreResult }) {
  const saved = useLocalValue(POSTCODE_KEY);
  const [input, setInput] = useState("");
  const [garages, setGarages] = useState<GarageNearby[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!saved || !isPostcode(saved)) return;
    let cancelled = false;
    api
      .nearestGarages(saved, 3)
      .then((r) => !cancelled && setGarages(r))
      .catch(() => !cancelled && setGarages([]));
    return () => {
      cancelled = true;
    };
  }, [saved]);

  async function search() {
    const cp = input.trim();
    if (!isPostcode(cp)) {
      setError("Saisissez un code postal à 5 chiffres.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.nearestGarages(cp, 3);
      setGarages(res);
      // Mémorisé seulement après une recherche réussie : inutile de
      // traîner un code postal qui ne donne rien.
      writeLocal(POSTCODE_KEY, cp);
    } catch {
      setError("Recherche momentanément indisponible.");
    } finally {
      setBusy(false);
    }
  }

  const qty = defaultQty(tyre.category);
  const list = garages ?? [];
  const nearest = list[0] ?? null;
  const unitMounting = nearest
    ? mountingPriceCents(nearest, tyre.diameter, tyre.category)
    : null;
  const tyresTotal = tyre.display_price * qty;
  const fittedTotal =
    unitMounting != null ? tyresTotal + (unitMounting * qty) / 100 : null;

  return (
    <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
      <p className="mb-1 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
        Montage en garage partenaire
      </p>
      <p className="text-sm text-ink-soft">
        Faites-vous livrer directement chez un garage près de chez vous — il
        les monte, vous ne manipulez rien.
      </p>

      {!nearest && (
        <div className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
            }}
            inputMode="numeric"
            maxLength={5}
            placeholder="Votre code postal"
            aria-label="Votre code postal"
            className="h-11 flex-1 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-signal"
          />
          <button
            type="button"
            onClick={search}
            disabled={busy}
            className="rounded-lg bg-ink px-5 text-sm font-bold text-paper transition hover:bg-signal disabled:opacity-60"
          >
            {busy ? "…" : "Chercher"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm font-semibold text-signal">{error}</p>}

      {garages !== null && garages.length === 0 && (
        <p className="mt-3 text-sm text-ink-muted">
          Aucun garage partenaire près de ce code postal pour l&apos;instant.
          La livraison à domicile reste disponible.
        </p>
      )}

      {nearest && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-line bg-paper-dim p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link
                href={`/garages/${nearest.slug}`}
                className="font-semibold text-ink hover:text-signal"
              >
                {nearest.name}
              </Link>
              {nearest.distance_km != null && (
                <span className="text-sm text-ink-muted">
                  à {nearest.distance_km} km
                </span>
              )}
            </div>
            <p className="text-sm text-ink-soft">
              {nearest.postal_code} {nearest.city}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {unitMounting != null && (
                <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink-soft">
                  Montage {formatEuro(unitMounting / 100)}/pneu
                </span>
              )}
              {nearest.appointments_enabled && (
                <span className="rounded-full bg-ok/10 px-3 py-1 text-xs font-semibold text-ok">
                  Rendez-vous en ligne
                </span>
              )}
            </div>
          </div>

          {/* Prix posé : le client voit d'emblée ce que lui coûte vraiment
              l'opération, plutôt que de découvrir le montage sur place. */}
          {fittedTotal != null && (
            <div className="rounded-xl border border-line p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Estimation pour {qty} pneu{qty > 1 ? "x" : ""} posé
                {qty > 1 ? "s" : ""}
              </p>
              <p className="mt-1 font-display text-2xl font-black text-ink">
                {formatEuro(fittedTotal)}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {formatEuro(tyresTotal)} de pneus{" "}
                {tyre.display_mode === "HT" ? "HT" : "TTC"} +{" "}
                {formatEuro((unitMounting! * qty) / 100)} de montage réglés
                directement au garage. Livraison offerte dès 2 pneus.
              </p>
            </div>
          )}

          {list.length > 1 && (
            <p className="text-xs text-ink-muted">
              {list.length - 1} autre{list.length > 2 ? "s" : ""} garage
              {list.length > 2 ? "s" : ""} partenaire
              {list.length > 2 ? "s" : ""} à proximité — vous choisirez au
              moment de la commande.
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              writeLocal(POSTCODE_KEY, null);
              setGarages(null);
              setInput("");
            }}
            className="text-xs font-semibold text-ink-muted underline hover:text-signal"
          >
            Changer de code postal
          </button>
        </div>
      )}
    </div>
  );
}
