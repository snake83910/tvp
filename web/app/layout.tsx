import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "@/styles/globals.css";
import { CartProvider } from "@/components/CartProvider";

// Police auto-hébergée par Next (next/font) : plus de <link> vers Google
// Fonts (tiers bloquant le rendu). Archivo est une police variable → un
// seul woff2 couvre tous les poids. `swap` = texte visible immédiatement.
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
});
import { CompareProvider } from "@/components/CompareProvider";
import { CompareBar } from "@/components/CompareBar";
import { CookieBanner } from "@/components/CookieBanner";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ConditionalFooter } from "@/components/ConditionalFooter";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tousvospneus.com";

export const metadata: Metadata = {
  // Base des URL : rend absolus les canonical et OpenGraph relatifs.
  metadataBase: new URL(SITE),
  title: "tousvospneus.com — Pneus au meilleur prix, livrés chez vous",
  description:
    "Achetez vos pneus en ligne. Recherche par dimensions, livraison à domicile ou montage chez un garage partenaire.",
};

// Entité de marque pour Google (Knowledge Graph). Établit le nom, le site
// et le domaine d'activité — utile pour un site jeune sans notoriété.
const orgLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: "tousvospneus.com",
      url: SITE,
      email: "contact@tousvospneus.com",
      areaServed: "FR",
      description:
        "Vente de pneumatiques en ligne (auto, moto, camion, agricole) : livraison à domicile ou montage chez un garage partenaire.",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: SITE,
      name: "tousvospneus.com",
      inLanguage: "fr-FR",
      publisher: { "@id": `${SITE}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={archivo.variable}>
      <body className="min-h-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
        />
        {/* Skip-to-content : accessibilité clavier */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-paper"
        >
          Aller au contenu principal
        </a>
        <CartProvider>
          <CompareProvider>
            <div id="main-content">{children}</div>
            <ConditionalFooter />
            <CompareBar />
          </CompareProvider>
        </CartProvider>
        <CookieBanner />
        <ScrollToTop />
      </body>
    </html>
  );
}
