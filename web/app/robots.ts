import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tousvospneus.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/compte", "/panier", "/checkout", "/paiement"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
