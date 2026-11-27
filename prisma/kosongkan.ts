/*
 * Mengosongkan semua tabel data di skema public kecuali `_prisma_migrations`. Daftar tabel dibaca dari katalog
 * Postgres (bukan daftar tulis tangan), jadi tabel baru dari migrasi berikutnya ikut terhapus. Dipakai seed.ts,
 * seed-setahun.ts (data contoh), dan bangun-ulang-setahun.ts. Mengembalikan nama tabel yang dikosongkan.
 */
import type { DbAtauTx } from "../src/lib/server/db";

export async function kosongkanSemua(klien: DbAtauTx): Promise<string[]> {
  const baris = await klien.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename`;
  const tabel = baris.map((b) => b.tablename);
  if (tabel.length) await klien.$executeRawUnsafe(`TRUNCATE ${tabel.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  return tabel;
}
