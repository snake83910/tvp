"use client";

import { useState } from "react";

/**
 * Image de pneu avec repli : beaucoup de références Maxityre n'ont
 * pas de visuel. Plutôt qu'une image cassée, on affiche une
 * silhouette de pneu sobre dans la charte.
 */
export function TyreImage({
  src,
  alt,
  className = "",
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-paper-dim ${className}`}
        aria-label={alt}
      >
        <svg
          viewBox="0 0 100 100"
          className="h-1/2 w-1/2 text-line-strong"
          fill="none"
        >
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="currentColor"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="20"
            stroke="currentColor"
            strokeWidth="6"
          />
          <circle cx="50" cy="50" r="6" fill="currentColor" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={`object-contain ${className}`}
    />
  );
}
