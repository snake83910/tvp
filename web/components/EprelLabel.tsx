/**
 * Affiche l'étiquette énergie européenne officielle (EPREL).
 * Source : https://eprel.ec.europa.eu/
 *
 * En cas d'échec de chargement, fallback sur le composant maison EuLabel.
 */
"use client";

import { useState } from "react";
import { EuLabel } from "@/components/EuLabel";

export function EprelLabel({
  eprelId,
  fuel,
  wet,
  noise,
}: {
  eprelId: number | null | undefined;
  fuel?: string | null;
  wet?: string | null;
  noise?: string | null;
}) {
  const [failed, setFailed] = useState(false);

  if (!eprelId || failed) {
    return <EuLabel fuel={fuel ?? null} wet={wet ?? null} noise={noise ?? null} />;
  }

  return (
    <a
      href={`https://eprel.ec.europa.eu/screen/product/tyres/${eprelId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block w-full max-w-xs rounded-2xl border border-line bg-paper p-5 shadow-card transition hover:border-signal hover:shadow-lift"
      title="Voir la fiche officielle sur EPREL"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://eprel.ec.europa.eu/labels/tyres/Label_${eprelId}.svg`}
        alt="Étiquette énergie européenne officielle"
        onError={() => setFailed(true)}
        className="mx-auto h-auto w-full max-w-[260px]"
        loading="lazy"
      />
      <p className="mt-3 text-center text-xs font-semibold text-ink-muted">
        Étiquette officielle EPREL ↗
      </p>
    </a>
  );
}
