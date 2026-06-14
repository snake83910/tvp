import { ReactNode } from "react";

/**
 * Bloc avec animation pulse — alternative aux écrans blancs et "Chargement…".
 * Donne au visiteur un repère visuel pendant les chargements.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-paper-dim ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonList({ count = 3, itemClass = "h-16" }: { count?: number; itemClass?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={itemClass} />
      ))}
    </div>
  );
}

export function PageSkeleton({ children }: { children?: ReactNode }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement en cours">
      {children ?? (
        <>
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <SkeletonList count={4} itemClass="h-24" />
        </>
      )}
    </div>
  );
}
