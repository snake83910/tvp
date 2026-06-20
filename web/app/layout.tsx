import type { Metadata } from "next";
import "@/styles/globals.css";
import { CartProvider } from "@/components/CartProvider";
import { CookieBanner } from "@/components/CookieBanner";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ConditionalFooter } from "@/components/ConditionalFooter";

export const metadata: Metadata = {
  title: "tousvospneus.com — Pneus au meilleur prix, livrés chez vous",
  description:
    "Achetez vos pneus en ligne. Recherche par dimensions, livraison à domicile ou montage chez un garage partenaire.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">
        {/* Skip-to-content : accessibilité clavier */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-paper"
        >
          Aller au contenu principal
        </a>
        <CartProvider>
          <div id="main-content">{children}</div>
          <ConditionalFooter />
        </CartProvider>
        <CookieBanner />
        <ScrollToTop />
      </body>
    </html>
  );
}
