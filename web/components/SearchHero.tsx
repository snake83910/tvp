"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchHero() {
  const router = useRouter();
  const [tab, setTab] = useState<"plaque" | "dim">("dim");

  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [d, setD] = useState("");

  function submitDim(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({
      width: w,
      ratio: h,
      diameter: d,
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
          <div className="text-center">
            <div className="mx-auto flex max-w-md overflow-hidden rounded-lg border-2 border-line">
              <span className="flex items-center bg-[#0a3aa6] px-3 text-xs font-bold text-white">
                F
              </span>
              <input
                disabled
                placeholder="AA-123-AA"
                className="flex-1 px-4 py-3 text-center font-mono text-lg uppercase tracking-widest outline-none"
              />
            </div>
            <p className="mt-4 inline-block rounded-full bg-paper-dim px-4 py-2 text-sm text-ink-muted">
              Recherche par plaque — bientôt disponible
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              En attendant, utilisez la recherche par dimensions.
            </p>
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
        <p className="mt-4 text-center text-xs text-ink-muted md:text-left">
          Exemple : pneu marqué{" "}
          <span className="font-semibold text-ink">205/55 R16</span> →
          largeur 205, hauteur 55, diamètre 16.
        </p>
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
