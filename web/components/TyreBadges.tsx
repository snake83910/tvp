import type { TyreResult } from "@/lib/api";

const BADGE_BASE = "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold";

export function TyreBadges({ tyre }: { tyre: TyreResult }) {
  const badges: { label: string; cls: string; title?: string }[] = [];

  if (tyre.is_3pmsf) {
    badges.push({
      label: "❄ 3PMSF",
      cls: "border-blue-200 bg-blue-50 text-blue-800",
      title: "Symbole montagne + 3 pics : homologué hiver",
    });
  }
  if (tyre.is_xl) {
    badges.push({
      label: "XL",
      cls: "border-amber-200 bg-amber-50 text-amber-800",
      title: "Pneu renforcé (charge accrue)",
    });
  }
  if (tyre.is_runflat) {
    badges.push({
      label: "RunFlat",
      cls: "border-purple-200 bg-purple-50 text-purple-800",
      title: "Roulage à plat possible",
    });
  }
  if (tyre.is_studded) {
    badges.push({
      label: "Cloutable",
      cls: "border-indigo-200 bg-indigo-50 text-indigo-800",
      title: "Pneu cloutable (usage Nord)",
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => (
        <span key={b.label} className={`${BADGE_BASE} ${b.cls}`} title={b.title}>
          {b.label}
        </span>
      ))}
    </div>
  );
}
