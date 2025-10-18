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
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "child-src blob:",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' blob:",
  "connect-src 'self' https: http:",
  "style-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig = {
  experimental: {
    serverActions: true,   // ← required for `use server`
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        ...(isDev ? [] : [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ]),
        { key: 'Content-Security-Policy', value: isDev ? devCsp : prodCsp },
      ],
    }];
  },
};

module.exports = nextConfig;
