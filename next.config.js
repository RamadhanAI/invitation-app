// next.config.js
// next.config.js
const isDev = process.env.NODE_ENV !== 'production';

const devCsp = [
  "default-src 'self'",
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
  "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'",
  "worker-src 'self' blob:",
  "child-src blob:",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' blob:",
  "connect-src 'self' https: http:",
  "style-src 'self' 'unsafe-inline'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: true,
    // 👇 keep resend out of the server bundle (required to avoid @react-email/render at build time)
    serverComponentsExternalPackages: ['resend'],
  },
  webpack(config, { isServer }) {
    if (isServer) {
      // Force CommonJS external for resend so it’s required at runtime only
      config.externals = config.externals || [];
      config.externals.push({ resend: 'commonjs resend' });
    }
    return config;
  },
  images: {
    // domains: ['your-cdn.com', 'images.unsplash.com'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: isDev ? devCsp : prodCsp },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
