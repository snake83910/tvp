/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.maxityre.com' },
    ],
  },
  // Proxy API → FastAPI interne (évite le sous-domaine api. et les problèmes SSL/CORS)
  // tousvospneus.com/api/* → http://127.0.0.1:8000/*
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/:path*',
      },
    ];
  },
};
module.exports = nextConfig;
