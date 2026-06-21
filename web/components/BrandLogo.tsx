"use client";

import Image from "next/image";
import { useState } from "react";

const CDN = "https://cdn.maxityre.com/assets/img/brand/medium";

/**
 * Logo de marque (Maxityre CDN). En cas d'absence du logo,
 * affiche le nom textuel en fallback.
 */
export function BrandLogo({
  brand,
  brandSlug,
  className = "h-6",
}: {
  brand: string;
  brandSlug?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!brandSlug || failed) {
    return <span className="font-display font-bold text-ink">{brand}</span>;
  }
  return (
    <Image
      src={`${CDN}/${brandSlug}.jpg`}
      alt={brand}
      width={120}
      height={40}
      onError={() => setFailed(true)}
      className={`${className} w-auto object-contain`}
      unoptimized
    />
  );
}
