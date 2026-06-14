/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.maxityre.com' },
    ],
  },
  // Proxy API → FastAPI interne.
  // Le rewrite s'exécute côté serveur Next.js (dans Docker) :
  //   - en prod Docker : API_URL_INTERNAL=http://api:8000 (réseau Docker interne)
  //   - en local       : fallback sur http://localhost:8000
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
