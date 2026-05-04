import type { NextConfig } from "next";

const CSP = [
  "default-src 'self'",
  // Next.js hydration requires 'unsafe-inline'; use nonces for stricter setup
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // blob: requis pour PDF.js canvas ; data: retiré (non nécessaire)
  "img-src 'self' https: blob:",
  // worker-src blob: requis pour le web worker PDF.js
  "worker-src blob: 'self'",
  "connect-src 'self' https://*.supabase.co https://api.eu1.affinda.com https://api.affinda.com",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "recrutestagiaire.eu",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "Content-Security-Policy", value: CSP },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
