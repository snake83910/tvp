"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type VehicleDimension } from "@/lib/api";

export function SearchHero() {
  const router = useRouter();
  const [tab, setTab] = useState<"plaque" | "dim">("dim");

  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [d, setD] = useState("");

  const [plate, setPlate] = useState("");
  const [plateLoading, setPlateLoading] = useState(false);
  const [plateError, setPlateError] = useState<string | null>(null);
  const [plateDims, setPlateDims] = useState<VehicleDimension[] | null>(null);

  function submitDim(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({
      width: w,
      ratio: h,
      diameter: d,
    });
    router.push(`/recherche?${q.toString()}`);
  }

  async function submitPlate(e: React.FormEvent) {
    e.preventDefault();
    setPlateError(null);
    setPlateDims(null);
    setPlateLoading(true);
    try {
      const dims = await api.searchByPlate(plate.trim());
      if (dims.length === 0) {
        setPlateError("Aucune dimension trouvée pour cette plaque.");
      } else {
        setPlateDims(dims);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Plaque non reconnue.";
      if (msg.includes("403") || msg.includes("indisponible")) {
        setPlateError(
          "La recherche par plaque est temporairement indisponible. Utilisez l'onglet « Dimensions » pour saisir votre taille de pneu."
        );
      } else {
        setPlateError(msg);
      }
    } finally {
      setPlateLoading(false);
    }
  }

  function goToDim(dim: VehicleDimension) {
    const q = new URLSearchParams({
      width: String(dim.width),
      ratio: String(dim.height),
      diameter: String(dim.diameter),
    });
    router.push(`/recherche?${q.toString()}`);
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-paper shadow-card">
      {/* Onglets */}
      <div className="grid grid-cols-2">
        <button
          onClick={() => setTab("plaque")}
          className={`py-4 text-sm font-bold uppercase tracking-wide transition ${
            tab === "plaque"
              ? "bg-paper text-ink"
              : "bg-paper-dim text-ink-muted hover:text-ink"
          }`}
        >
          Par plaque
        </button>
        <button
          onClick={() => setTab("dim")}
          className={`py-4 text-sm font-bold uppercase tracking-wide transition ${
            tab === "dim"
              ? "bg-paper text-ink"
              : "bg-paper-dim text-ink-muted hover:text-ink"
          }`}
        >
          Par dimensions
        </button>
      </div>

      <div className="border-t border-line p-6 md:p-8">
        {tab === "plaque" ? (
          <div>
            <form onSubmit={submitPlate} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Plaque d&apos;immatriculation
                </label>
                <div className="flex overflow-hidden rounded-lg border border-line focus-within:border-signal transition">
                  <span className="flex items-center bg-[#0a3aa6] px-3 text-xs font-bold text-white select-none">
                    F
                  </span>
                  <input
                    type="text"
                    required
                    value={plate}
                    onChange={(e) => {
                      setPlateDims(null);
                      setPlateError(null);
                      setPlate(e.target.value.toUpperCase());
                    }}
                    placeholder="AA-123-AA"
                    maxLength={10}
                    className="flex-1 px-4 py-3 font-mono text-lg uppercase tracking-widest outline-none bg-paper text-ink"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={plateLoading}
                className="rounded-lg bg-signal px-8 py-3 font-display text-base font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark disabled:opacity-50"
              >
                {plateLoading ? "Recherche…" : "Rechercher"}
              </button>
            </form>

            {plateError && (
              <p className="mt-4 rounded-lg border border-signal/40 bg-signal-light px-4 py-3 text-sm text-signal-dark">
                {plateError}
              </p>
            )}

            {plateDims && (
              <div className="mt-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Dimensions trouvées — choisissez la vôtre&nbsp;:
                </p>
                <div className="flex flex-wrap gap-3">
                  {plateDims.map((dim) => {
                    const label = `${dim.width}/${dim.height} R${dim.diameter} ${dim.load_index}${dim.speed_rating}`;
                    return (
                      <button
                        key={label}
                        onClick={() => goToDim(dim)}
                        className="rounded-full border border-signal bg-paper px-5 py-2 text-sm font-bold text-signal transition hover:bg-signal hover:text-white"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <form
            onSubmit={submitDim}
            className="flex flex-col gap-4 md:flex-row md:items-end"
          >
            <Dim label="Largeur" ph="205" value={w} set={setW} />
            <span className="hidden pb-3 text-2xl text-ink-muted md:block">
              /
            </span>
            <Dim label="Hauteur" ph="55" value={h} set={setH} />
            <span className="hidden pb-3 text-2xl text-ink-muted md:block">
              R
            </span>
            <Dim label="Diamètre" ph="16" value={d} set={setD} />
            <button
              type="submit"
              className="rounded-lg bg-signal px-8 py-3 font-display text-base font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark"
            >
              Rechercher
            </button>
          </form>
        )}
        {tab === "dim" && (
          <p className="mt-4 text-center text-xs text-ink-muted md:text-left">
            Exemple : pneu marqué{" "}
            <span className="font-semibold text-ink">205/55 R16</span> →
            largeur 205, hauteur 55, diamètre 16.
          </p>
        )}
      </div>
    </div>
  );
}

function Dim({
  label,
  ph,
  value,
  set,
}: {
  label: string;
  ph: string;
  value: string;
  set: (v: string) => void;
}) {
  return (
    <div className="flex-1">
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      <input
        type="number"
        required
        placeholder={ph}
        value={value}
        onChange={(e) => set(e.target.value)}
        className="h-12 w-full rounded-lg border border-line bg-paper px-3 text-ink outline-none transition focus:border-signal"
      />
    </div>
  );
}
