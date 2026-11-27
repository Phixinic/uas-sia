// Konfigurasi Prisma 7: alamat database dibaca dari .env (DATABASE_URL), bukan dari schema.prisma.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Data contoh Januari 2025 sampai Desember 2026 (nama berkas tetap seed-setahun.ts). prisma/seed.ts tetap dipakai tes sebagai data uji Oktober 2026.
    seed: "tsx prisma/seed-setahun.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://build:build@localhost:5432/build",
  },
});
