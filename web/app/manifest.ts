import type { MetadataRoute } from "next";

/** Manifeste web minimal.
 *
 *  Sans lui, Android n'a aucune icône à utiliser pour un raccourci sur
 *  l'écran d'accueil et retombe sur une capture floue de la page. Il est
 *  volontairement réduit à l'identité : pas de `display: "standalone"`,
 *  donc aucune invite d'installation ne vient s'imposer au visiteur.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "tousvospneus.com",
    short_name: "TVP",
    description:
      "Pneus au meilleur prix : livraison à domicile ou montage chez un garage partenaire.",
    lang: "fr",
    start_url: "/",
    background_color: "#ffffff",
    theme_color: "#17181a",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
  };
}
