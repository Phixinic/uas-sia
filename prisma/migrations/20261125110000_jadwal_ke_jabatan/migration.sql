-- Audit relasi satu-ke-satu (masukan dosen: "kalau ada relasi one to one, digabung saja").
-- jabatan 1:0..1 jadwal_kerja (id_jabatan unik) digabung: jam masuk, jam keluar, dan hari kerja pindah ke jabatan.
-- presensi menunjuk jabatan (jabatan dan jadwalnya saat presensi dicatat), bukan lagi jadwal_kerja.
-- slip_gaji.id_jadwal dihapus: jabatan slip sudah tersimpan di slip_gaji.id_jabatan dan hari kerja di slip_gaji.hari_kerja.
-- Data dipertahankan: jadwal aktif disalin ke jabatannya, presensi lama diarahkan ke jabatan pemilik jadwalnya.

-- 1. Kolom jadwal di jabatan, diisi dari jadwal kerja yang aktif.
ALTER TABLE "jabatan" ADD COLUMN "jam_masuk" TEXT, ADD COLUMN "jam_keluar" TEXT, ADD COLUMN "hari_kerja" INTEGER;
UPDATE "jabatan" j
SET "jam_masuk" = jk."jam_masuk", "jam_keluar" = jk."jam_keluar", "hari_kerja" = jk."hari_kerja"
FROM "jadwal_kerja" jk
WHERE jk."id_jabatan" = j."id_jabatan" AND jk."aktif";

-- 2. Presensi menunjuk jabatan pemilik jadwalnya.
ALTER TABLE "presensi" ADD COLUMN "id_jabatan" TEXT;
UPDATE "presensi" p SET "id_jabatan" = jk."id_jabatan" FROM "jadwal_kerja" jk WHERE jk."id_jadwal" = p."id_jadwal";
ALTER TABLE "presensi" ALTER COLUMN "id_jabatan" SET NOT NULL;
ALTER TABLE "presensi" DROP CONSTRAINT "presensi_id_jadwal_fkey";
ALTER TABLE "presensi" DROP COLUMN "id_jadwal";
ALTER TABLE "presensi" ADD CONSTRAINT "presensi_id_jabatan_fkey" FOREIGN KEY ("id_jabatan") REFERENCES "jabatan"("id_jabatan") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "presensi_id_jabatan_idx" ON "presensi"("id_jabatan");

-- 3. Slip tidak lagi menyimpan kode jadwal.
ALTER TABLE "slip_gaji" DROP CONSTRAINT "slip_gaji_id_jadwal_fkey";
ALTER TABLE "slip_gaji" DROP COLUMN "id_jadwal";

-- 4. Tabel jadwal_kerja dan penghitung kodenya (TM-xx) tidak dipakai lagi.
ALTER TABLE "jadwal_kerja" DROP CONSTRAINT "jadwal_kerja_id_jabatan_fkey";
DROP TABLE "jadwal_kerja";
DELETE FROM "penghitung" WHERE "kunci" = 'TM';

-- 5. Jadwal hanya untuk jabatan inhouse, ketiga kolom terisi bersama, jam "HH:MM" dan jam keluar sesudah jam masuk.
ALTER TABLE "jabatan" ADD CONSTRAINT "jabatan_jadwal_kerja" CHECK (
  ("jam_masuk" IS NULL) = ("jam_keluar" IS NULL) AND ("jam_masuk" IS NULL) = ("hari_kerja" IS NULL)
  AND ("jam_masuk" IS NULL OR "kelompok" = 'INHOUSE')
  AND ("jam_masuk" IS NULL OR ("jam_masuk" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "jam_keluar" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "jam_keluar" > "jam_masuk"))
  AND ("hari_kerja" IS NULL OR "hari_kerja" BETWEEN 1 AND 31)
);
