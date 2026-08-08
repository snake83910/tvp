import type { MetadataRoute } from "next";
import { COMMON_DIMENSIONS, POPULAR_DIMENSIONS } from "@/lib/dimensions";
import { dimensionUrl } from "@/lib/slug";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tousvospneus.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // /recherche est en noindex (facettes) : volontairement absent du sitemap
  // pour ne pas envoyer de signal contradictoire à Google.
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE}/pneus-ete`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/pneus-hiver`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/pneus-4-saisons`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/montage-pneu`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/guide`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/comparer`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/a-propos`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE}/cgv`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/mentions-legales`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/confidentialite`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  // Pages d'atterrissage par dimension (URL propre, indexable) : socle du
  // référencement d'un e-commerce de pneus. On fusionne le top 15 et la
  // liste étendue, en dédupliquant.
  const seen = new Set<string>();
  const dimensionPages: MetadataRoute.Sitemap = [];
  for (const [w, r, d] of [...POPULAR_DIMENSIONS, ...COMMON_DIMENSIONS]) {
    const path = dimensionUrl(w, r, d);
    if (seen.has(path)) continue;
    seen.add(path);
    dimensionPages.push({
      url: `${SITE}${path}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  return [...staticPages, ...dimensionPages];
}
