-- Fee event: penggajian kedua untuk crew freelance per event (lihat docs/KONTRAK.md bagian Fee event).
-- Data lama tetap INHOUSE lewat nilai bawaan kolom, tanpa langkah manual.

-- CreateEnum
CREATE TYPE "JenisKaryawan" AS ENUM ('INHOUSE', 'EVENT');

-- CreateEnum
CREATE TYPE "KelompokJabatan" AS ENUM ('INHOUSE', 'EVENT');

-- CreateEnum
CREATE TYPE "PeranEvent" AS ENUM ('KAPTEN', 'CREW');

-- CreateEnum
CREATE TYPE "SatuanTarif" AS ENUM ('HARI', 'JAM');

-- CreateEnum
CREATE TYPE "StatusEvent" AS ENUM ('PENILAIAN', 'DIAJUKAN', 'SELESAI');

-- CreateEnum
CREATE TYPE "HasilPenilaian" AS ENUM ('SESUAI', 'KURANG');

-- AlterEnum
ALTER TYPE "Peran" ADD VALUE 'KAPTEN';

-- AlterEnum
ALTER TYPE "SumberJurnal" ADD VALUE 'FEE_EVENT';

-- AlterTable
ALTER TABLE "jabatan" ADD COLUMN     "kelompok" "KelompokJabatan" NOT NULL DEFAULT 'INHOUSE',
ADD COLUMN     "peran_event" "PeranEvent",
ADD COLUMN     "satuan_tarif" "SatuanTarif",
ADD COLUMN     "tarif" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "karyawan" ADD COLUMN     "jenis" "JenisKaryawan" NOT NULL DEFAULT 'INHOUSE';

-- AlterTable
ALTER TABLE "pengguna" ADD COLUMN     "id_karyawan" TEXT;

-- CreateTable
CREATE TABLE "event" (
    "id_event" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "klien" TEXT NOT NULL DEFAULT '',
    "tanggal_mulai" DATE NOT NULL,
    "tanggal_selesai" DATE NOT NULL,
    "status" "StatusEvent" NOT NULL DEFAULT 'PENILAIAN',
    "alasan_tolak" TEXT,
    "dibuat_oleh" INTEGER NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id_event")
);

-- CreateTable
CREATE TABLE "sesi_event" (
    "id_sesi" SERIAL NOT NULL,
    "id_event" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "jam_mulai" TEXT NOT NULL,
    "jam_selesai" TEXT NOT NULL,

    CONSTRAINT "sesi_event_pkey" PRIMARY KEY ("id_sesi")
);

-- CreateTable
CREATE TABLE "penugasan_event" (
    "id_penugasan" SERIAL NOT NULL,
    "id_event" TEXT NOT NULL,
    "id_karyawan" TEXT NOT NULL,
    "id_jabatan" TEXT NOT NULL,

    CONSTRAINT "penugasan_event_pkey" PRIMARY KEY ("id_penugasan")
);

-- CreateTable
CREATE TABLE "kehadiran_event" (
    "id_kehadiran" SERIAL NOT NULL,
    "id_sesi" INTEGER NOT NULL,
    "id_karyawan" TEXT NOT NULL,
    "jam_masuk" TEXT NOT NULL,
    "jam_pulang" TEXT NOT NULL,
    "catatan_progres" TEXT NOT NULL DEFAULT '',
    "penilaian" "HasilPenilaian",
    "menit_diakui" INTEGER,
    "catatan_nilai" TEXT,
    "dinilai_oleh" INTEGER,
    "dinilai_pada" TIMESTAMP(3),
    "dibuat_oleh" INTEGER NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kehadiran_event_pkey" PRIMARY KEY ("id_kehadiran")
);

-- CreateTable
CREATE TABLE "laporan_fee" (
    "no_laporan" TEXT NOT NULL,
    "id_event" TEXT NOT NULL,
    "status" "StatusPersetujuan" NOT NULL DEFAULT 'DIAJUKAN',
    "catatan_kapten" TEXT NOT NULL DEFAULT '',
    "total_usulan" INTEGER NOT NULL,
    "total_fee" INTEGER,
    "total_pph" INTEGER,
    "total_dibayar" INTEGER,
    "alasan_tolak" TEXT,
    "jurnal_no" TEXT,
    "diajukan_oleh" INTEGER NOT NULL,
    "diajukan_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diputuskan_oleh" INTEGER,
    "diputuskan_pada" TIMESTAMP(3),

    CONSTRAINT "laporan_fee_pkey" PRIMARY KEY ("no_laporan")
);

