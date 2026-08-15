"use client";

import { useState } from "react";
import { api, type GarageNearby } from "@/lib/api";
import { formatEuro } from "@/lib/money";

/** Recherche des garages partenaires les plus proches d'un code postal et
 * sélection de l'un d'eux pour le montage. */
export function GaragePicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (g: GarageNearby | null) => void;
}) {
  const [postcode, setPostcode] = useState("");
  const [garages, setGarages] = useState<GarageNearby[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const cp = postcode.trim();
    if (cp.length < 4) {
      setError("Saisissez un code postal valide.");
      return;
    }
    setBusy(true);
    setError(null);
    onSelect(null);
    try {
      const res = await api.nearestGarages(cp);
      setGarages(res);
      if (res.length === 0) {
        setError("Aucun garage partenaire trouvé près de ce code postal.");
      }
    } catch {
      setError("Recherche momentanément indisponible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-line bg-paper p-4">
      {/* Volontairement un <div>, pas un <form> : ce composant est rendu
          à l'intérieur du formulaire de commande (tunnel invité), et un
          formulaire imbriqué est du HTML invalide — le navigateur casse
          alors l'arbre et fait disparaître les champs suivants. */}
      <div className="flex gap-2">
        <input
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Sans ça, Entrée validerait la commande entière.
              e.preventDefault();
              search();
            }
          }}
          inputMode="numeric"
          placeholder="Votre code postal"
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

      {error && <p className="mt-3 text-sm text-signal">{error}</p>}

      {garages && garages.length > 0 && (
        <ul className="mt-3 space-y-2">
          {garages.map((g) => {
            const active = g.id === selectedId;
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => onSelect(active ? null : g)}
                  className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition ${
                    active
                      ? "border-signal bg-signal/5"
                      : "border-line hover:border-signal/50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">
                      {g.name}
                    </span>
                    <span className="block text-sm text-ink-muted">
                      {g.address}, {g.postal_code} {g.city}
                      {g.distance_km != null && ` — à ${g.distance_km} km`}
                    </span>
                    {g.mounting_price_cents > 0 && (
                      <span className="mt-1 block text-xs text-ink-soft">
                        Montage {formatEuro(g.mounting_price_cents / 100)}/pneu
                        {" "}
                        <span className="text-ink-muted">
                          (réglé sur place)
                        </span>
                      </span>
                    )}
                  </span>
                  <span
                    className={`mt-0.5 shrink-0 text-sm font-bold ${
                      active ? "text-signal" : "text-ink-muted"
                    }`}
                  >
                    {active ? "✓ Choisi" : "Choisir"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
