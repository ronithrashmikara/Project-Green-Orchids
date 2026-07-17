/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_UPSTREAM_URL || 'http://localhost:5000'}/api/:path*`,
      },
      {
        // Uploaded files (products, CMS media, avatars) are served by the API at the
        // root /uploads path (not under /api — see apps/api/src/index.js), so they need
        // their own rewrite rather than piggybacking on the /api one above.
        source: '/uploads/:path*',
        destination: `${process.env.API_UPSTREAM_URL || 'http://localhost:5000'}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
