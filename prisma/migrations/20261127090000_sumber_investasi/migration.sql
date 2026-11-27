-- Sumber investasi pada pembelian cara bayar Investasi: barang bisa disetor pemilik, investor, atau berupa hibah,
-- dan tiap sumber punya akun modal sendiri. Migrasi ini hanya menambah; jurnal yang sudah ada tidak diubah.
-- CreateEnum
CREATE TYPE "SumberInvestasi" AS ENUM ('PEMILIK', 'INVESTOR', 'HIBAH');

-- AlterTable
ALTER TABLE "pembelian" ADD COLUMN     "sumber_investasi" "SumberInvestasi";

-- Pembelian Investasi lama selalu dijurnal ke 3-110 Modal Pemilik, jadi sumbernya Pemilik.
UPDATE "pembelian" SET "sumber_investasi" = 'PEMILIK' WHERE "cara_bayar" = 'INVESTASI';

-- Sumber wajib untuk Investasi dan harus kosong untuk Tunai dan Kredit.
ALTER TABLE "pembelian" ADD CONSTRAINT "pembelian_sumber_investasi" CHECK (("cara_bayar" = 'INVESTASI') = ("sumber_investasi" IS NOT NULL));

-- Akun modal baru. Hanya ditambah di database yang sudah punya bagan akun (produksi tidak menjalankan seed ulang);
-- database kosong diisi seed. Kode yang sudah ada tidak ditimpa.
INSERT INTO "akun" ("kode_akun", "nama", "tipe", "saldo_normal", "aktif")
SELECT v.kode, v.nama, v.tipe::"TipeAkun", v.normal::"SaldoNormal", true
FROM (VALUES
  ('3-120', 'Modal Investor', 'EKUITAS', 'K'),
  ('3-130', 'Modal Hibah', 'EKUITAS', 'K')
) AS v(kode, nama, tipe, normal)
WHERE EXISTS (SELECT 1 FROM "akun")
ON CONFLICT ("kode_akun") DO NOTHING;
