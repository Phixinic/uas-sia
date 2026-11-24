-- Upah event karyawan inhouse dibayar lewat Gaji Bulanan (masukan dosen).
-- slip_fee.periode_gaji terisi = baris karyawan inhouse yang dibayar lewat gaji bulan itu; kosong = crew freelance.
-- AlterTable
ALTER TABLE "slip_fee" ADD COLUMN     "periode_gaji" TEXT;

-- CreateIndex
CREATE INDEX "slip_fee_periode_gaji_id_karyawan_idx" ON "slip_fee"("periode_gaji", "id_karyawan");

-- AddForeignKey
ALTER TABLE "slip_fee" ADD CONSTRAINT "slip_fee_periode_gaji_fkey" FOREIGN KEY ("periode_gaji") REFERENCES "periode"("periode") ON DELETE SET NULL ON UPDATE CASCADE;


-- Baris inhouse tidak memakai PPh 21 bukan pegawai (PPh dihitung di gaji pegawai); seluruh fee diteruskan ke gaji.
ALTER TABLE "slip_fee" ADD CONSTRAINT "slip_fee_lewat_gaji" CHECK ("periode_gaji" IS NULL OR ("pph21" = 0 AND "dpp" = 0 AND "dibayar" = "fee_akhir"));

-- Akun baru untuk Gaji Bulanan (upah event inhouse, bonus, denda). Hanya ditambah di database yang sudah punya bagan akun;
-- database kosong diisi seed. Kode yang sudah ada tidak ditimpa.
INSERT INTO "akun" ("kode_akun", "nama", "tipe", "saldo_normal", "aktif")
SELECT v.kode, v.nama, v.tipe::"TipeAkun", v.normal::"SaldoNormal", true
FROM (VALUES
  ('6-240', 'Biaya Upah Event Karyawan', 'BEBAN', 'D'),
  ('6-250', 'Biaya Bonus Karyawan', 'BEBAN', 'D'),
  ('7-120', 'Pendapatan Lain-lain (Denda Karyawan)', 'PENDAPATAN', 'K')
) AS v(kode, nama, tipe, normal)
WHERE EXISTS (SELECT 1 FROM "akun")
ON CONFLICT ("kode_akun") DO NOTHING;
