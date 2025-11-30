/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],

  async redirects() {
    return [
      {
        source: '/',
        destination: '/chat',
        permanent: true,
      },
    ];
  },

  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  experimental: {
    serverActions: {
      allowedOrigins: [],
    },
  },

  // ⭐ Disable ESLint only during `next build` (production)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
