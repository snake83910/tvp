"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const SEASONS = [
  { value: "", label: "Toutes saisons" },
  { value: "ete", label: "Été" },
  { value: "hiver", label: "Hiver" },
  { value: "4saisons", label: "4 saisons" },
];

export function SearchForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [width, setWidth] = useState(params.get("width") ?? "");
  const [ratio, setRatio] = useState(params.get("ratio") ?? "");
  const [diameter, setDiameter] = useState(params.get("diameter") ?? "");
  const [season, setSeason] = useState(params.get("season") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({ width, ratio, diameter });
    if (season) q.set("season", season);
    router.push(`/recherche?${q.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-ink-muted bg-ink-soft p-6 md:p-8"
    >
      <p className="mb-6 font-display text-sm font-bold uppercase tracking-[0.2em] text-bone-dim">
        Recherche par dimensions
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field
          label="Largeur"
          placeholder="205"
          value={width}
          onChange={setWidth}
        />
        <Field
          label="Hauteur"
          placeholder="55"
          value={ratio}
          onChange={setRatio}
        />
        <Field
          label="Diamètre"
          placeholder="16"
          value={diameter}
          onChange={setDiameter}
        />
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-bone-dim">
            Saison
          </label>
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="h-12 w-full rounded-lg border border-ink-muted bg-ink px-3 text-bone outline-none transition focus:border-signal"
          >
            {SEASONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-4 text-xs text-bone-dim">
        Exemple : un pneu noté <span className="text-bone">205/55 R16</span>{" "}
        → largeur 205, hauteur 55, diamètre 16.
      </p>

      <button
        type="submit"
        className="sweep-line mt-6 w-full rounded-full bg-signal py-4 font-display text-base font-bold uppercase tracking-wide text-bone transition hover:bg-signal-dark md:w-auto md:px-12"
      >
        Rechercher
      </button>
    </form>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-bone-dim">
        {label}
      </label>
      <input
        type="number"
        required
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-lg border border-ink-muted bg-ink px-3 text-bone outline-none transition placeholder:text-bone-dim/50 focus:border-signal"
      />
    </div>
  );
}
