import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tousvospneus.com";

// Dimensions populaires en France : permet à Google d'indexer les
// principales pages de recherche du catalogue.
const POPULAR_DIMENSIONS = [
  [195, 65, 15],
  [205, 55, 16],
  [225, 45, 17],
  [225, 40, 18],
  [195, 55, 16],
  [215, 60, 16],
  [205, 60, 16],
  [235, 45, 18],
  [225, 50, 17],
  [215, 65, 16],
  [185, 65, 15],
  [205, 50, 17],
  [255, 35, 19],
  [245, 40, 18],
  [215, 55, 17],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE}/recherche`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/cgv`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/mentions-legales`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/confidentialite`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const dimensionPages: MetadataRoute.Sitemap = POPULAR_DIMENSIONS.map(([w, r, d]) => ({
    url: `${SITE}/recherche?width=${w}&ratio=${r}&diameter=${d}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [...staticPages, ...dimensionPages];
}
