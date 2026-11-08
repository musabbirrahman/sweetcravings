const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");

initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Security headers on every response. CSP notes:
  // - script/style 'unsafe-inline': Next.js inlines small runtime bits
  //   and styled-jsx without nonces; a nonce-based CSP would break the
  //   app, so inline stays allowed for same-origin code only.
  // - img-src includes images.unsplash.com: the seeded catalogue photos
  //   are hosted there until the shop replaces them with real photos
  //   (stored in Turso). Drop that entry once no product photo points
  //   at Unsplash any more.
  // - connect-src 'self': the browser only talks to this site's own
  //   /api/* routes (Telegram is server-side, wa.me links are plain
  //   navigation, not subresources).
  // - frame-ancestors 'none': the site (including the admin panel) must
  //   never be framed — the X-Frame-Options header below is the
  //   fallback for browsers without CSP.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: blob: https://images.unsplash.com; " +
              "font-src 'self' data:; " +
              "connect-src 'self'; " +
              "object-src 'none'; " +
              "base-uri 'self'; " +
              "frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
  experimental: {
    // The Turso client (@libsql/client) ships separate entry points
    // for Node and for workerd. Next.js's file tracer only follows the
    // Node conditions, so the workerd-only files (lib-esm/web.js,
    // isomorphic-ws/web.mjs, ...) never land in the standalone output
    // and the OpenNext build then fails to resolve them. Force them
    // into the trace for every route.
    outputFileTracingIncludes: {
      '**': [
        './node_modules/@libsql/**/lib-esm/**/*',
        './node_modules/@libsql/isomorphic-ws/**/*',
      ],
    },
  },
  images: {
    // No on-the-fly image optimization: the Cloudflare Images binding
    // is a separately billed service and the owner has no payment
    // method on file. Product photos are already web-sized (resized in
    // the browser to at most 1200px, JPEG quality 80, before upload),
    // so serving them as-is is the right trade-off.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

module.exports = nextConfig;
