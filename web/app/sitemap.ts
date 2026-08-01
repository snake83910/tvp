import type { MetadataRoute } from "next";
import { POPULAR_DIMENSIONS } from "@/lib/dimensions";
import { dimensionUrl } from "@/lib/slug";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tousvospneus.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE}/recherche`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/pneus-ete`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/pneus-hiver`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/pneus-4-saisons`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/guide`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/a-propos`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE}/cgv`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/mentions-legales`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/confidentialite`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  // Pages d'atterrissage par dimension (URL propre, indexable)
  const dimensionPages: MetadataRoute.Sitemap = POPULAR_DIMENSIONS.map(([w, r, d]) => ({
    url: `${SITE}${dimensionUrl(w, r, d)}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [...staticPages, ...dimensionPages];
}
