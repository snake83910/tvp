"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  api,
  VEHICLE_CATEGORIES,
  type VehicleCategory,
  type VehicleDimension,
} from "@/lib/api";

// Valeurs standard du marché PAR FAMILLE de véhicule : un <select>
// élimine les fautes de frappe (« 2055 »), les recherches vides, et
// donne une roue native sur mobile.
const range = (from: number, to: number, step: number) =>
  Array.from(
    { length: Math.floor((to - from) / step) + 1 },
    (_, i) => from + i * step,
  );

const DIMS: Record<
  VehicleCategory,
  {
    widths: number[];
    ratios: number[];
    diameters: number[];
    ph: [string, string, string]; // placeholders (exemple réaliste)
  }
> = {
  auto: {
    widths: range(125, 355, 10),
    ratios: range(25, 85, 5),
    diameters: range(12, 24, 1),
    ph: ["205", "55", "16"],
  },
  moto: {
    widths: [
      80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200,
      210, 240, 250, 260, 300, 330,
    ],
    ratios: [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100],
    diameters: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21],
    ph: ["120", "70", "17"],
  },
  quad: {
    widths: [165, 175, 195, 205, 225, 255, 270],
    ratios: [40, 50, 55, 60, 70, 80, 100],
    diameters: [8, 9, 10, 11, 12, 14],
    ph: ["205", "80", "12"],
  },
  camion: {
    widths: [
      205, 215, 225, 235, 245, 255, 265, 275, 285, 295, 305, 315,
      355, 385, 425, 445,
    ],
    ratios: [45, 50, 55, 60, 65, 70, 75, 80],
    diameters: [17.5, 19.5, 22.5],
    ph: ["315", "70", "22.5"],
  },
  agricole: {
    widths: [
      200, 230, 250, 260, 270, 280, 300, 320, 340, 360, 380, 400,
      420, 440, 460, 480, 500, 520, 540, 560, 580, 600, 620, 650,
      680, 710, 750, 800, 900, 1000, 1050,
    ],
    ratios: [50, 55, 60, 65, 70, 75, 80, 85, 90, 95],
    diameters: [
      16, 18, 20, 22, 24, 25, 26, 28, 30, 32, 34, 36, 38, 42, 46, 50,
    ],
    ph: ["420", "70", "24"],
  },
};

const CATEGORY_ICONS: Record<VehicleCategory, string> = {
  auto: "🚗",
  moto: "🏍️",
  quad: "🛞",
  camion: "🚚",
  agricole: "🚜",
};

const LAST_DIM_KEY = "tvp_last_dim";

type LastDim = { w: string; h: string; d: string; cat?: VehicleCategory };

function readLastDim(): LastDim | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_DIM_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as LastDim;
    return v.w && v.h && v.d ? v : null;
  } catch {
    return null;
  }
}

function saveLastDim(dim: LastDim) {
  try {
    localStorage.setItem(LAST_DIM_KEY, JSON.stringify(dim));
  } catch {
    /* stockage plein / bloqué : non bloquant */
  }
}

