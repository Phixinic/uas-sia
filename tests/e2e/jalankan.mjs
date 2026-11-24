/*
 * Pembungkus `npm run uji:e2e`: menyiapkan database khusus uji lalu menjalankan Playwright.
 *  1. Database uji = `sia_dpro_e2e` di server yang sama dengan DATABASE_URL (atau E2E_DATABASE_URL bila diisi).
 *     Nama database harus berakhiran `_e2e` supaya data pengembangan tidak ikut terhapus.
 *  2. Database dibuat bila belum ada, dimigrasi, lalu diisi ulang dengan data uji prisma/seed.ts (SEED_PAKSA=1).
 *  3. Playwright menyalakan `next start` (butuh `npm run build` lebih dulu) dan menjalankan semua skenario.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import pg from "pg";

const dasar = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dasar) {
  console.error("DATABASE_URL belum diisi. Salin .env.example ke .env dulu.");
  process.exit(1);
}
const url = new URL(dasar);
if (!process.env.E2E_DATABASE_URL) url.pathname = "/sia_dpro_e2e";
const nama = url.pathname.slice(1);
if (!nama.endsWith("_e2e")) {
  console.error(`Nama database uji harus berakhiran _e2e (sekarang: ${nama}).`);
  process.exit(1);
}

const admin = new URL(url);
admin.pathname = "/postgres";
admin.search = "";
const klien = new pg.Client({ connectionString: admin.toString() });
await klien.connect();
const ada = await klien.query("select 1 from pg_database where datname = $1", [nama]);
if (!ada.rowCount) {
  await klien.query(`create database "${nama}"`);
  console.log(`Database ${nama} dibuat.`);
}
await klien.end();

const env = { ...process.env, DATABASE_URL: url.toString(), SEED_PAKSA: "1" };
const jalan = (perintah, args) => {
  const h = spawnSync(perintah, args, { stdio: "inherit", env, shell: false });
  if (h.status !== 0) process.exit(h.status ?? 1);
};
jalan("npx", ["prisma", "migrate", "deploy"]);
// Data uji tetap (Oktober 2026, prisma/seed.ts), bukan data contoh setahun: skenario E2E bergantung pada angkanya.
jalan("npm", ["run", "db:seed-uji"]);
jalan("npx", ["playwright", "test", ...process.argv.slice(2)]);
