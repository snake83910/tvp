/**
 * Étiquette énergétique UE du pneu, façon Allopneus :
 * - efficacité carburant (A→E)
 * - adhérence sol mouillé (A→E)
 * - bruit de roulement (dB)
 */
export function EuLabel({
  fuel,
  wet,
  noise,
}: {
  fuel?: string | null;
  wet?: string | null;
  noise?: string | null;
}) {
  if (!fuel && !wet && !noise) return null;

  return (
    <div className="rounded-xl border border-line bg-paper p-5">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
        Étiquetage européen
      </p>
      <div className="grid grid-cols-3 gap-4 text-center">
        <Metric
          label="Carburant"
          value={fuel}
          hint="Résistance au roulement"
        />
        <Metric
          label="Adhérence"
          value={wet}
          hint="Freinage sol mouillé"
        />
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink text-sm font-black text-paper">
            {noise ? `${noise}` : "—"}
          </div>
          <p className="mt-2 text-sm font-bold text-ink">
            Bruit
          </p>
          <p className="text-[11px] text-ink-muted">
            Décibels (dB)
          </p>
        </div>
      </div>
    </div>
  );
}

const GRADE_COLOR: Record<string, string> = {
  A: "bg-ok",
  B: "bg-ok/80",
  C: "bg-yellow-500",
  D: "bg-orange-500",
  E: "bg-signal",
};

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value?: string | null;
  hint: string;
}) {
  const grade = (value || "").toUpperCase();
  const color = GRADE_COLOR[grade] ?? "bg-line-strong";
  return (
    <div>
      <div
        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-lg font-black text-white ${color}`}
      >
        {grade || "—"}
      </div>
      <p className="mt-2 text-sm font-bold text-ink">{label}</p>
      <p className="text-[11px] text-ink-muted">{hint}</p>
    </div>
  );
}