export function SearchHero({
  initialCategory = "auto",
}: {
  initialCategory?: VehicleCategory;
}) {
  const router = useRouter();
  const [cat, setCat] = useState<VehicleCategory>(initialCategory);
  const [tab, setTab] = useState<"plaque" | "dim">("dim");

  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [d, setD] = useState("");
  const [lastDim, setLastDim] = useState<LastDim | null>(null);

  const [plate, setPlate] = useState("");
  const [plateLoading, setPlateLoading] = useState(false);
  const [plateError, setPlateError] = useState<string | null>(null);
  const [plateDims, setPlateDims] = useState<VehicleDimension[] | null>(null);

  // Un client revient tous les 2-3 ans (ou compare sur plusieurs jours) :
  // on pré-remplit sa dernière dimension pour lui éviter la re-saisie.
  useEffect(() => {
    const last = readLastDim();
    if (last) {
      setLastDim(last);
      if ((last.cat ?? "auto") === initialCategory) {
        setW((prev) => prev || last.w);
        setH((prev) => prev || last.h);
        setD((prev) => prev || last.d);
      }
    }
  }, [initialCategory]);

  function switchCategory(next: VehicleCategory) {
    if (next === cat) return;
    setCat(next);
    // Les valeurs de l'ancienne famille n'existent pas forcément dans
    // la nouvelle (ex. 22.5 n'existe qu'en camion) : on repart à vide.
    setW("");
    setH("");
    setD("");
    // La recherche par plaque est un service AUTO uniquement
    if (next !== "auto" && tab === "plaque") setTab("dim");
  }

  function goSearch(
    width: string,
    ratio: string,
    diameter: string,
    category: VehicleCategory = cat,
  ) {
    saveLastDim({ w: width, h: ratio, d: diameter, cat: category });
    const q = new URLSearchParams({ width, ratio, diameter });
    if (category !== "auto") q.set("category", category);
    router.push(`/recherche?${q.toString()}`);
  }

  function submitDim(e: React.FormEvent) {
    e.preventDefault();
    if (w && h && d) goSearch(w, h, d);
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
      if (msg.includes("non configurée") || msg.includes("non configur")) {
        setPlateError(
          "La recherche par plaque n'est pas encore disponible. Utilisez l'onglet « Dimensions » pour saisir votre taille de pneu."
        );
      } else if (msg.includes("indisponible") || msg.includes("503") || msg.includes("502")) {
        setPlateError(
          "Service momentanément indisponible. Utilisez l'onglet « Dimensions » pour saisir votre taille de pneu."
        );
      } else {
        setPlateError(msg);
      }
    } finally {
      setPlateLoading(false);
    }
  }

  function goToDim(dim: VehicleDimension) {
    goSearch(
      String(dim.width),
      String(dim.height),
      String(dim.diameter),
      "auto",
    );
  }

  const dims = DIMS[cat];

  return (
    <div className="overflow-hidden rounded-2xl bg-paper shadow-card">
      {/* Familles de véhicules */}
      <div
        className="flex overflow-x-auto border-b border-line bg-paper-dim"
        role="tablist"
        aria-label="Type de véhicule"
      >
        {VEHICLE_CATEGORIES.map((c) => (
          <button
            key={c.value}
            role="tab"
            aria-selected={cat === c.value}
            onClick={() => switchCategory(c.value)}
            className={`flex min-w-fit flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition ${
              cat === c.value
                ? "border-b-2 border-signal bg-paper text-ink"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <span aria-hidden>{CATEGORY_ICONS[c.value]}</span>
            {c.label}
          </button>
        ))}
      </div>

      {/* Onglets plaque / dimensions (plaque = véhicules AUTO uniquement) */}
      {cat === "auto" && (
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
      )}

      <div className="border-t border-line p-6 md:p-8">
        {cat === "auto" && tab === "plaque" ? (
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
          <div>
            {lastDim && (lastDim.cat ?? "auto") === cat && (
              <button
                type="button"
                onClick={() => goSearch(lastDim.w, lastDim.h, lastDim.d)}
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-signal/40 bg-signal/5 px-4 py-2 text-sm font-semibold text-signal transition hover:bg-signal hover:text-white"
              >
                <span aria-hidden>↺</span>
                Reprendre ma dernière recherche&nbsp;:{" "}
                <span className="font-mono font-bold">
                  {lastDim.w}/{lastDim.h} R{lastDim.d}
                </span>
              </button>
            )}

            <form
              onSubmit={submitDim}
              className="flex flex-col gap-4 md:flex-row md:items-end"
            >
              <DimSelect label="Largeur" value={w} set={setW} options={dims.widths} ph={dims.ph[0]} />
              <span className="hidden pb-3 text-2xl text-ink-muted md:block">/</span>
              <DimSelect label="Hauteur" value={h} set={setH} options={dims.ratios} ph={dims.ph[1]} />
              <span className="hidden pb-3 text-2xl text-ink-muted md:block">R</span>
              <DimSelect label="Diamètre" value={d} set={setD} options={dims.diameters} ph={dims.ph[2]} />
              <button
                type="submit"
                className="rounded-lg bg-signal px-8 py-3 font-display text-base font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark"
              >
                Rechercher
              </button>
            </form>

            <SidewallHelp ph={dims.ph} />
          </div>
        )}
      </div>
    </div>
  );
}

function DimSelect({
  label,
  value,
  set,
  options,
  ph,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  options: number[];
  ph: string;
}) {
  return (
    <div className="flex-1">
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      <select
        required
        value={value}
        onChange={(e) => set(e.target.value)}
        className={`h-12 w-full rounded-lg border border-line bg-paper px-3 outline-none transition focus:border-signal ${
          value ? "text-ink" : "text-ink-muted"
        }`}
      >
        <option value="" disabled>
          Ex. {ph}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Aide dépliable : où lire la dimension sur le flanc du pneu.
 * Décomposition colorée du marquage — LE point de friction des novices.
 * L'exemple s'adapte à la famille de véhicule sélectionnée.
 */
function SidewallHelp({ ph }: { ph: [string, string, string] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="text-sm font-semibold text-signal hover:underline"
      >
        {open ? "▾" : "▸"} Où lire mes dimensions&nbsp;?
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-line bg-paper-dim p-5">
          <p className="mb-4 text-sm text-ink-soft">
            La dimension est inscrite sur le flanc (côté) de vos pneus
            actuels, par exemple&nbsp;:
          </p>
          <p className="mb-4 select-none font-mono text-2xl font-black tracking-wider md:text-3xl">
            <span className="border-b-4 border-signal text-ink">{ph[0]}</span>
            <span className="text-ink-muted">/</span>
            <span className="border-b-4 border-amber-500 text-ink">{ph[1]}</span>
            <span className="text-ink-muted"> R</span>
            <span className="border-b-4 border-blue-500 text-ink">{ph[2]}</span>
          </p>
          <ul className="space-y-1.5 text-sm">
            <li>
              <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-signal align-middle" />
              <strong className="text-ink">{ph[0]}</strong>
              <span className="text-ink-muted"> — largeur du pneu en millimètres</span>
            </li>
            <li>
              <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-amber-500 align-middle" />
              <strong className="text-ink">{ph[1]}</strong>
              <span className="text-ink-muted"> — hauteur du flanc (en % de la largeur)</span>
            </li>
            <li>
              <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-blue-500 align-middle" />
              <strong className="text-ink">{ph[2]}</strong>
              <span className="text-ink-muted"> — diamètre de la jante en pouces</span>
            </li>
            <li className="pt-1 text-ink-muted">
              <span className="mr-2 inline-block h-3 w-3 align-middle" />
              Les indices de charge et de vitesse (ex. 91V) sont facultatifs
              pour la recherche
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
