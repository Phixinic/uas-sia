/*
 * Bangun ulang database produksi dengan data contoh satu tahun (prisma/seed-setahun.ts).
 * Semua tabel data di skema public dikosongkan (kecuali _prisma_migrations, daftar dibaca dari katalog Postgres), lalu
 * seed setahun dijalankan dan diperiksa (neraca seimbang, kas tidak negatif, penghitung cocok) dalam SATU transaksi.
 * Bila ada yang gagal, semuanya dibatalkan dan data lama tetap utuh.
 *
 *   Coba tanpa menyimpan (semua langkah dijalankan lalu rollback):  npx tsx prisma/bangun-ulang-setahun.ts --coba
 *   Sungguhan (menghapus semua data lama):                          SAYA_YAKIN=1 npx tsx prisma/bangun-ulang-setahun.ts
 * Jalankan sesudah `npx prisma migrate deploy`.
 */
import "dotenv/config";
import { db } from "../src/lib/server/db";
import { jalankanSeedSetahun } from "./seed-setahun";

async function main() {
  const coba = process.argv.includes("--coba");
  if (!coba && process.env.SAYA_YAKIN !== "1") {
    console.error("Skrip ini menghapus SEMUA data lalu mengisi data contoh setahun. Coba dulu dengan --coba, lalu jalankan dengan SAYA_YAKIN=1 bila sudah yakin.");
    process.exit(1);
  }
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://x@localhost/x");
  console.log(`${coba ? "Mode coba" : "Bangun ulang"} di database ${host.pathname.slice(1)} (${host.hostname}).`);
  await jalankanSeedSetahun({ kosongkan: true, coba });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
