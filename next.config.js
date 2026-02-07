// next.config.js
// next.config.js
/* eslint-disable @typescript-eslint/no-var-requires */
const isDev = process.env.NODE_ENV !== 'production';

const devCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' 'unsafe-inline'",
  "worker-src 'self' blob:",
  "child-src blob:",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' blob:",
  "connect-src 'self' https: http: ws: wss:",
  "style-src 'self' 'unsafe-inline'",
  "frame-ancestors 'none'",
].join('; ');

const prodCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'",
  "worker-src 'self' blob:",
  "child-src blob:",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' blob:",
  "connect-src 'self' https: http:",
  "style-src 'self' 'unsafe-inline'",
  "frame-ancestors 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    serverActions: true,
    // keep 'resend' out of the RSC bundle
    serverComponentsExternalPackages: ['resend'],
  },

  // Dev stays resilient; prod becomes strict (Vercel hosting-safe).
  eslint: { ignoreDuringBuilds: isDev },
  typescript: { ignoreBuildErrors: isDev },

  webpack(config, { isServer }) {
    if (isServer) {
      config.externals = config.externals || [];
      // ensure Node requires 'resend' instead of bundling it
      config.externals.push({ resend: 'commonjs resend' });
    }
    return config;
  },

  images: {
    // allow remote sponsor/brand assets by URL in prod
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'Content-Security-Policy', value: isDev ? devCsp : prodCsp }],
      },
    ];
  },

  async rewrites() {
    return [
      // back-compat
      { source: '/api/tickets/png', destination: '/api/ticket/png' },
      { source: '/api/tickets/pg', destination: '/api/ticket/png' },
    ];
  },
};

module.exports = nextConfig;
