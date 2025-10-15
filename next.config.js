// next.config.js
// next.config.js
const isDev = process.env.NODE_ENV !== 'production';

// CSP: dev is relaxed for HMR + external banners; prod is stricter but still allows remote images
const devCsp = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' 'unsafe-inline'",
  "worker-src 'self' blob:",
  "child-src blob:",
  // ✅ allow banners from /public AND remote CDNs
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
  // ✅ still allow remote images in prod
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' blob:",
  "connect-src 'self' https: http:",
  "style-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // ⚠️ In DEV, DO NOT set COOP/COEP or you’ll block many cross-origin images
          ...(isDev ? [] : [
            { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
            { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          ]),
          { key: 'Content-Security-Policy', value: isDev ? devCsp : prodCsp },
        ],
      },
    ];
  },
};
