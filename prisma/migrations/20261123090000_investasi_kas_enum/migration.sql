-- Investasi Kas, langkah 1 dari 2: nilai enum sumber jurnal baru.
-- Dipisah dari migrasi berikutnya karena PostgreSQL tidak mengizinkan nilai enum baru dipakai di transaksi
-- yang sama dengan ALTER TYPE ... ADD VALUE, sedangkan backfill di langkah 2 memakai nilai ini.

-- AlterEnum
ALTER TYPE "SumberJurnal" ADD VALUE 'INVESTASI_KAS';
