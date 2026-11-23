-- Riwayat setting gaji dengan persetujuan Owner, versi setting yang dipakai slip, dan bulan/tahun terpisah di periode.
-- Aman di database kosong (backfill tidak menemukan apa pun) maupun berisi. Jurnal, detail jurnal, dan nilai slip tidak diubah.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Periode: kolom bulan (1-12) dan tahun. Generated column, jadi selalu terisi dan selalu sama dengan id "YYYY-MM"
--    (format id sudah dijaga CHECK periode_format). Id "YYYY-MM" tetap kunci utama supaya relasi lama tidak berubah.
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE "periode"
  ADD COLUMN "bulan" SMALLINT NOT NULL GENERATED ALWAYS AS (substring("periode" FROM 6 FOR 2)::smallint) STORED,
  ADD COLUMN "tahun" SMALLINT NOT NULL GENERATED ALWAYS AS (substring("periode" FROM 1 FOR 4)::smallint) STORED;

CREATE INDEX "periode_tahun_bulan_idx" ON "periode"("tahun", "bulan");

-- ---------------------------------------------------------------------------------------------------------------
-- 2. setting_gaji menjadi riwayat versi (satu karyawan boleh punya banyak versi, tidak pernah ditimpa).
-- ---------------------------------------------------------------------------------------------------------------
CREATE TYPE "JenisPerubahanGaji" AS ENUM ('SETTING_AWAL', 'PROMOSI', 'DEMOSI', 'PENYESUAIAN');

DROP INDEX "setting_gaji_id_karyawan_key";

ALTER TABLE "setting_gaji"
  ADD COLUMN "berlaku_mulai" TEXT,
  ADD COLUMN "jenis_perubahan" "JenisPerubahanGaji" NOT NULL DEFAULT 'SETTING_AWAL',
  ADD COLUMN "alasan" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "status" "StatusPersetujuan" NOT NULL DEFAULT 'DIAJUKAN',
  ADD COLUMN "alasan_tolak" TEXT,
  ADD COLUMN "diajukan_oleh" INTEGER,
  ADD COLUMN "diajukan_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "diputuskan_oleh" INTEGER,
  ADD COLUMN "diputuskan_pada" TIMESTAMP(3);

-- Backfill: setiap setting lama = versi DISETUJUI berjenis SETTING_AWAL, berlaku mulai bulan presensi atau slip pertama
-- karyawan itu (mana yang lebih awal), atau 2026-10 bila belum ada keduanya. Pengaju dan waktunya diambil dari log
-- "master.tambah" setting itu bila tercatat; keputusan dianggap terjadi saat itu juga (data lama tidak punya persetujuan).
WITH awal AS (
  SELECT g."id_setting",
         COALESCE(
           LEAST(
             (SELECT to_char(min(p."tanggal"), 'YYYY-MM') FROM "presensi" p WHERE p."id_karyawan" = g."id_karyawan"),
             (SELECT min(s."periode") FROM "slip_gaji" s WHERE s."id_karyawan" = g."id_karyawan")
           ),
           '2026-10'
         ) AS berlaku,
         (SELECT l."pengguna_id" FROM "log_aktivitas" l
           WHERE l."entitas" = 'setgaji' AND l."entitas_id" = g."id_setting" AND l."aksi" = 'master.tambah'
           ORDER BY l."waktu" ASC, l."id" ASC LIMIT 1) AS pengaju,
         (SELECT l."waktu" FROM "log_aktivitas" l
           WHERE l."entitas" = 'setgaji' AND l."entitas_id" = g."id_setting" AND l."aksi" = 'master.tambah'
           ORDER BY l."waktu" ASC, l."id" ASC LIMIT 1) AS waktu
  FROM "setting_gaji" g
)
UPDATE "setting_gaji" g
SET "berlaku_mulai" = a.berlaku,
    "jenis_perubahan" = 'SETTING_AWAL',
    "status" = 'DISETUJUI',
    "alasan" = 'Setting awal dari data sebelum ada riwayat setting gaji (migrasi otomatis).',
    "diajukan_oleh" = a.pengaju,
    "diajukan_pada" = COALESCE(a.waktu, CURRENT_TIMESTAMP),
    "diputuskan_pada" = COALESCE(a.waktu, CURRENT_TIMESTAMP)
FROM awal a
WHERE a."id_setting" = g."id_setting";

-- Baris periode untuk bulan berlaku (dibutuhkan kunci asing). Periode baru selalu TERBUKA.
INSERT INTO "periode" ("periode")
SELECT DISTINCT "berlaku_mulai" FROM "setting_gaji"
ON CONFLICT ("periode") DO NOTHING;

ALTER TABLE "setting_gaji" ALTER COLUMN "berlaku_mulai" SET NOT NULL;

CREATE INDEX "setting_gaji_id_karyawan_status_berlaku_mulai_idx" ON "setting_gaji"("id_karyawan", "status", "berlaku_mulai");
CREATE INDEX "setting_gaji_status_idx" ON "setting_gaji"("status");

ALTER TABLE "setting_gaji" ADD CONSTRAINT "setting_gaji_berlaku_mulai_fkey" FOREIGN KEY ("berlaku_mulai") REFERENCES "periode"("periode") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "setting_gaji" ADD CONSTRAINT "setting_gaji_diajukan_oleh_fkey" FOREIGN KEY ("diajukan_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "setting_gaji" ADD CONSTRAINT "setting_gaji_diputuskan_oleh_fkey" FOREIGN KEY ("diputuskan_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Aturan isi (ditulis manual, Prisma tidak membuat CHECK).
ALTER TABLE "setting_gaji"
  ADD CONSTRAINT "setting_gaji_tanpa_draf" CHECK ("status" <> 'DRAFT'),
  ADD CONSTRAINT "setting_gaji_alasan_tolak" CHECK ("status" <> 'DITOLAK' OR COALESCE(btrim("alasan_tolak"), '') <> ''),
  ADD CONSTRAINT "setting_gaji_diputuskan" CHECK ("status" = 'DIAJUKAN' OR "diputuskan_pada" IS NOT NULL);

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Slip menyimpan versi setting yang dipakai saat dihitung. Slip lama diisi versi hasil migrasi bila jabatan, golongan,
--    dan daftar tunjangannya sama dengan setting itu; bila berbeda (setting sempat ditimpa sesudah slip dihitung, misalnya
--    tunjangan ditambah) dibiarkan kosong, karena nilai lama setting tidak tersimpan. Slip draf tanpa versi dianggap
--    perlu dihitung ulang. Nilai slip tidak berubah.
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE "slip_gaji" ADD COLUMN "id_setting" TEXT;

UPDATE "slip_gaji" s
SET "id_setting" = g."id_setting"
FROM "setting_gaji" g
WHERE g."id_karyawan" = s."id_karyawan" AND g."id_jabatan" = s."id_jabatan" AND g."id_golongan" = s."id_golongan"
  AND COALESCE((SELECT string_agg(t."id_tunjangan", ',' ORDER BY t."id_tunjangan") FROM "setting_tunjangan" t WHERE t."id_setting" = g."id_setting"), '')
    = COALESCE((SELECT string_agg(t."id_tunjangan", ',' ORDER BY t."id_tunjangan") FROM "slip_tunjangan" t WHERE t."id_slip" = s."id_slip"), '');

ALTER TABLE "slip_gaji" ADD CONSTRAINT "slip_gaji_id_setting_fkey" FOREIGN KEY ("id_setting") REFERENCES "setting_gaji"("id_setting") ON DELETE SET NULL ON UPDATE CASCADE;
