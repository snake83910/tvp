/** @type {import('next').NextConfig} */

// CSP : sources autorisées. On reste pragmatique :
// - Sogecommerce (formulaire de paiement embarqué)
// - Maxityre (images CDN)
// - 'unsafe-inline' pour styles : Tailwind/Next inlinent souvent les styles critiques
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api-sogecommerce.societegenerale.eu https://static.payzen.eu",
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
  poweredByHeader: false, // masque X-Powered-By: Next.js
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
