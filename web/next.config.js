/** @type {import('next').NextConfig} */

// CSP : sources autorisées. On reste pragmatique :
// - Sogecommerce (formulaire de paiement embarqué)
// - Maxityre (images CDN)
// - 'unsafe-inline' pour styles : Tailwind/Next inlinent souvent les styles critiques
// - 'unsafe-eval' UNIQUEMENT en dev (React Fast Refresh) : en prod,
//   l'autoriser offrirait un vecteur d'exécution en cas d'injection.
const isDev = process.env.NODE_ENV !== "production";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://api-sogecommerce.societegenerale.eu https://static.payzen.eu`,
  "style-src 'self' 'unsafe-inline' https://api-sogecommerce.societegenerale.eu",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api-sogecommerce.societegenerale.eu https://static.payzen.eu",
  "frame-src https://api-sogecommerce.societegenerale.eu https://static.payzen.eu",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://api-sogecommerce.societegenerale.eu",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // Force HTTPS pour 1 an, inclut sous-domaines
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Bloque MIME-sniffing (ne devine pas le type d'un fichier)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Refuse le rendu dans une iframe externe
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Limite la fuite du referer aux ressources externes
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Désactive les API browsers non utilisées
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://api-sogecommerce.societegenerale.eu\")" },
  // CSP : voir constante ci-dessus
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Répertoire de build isolable (e2e Playwright : NEXT_DIST_DIR=.next-e2e
  // pour ne pas partager le cache avec un `next dev` déjà lancé — les
  // chunks compilés embarquent NEXT_PUBLIC_API_URL, un cache partagé
  // mélange les environnements).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false, // masque X-Powered-By: Next.js
  turbopack: {
    // Next 16 compile avec Turbopack, qui déduit la racine du projet en
    // remontant jusqu'au premier lockfile trouvé. Sur une machine qui en
    // a un traînant dans le répertoire utilisateur, la racine déduite
    // sort du dépôt et la résolution des modules casse. On la fixe sur
    // le dossier web/, qui est bien la racine de cette application.
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.maxityre.com' },
      { protocol: 'https', hostname: '**.maxityre.com' },
      { protocol: 'https', hostname: '**.adtyre.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        // Le tunnel invité et le tunnel connecté ont fusionné : /checkout
        // gère les deux. Redirection permanente pour que les liens et
        // favoris pointant sur l'ancienne adresse continuent d'aboutir.
        source: '/checkout/invite',
        destination: '/checkout',
        permanent: true,
      },
    ];
  },
  // Proxy API → FastAPI interne.
  async rewrites() {
    const dest = process.env.API_URL_INTERNAL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${dest}/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
