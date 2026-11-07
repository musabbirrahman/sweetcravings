const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");

initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
