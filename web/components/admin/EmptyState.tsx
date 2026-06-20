import { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-paper px-6 py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-paper-dim text-ink-muted">
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8">
            <rect x="4" y="6" width="16" height="14" rx="2" />
            <path d="M4 10h16M9 14h6M9 17h4" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <p className="mt-4 font-display text-lg font-bold text-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
