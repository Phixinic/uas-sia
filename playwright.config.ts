// Konfigurasi uji E2E (Playwright). Dijalankan lewat `npm run uji:e2e`, yang lebih dulu menyiapkan
// database khusus uji (sia_dpro_e2e) lalu memanggil playwright. Server: `next start` pada port 3200.
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3200);

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  outputDir: "/tmp/sia-e2e-hasil",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    viewport: { width: 1366, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/sehat`,
    reuseExistingServer: false,
    timeout: 60_000,
    // Cookie sesi tidak "secure" supaya bisa dipakai di http://127.0.0.1. Petunjuk akun demo ditampilkan di server uji.
    env: { COOKIE_TIDAK_AMAN: "1", TAMPILKAN_AKUN_DEMO: "1", DATABASE_URL: process.env.DATABASE_URL ?? "" },
  },
});
