import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "tousvospneus.com — Pneus au meilleur prix, livrés chez vous",
  description:
    "Achetez vos pneus en ligne. Recherche par dimensions, livraison à domicile ou montage chez un garage partenaire. Particuliers et professionnels.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
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
      <body className="grain min-h-screen">{children}</body>
    </html>
  );
}
