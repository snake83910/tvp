import { STATUS_LABEL } from "@/lib/orderStatus";

const STYLES: Record<string, string> = {
  pending_payment: "bg-paper-dim text-ink-soft border-line",
  paid: "bg-ok/10 text-ok border-ok/30",
  sent_to_supplier: "bg-blue-50 text-blue-700 border-blue-200",
  shipped: "bg-amber-50 text-amber-700 border-amber-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-signal-light text-signal-dark border-signal/30",
  refunded: "bg-purple-50 text-purple-700 border-purple-200",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STYLES[status] ?? "bg-paper-dim text-ink-soft border-line";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