-- CreateTable
CREATE TABLE "slip_fee" (
    "id_slip_fee" TEXT NOT NULL,
    "no_laporan" TEXT NOT NULL,
    "id_event" TEXT NOT NULL,
    "id_karyawan" TEXT NOT NULL,
    "id_jabatan" TEXT NOT NULL,
    "akun_beban" TEXT NOT NULL,
    "peran_event" "PeranEvent" NOT NULL,
    "satuan_tarif" "SatuanTarif" NOT NULL,
    "tarif" INTEGER NOT NULL,
    "jumlah_sesi" INTEGER NOT NULL,
    "menit_tercatat" INTEGER NOT NULL,
    "menit_diakui" INTEGER NOT NULL,
    "jumlah_hari" INTEGER NOT NULL,
    "fee_usulan" INTEGER NOT NULL,
    "fee_akhir" INTEGER NOT NULL,
    "alasan_ubah" TEXT,
    "dpp" INTEGER NOT NULL,
    "pph21" INTEGER NOT NULL,
    "dibayar" INTEGER NOT NULL,

    CONSTRAINT "slip_fee_pkey" PRIMARY KEY ("id_slip_fee")
);

-- CreateIndex
CREATE INDEX "event_status_idx" ON "event"("status");

-- CreateIndex
CREATE INDEX "sesi_event_id_event_tanggal_idx" ON "sesi_event"("id_event", "tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "penugasan_event_id_event_id_karyawan_key" ON "penugasan_event"("id_event", "id_karyawan");

-- CreateIndex
CREATE UNIQUE INDEX "kehadiran_event_id_sesi_id_karyawan_key" ON "kehadiran_event"("id_sesi", "id_karyawan");

-- CreateIndex
CREATE UNIQUE INDEX "laporan_fee_jurnal_no_key" ON "laporan_fee"("jurnal_no");

-- CreateIndex
CREATE INDEX "laporan_fee_id_event_status_idx" ON "laporan_fee"("id_event", "status");

-- CreateIndex
CREATE INDEX "slip_fee_no_laporan_idx" ON "slip_fee"("no_laporan");

-- CreateIndex
CREATE UNIQUE INDEX "slip_fee_id_event_id_karyawan_key" ON "slip_fee"("id_event", "id_karyawan");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_id_karyawan_key" ON "pengguna"("id_karyawan");

-- AddForeignKey
ALTER TABLE "pengguna" ADD CONSTRAINT "pengguna_id_karyawan_fkey" FOREIGN KEY ("id_karyawan") REFERENCES "karyawan"("id_karyawan") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_dibuat_oleh_fkey" FOREIGN KEY ("dibuat_oleh") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesi_event" ADD CONSTRAINT "sesi_event_id_event_fkey" FOREIGN KEY ("id_event") REFERENCES "event"("id_event") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penugasan_event" ADD CONSTRAINT "penugasan_event_id_event_fkey" FOREIGN KEY ("id_event") REFERENCES "event"("id_event") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penugasan_event" ADD CONSTRAINT "penugasan_event_id_karyawan_fkey" FOREIGN KEY ("id_karyawan") REFERENCES "karyawan"("id_karyawan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penugasan_event" ADD CONSTRAINT "penugasan_event_id_jabatan_fkey" FOREIGN KEY ("id_jabatan") REFERENCES "jabatan"("id_jabatan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kehadiran_event" ADD CONSTRAINT "kehadiran_event_id_sesi_fkey" FOREIGN KEY ("id_sesi") REFERENCES "sesi_event"("id_sesi") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kehadiran_event" ADD CONSTRAINT "kehadiran_event_id_karyawan_fkey" FOREIGN KEY ("id_karyawan") REFERENCES "karyawan"("id_karyawan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kehadiran_event" ADD CONSTRAINT "kehadiran_event_dinilai_oleh_fkey" FOREIGN KEY ("dinilai_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kehadiran_event" ADD CONSTRAINT "kehadiran_event_dibuat_oleh_fkey" FOREIGN KEY ("dibuat_oleh") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_fee" ADD CONSTRAINT "laporan_fee_id_event_fkey" FOREIGN KEY ("id_event") REFERENCES "event"("id_event") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_fee" ADD CONSTRAINT "laporan_fee_jurnal_no_fkey" FOREIGN KEY ("jurnal_no") REFERENCES "jurnal"("no_jurnal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_fee" ADD CONSTRAINT "laporan_fee_diajukan_oleh_fkey" FOREIGN KEY ("diajukan_oleh") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laporan_fee" ADD CONSTRAINT "laporan_fee_diputuskan_oleh_fkey" FOREIGN KEY ("diputuskan_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_fee" ADD CONSTRAINT "slip_fee_no_laporan_fkey" FOREIGN KEY ("no_laporan") REFERENCES "laporan_fee"("no_laporan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_fee" ADD CONSTRAINT "slip_fee_id_event_fkey" FOREIGN KEY ("id_event") REFERENCES "event"("id_event") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_fee" ADD CONSTRAINT "slip_fee_id_karyawan_fkey" FOREIGN KEY ("id_karyawan") REFERENCES "karyawan"("id_karyawan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_fee" ADD CONSTRAINT "slip_fee_id_jabatan_fkey" FOREIGN KEY ("id_jabatan") REFERENCES "jabatan"("id_jabatan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_fee" ADD CONSTRAINT "slip_fee_akun_beban_fkey" FOREIGN KEY ("akun_beban") REFERENCES "akun"("kode_akun") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------
-- CHECK tambahan (ditulis manual, seperti di migrasi awal)
-- ---------------------------------------------------------------------
ALTER TABLE "event" ADD CONSTRAINT "event_tanggal" CHECK ("tanggal_selesai" >= "tanggal_mulai");
ALTER TABLE "sesi_event" ADD CONSTRAINT "sesi_event_jam"
  CHECK ("jam_mulai" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "jam_selesai" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "jam_selesai" > "jam_mulai");
ALTER TABLE "kehadiran_event" ADD CONSTRAINT "kehadiran_event_jam"
  CHECK ("jam_masuk" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "jam_pulang" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "jam_pulang" > "jam_masuk");
-- Penilaian KURANG wajib berisi catatan dan menit yang diakui; SESUAI atau belum dinilai tidak menyimpan menit diakui.
ALTER TABLE "kehadiran_event" ADD CONSTRAINT "kehadiran_event_penilaian"
  CHECK (("penilaian" = 'KURANG' AND "menit_diakui" >= 0 AND coalesce(btrim("catatan_nilai"), '') <> '')
      OR ("penilaian" IS DISTINCT FROM 'KURANG' AND "menit_diakui" IS NULL));
-- Jabatan EVENT wajib punya peran event, satuan tarif, dan tarif positif.
ALTER TABLE "jabatan" ADD CONSTRAINT "jabatan_event_tarif"
  CHECK ("kelompok" = 'INHOUSE' OR ("peran_event" IS NOT NULL AND "satuan_tarif" IS NOT NULL AND "tarif" > 0));
ALTER TABLE "slip_fee" ADD CONSTRAINT "slip_fee_nilai"
  CHECK ("fee_akhir" >= 0 AND "pph21" >= 0 AND "dibayar" = "fee_akhir" - "pph21");

-- ---------------------------------------------------------------------
-- Data bawaan untuk database yang sudah berisi bagan akun (server yang sudah berjalan).
-- Database kosong dilewati; seed mengisi data yang sama.
-- ---------------------------------------------------------------------
DO $$
DECLARE n integer;
BEGIN
  IF EXISTS (SELECT 1 FROM "akun" WHERE "kode_akun" = '1-110') THEN
    INSERT INTO "akun" ("kode_akun", "nama", "tipe", "saldo_normal", "aktif")
    VALUES ('6-230', 'Biaya Fee Crew Event (Freelance)', 'BEBAN', 'D', true)
    ON CONFLICT DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM "jabatan" WHERE "kelompok" = 'EVENT') THEN
      INSERT INTO "penghitung" ("kunci", "nilai") VALUES ('JBT', 0) ON CONFLICT DO NOTHING;
      UPDATE "penghitung"
        SET "nilai" = GREATEST("nilai", (SELECT coalesce(max(substring("id_jabatan" FROM 5)::integer), 0) FROM "jabatan" WHERE "id_jabatan" ~ '^JBT-[0-9]+$')) + 2
        WHERE "kunci" = 'JBT'
        RETURNING "nilai" INTO n;
      INSERT INTO "jabatan" ("id_jabatan", "nama", "tunj_jabatan", "tunj_keluarga", "akun_beban", "kelompok", "peran_event", "satuan_tarif", "tarif", "aktif") VALUES
        ('JBT-' || lpad((n - 1)::text, 2, '0'), 'Kapten Event', 0, 0, '6-230', 'EVENT', 'KAPTEN', 'HARI', 200000, true),
        ('JBT-' || lpad(n::text, 2, '0'), 'Crew Event', 0, 0, '6-230', 'EVENT', 'CREW', 'JAM', 20000, true);
    END IF;
  END IF;
END $$;
