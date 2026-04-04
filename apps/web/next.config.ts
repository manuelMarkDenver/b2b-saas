import type { NextConfig } from "next";

// @ducanh2912/next-pwa@10.2.9 is incompatible with next@15.2.8 — causes
// "e[o] is not a function" webpack runtime error during static page generation.
// PWA manifest and icons are served from public/ so install-to-homescreen still
// works. Service worker will be re-enabled when a compatible version is available.
// TODO: re-enable once @ducanh2912/next-pwa supports next 15.2.8+

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Local API dev server (any port — APP_BASE_URL varies by env)
      { protocol: "http", hostname: "localhost", pathname: "/uploads/**" },
      // Cloudflare R2 public buckets
      { protocol: "https", hostname: "*.r2.dev", pathname: "/**" },
      // AWS S3 / CloudFront (kept for flexibility)
      { protocol: "https", hostname: "*.s3.amazonaws.com", pathname: "/**" },
      { protocol: "https", hostname: "*.cloudfront.net", pathname: "/**" },
      // Custom CDN domain or R2 public URL (e.g. media.zentral.ph)
      { protocol: "https", hostname: "**", pathname: "/uploads/**" },
    ],
  },
};

export default nextConfig;
