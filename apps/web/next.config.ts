import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  fallbacks: {
    document: "/offline",
  },
});

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

export default withPWA(nextConfig);
