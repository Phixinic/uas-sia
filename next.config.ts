import type { NextConfig } from "next";

const headerKeamanan = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Akses dev server lewat 127.0.0.1 (misalnya dari Playwright) tidak diblokir.
  allowedDevOrigins: ["127.0.0.1"],
  // Menghasilkan .next/standalone (server.js + dependensi minimum) untuk image Docker.
  output: "standalone",
  // next dev tidak membuat AGENTS.md dan CLAUDE.md otomatis di folder proyek.
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: headerKeamanan }];
  },
};

export default nextConfig;
