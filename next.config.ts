import type { NextConfig } from "next";
import path from "node:path";

const CSP = [
  "default-src 'self'",
  // loginbr-open.navent.com: botão oficial de vínculo com o Imovelweb (/admin/imovelweb).
  "script-src 'self' 'unsafe-inline' https://loginbr-open.navent.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.supabase.co https://loginbr-open.navent.com",
  "font-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self' https://*.supabase.co https://loginbr-open.navent.com",
  "frame-src https://loginbr-open.navent.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
