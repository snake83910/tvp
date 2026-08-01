import { brandTierLabel } from "@/lib/api";

/** Pastille de gamme de marque. Premium mis en avant (ambre), les
 * autres restent sobres pour ne pas surcharger la carte. */
const STYLE: Record<string, string> = {
  premium: "border-amber-300 bg-amber-50 text-amber-800",
  quality: "border-line bg-paper-dim text-ink-soft",
  discount: "border-line bg-paper-dim text-ink-muted",
};

export function TierBadge({
  tier,
  className = "",
}: {
  tier?: string | null;
  className?: string;
}) {
  const label = brandTierLabel(tier);
  if (!label) return null;
  const style = STYLE[tier ?? ""] ?? "border-line bg-paper-dim text-ink-soft";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${style} ${className}`}
      title={`Gamme ${label.toLowerCase()}`}
    >
      {label}
    </span>
  );
}
