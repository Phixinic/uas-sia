-- Riwayat nominal master: gaji pokok golongan, nominal tunjangan, tunjangan jabatan dan tunjangan istri/anak jabatan inhouse,
-- dan tarif jabatan event menjadi versi dengan bulan berlaku dan persetujuan Owner (tabel versi_nominal). Slip gaji dan slip
-- fee menyimpan versi nominal yang dipakainya. Aman di database kosong (backfill tidak menemukan apa pun) maupun berisi.
-- Nilai slip, slip fee, jurnal, dan detail jurnal tidak diubah; slip hanya mendapat kolom rujukan versi.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Tabel versi_nominal.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TYPE "JenisNominal" AS ENUM ('GOLONGAN', 'TUNJANGAN', 'JABATAN', 'JABATAN_EVENT');

CREATE TABLE "versi_nominal" (
    "id_versi" TEXT NOT NULL,
    "jenis" "JenisNominal" NOT NULL,
    "id_golongan" TEXT,
    "id_tunjangan" TEXT,
    "id_jabatan" TEXT,
    "nominal" INTEGER NOT NULL DEFAULT 0,
    "tunj_jabatan" INTEGER NOT NULL DEFAULT 0,
    "tunj_keluarga" INTEGER NOT NULL DEFAULT 0,
    "berlaku_mulai" TEXT NOT NULL,
    "alasan" TEXT NOT NULL DEFAULT '',
    "status" "StatusPersetujuan" NOT NULL DEFAULT 'DIAJUKAN',
    "alasan_tolak" TEXT,
    "diajukan_oleh" INTEGER,
    "diajukan_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diputuskan_oleh" INTEGER,
    "diputuskan_pada" TIMESTAMP(3),

    CONSTRAINT "versi_nominal_pkey" PRIMARY KEY ("id_versi")
);

CREATE INDEX "versi_nominal_jenis_status_berlaku_mulai_idx" ON "versi_nominal"("jenis", "status", "berlaku_mulai");
CREATE INDEX "versi_nominal_id_golongan_idx" ON "versi_nominal"("id_golongan");
CREATE INDEX "versi_nominal_id_tunjangan_idx" ON "versi_nominal"("id_tunjangan");
CREATE INDEX "versi_nominal_id_jabatan_idx" ON "versi_nominal"("id_jabatan");
CREATE INDEX "versi_nominal_status_idx" ON "versi_nominal"("status");

ALTER TABLE "versi_nominal" ADD CONSTRAINT "versi_nominal_id_golongan_fkey" FOREIGN KEY ("id_golongan") REFERENCES "golongan"("id_golongan") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "versi_nominal" ADD CONSTRAINT "versi_nominal_id_tunjangan_fkey" FOREIGN KEY ("id_tunjangan") REFERENCES "tunjangan"("id_tunjangan") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "versi_nominal" ADD CONSTRAINT "versi_nominal_id_jabatan_fkey" FOREIGN KEY ("id_jabatan") REFERENCES "jabatan"("id_jabatan") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "versi_nominal" ADD CONSTRAINT "versi_nominal_berlaku_mulai_fkey" FOREIGN KEY ("berlaku_mulai") REFERENCES "periode"("periode") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "versi_nominal" ADD CONSTRAINT "versi_nominal_diajukan_oleh_fkey" FOREIGN KEY ("diajukan_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "versi_nominal" ADD CONSTRAINT "versi_nominal_diputuskan_oleh_fkey" FOREIGN KEY ("diputuskan_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Aturan isi (ditulis manual, Prisma tidak membuat CHECK).
ALTER TABLE "versi_nominal"
  -- Tepat satu rujukan item, sesuai jenisnya.
  ADD CONSTRAINT "versi_nominal_item" CHECK (
    ("jenis" = 'GOLONGAN') = ("id_golongan" IS NOT NULL)
    AND ("jenis" = 'TUNJANGAN') = ("id_tunjangan" IS NOT NULL)
    AND ("jenis" IN ('JABATAN', 'JABATAN_EVENT')) = ("id_jabatan" IS NOT NULL)
  ),
  -- Gaji pokok, nominal tunjangan, dan tarif event lebih dari 0. Tunjangan jabatan dan istri/anak boleh 0, hanya untuk JABATAN.
  ADD CONSTRAINT "versi_nominal_nilai" CHECK (
    "nominal" >= 0 AND "tunj_jabatan" >= 0 AND "tunj_keluarga" >= 0
    AND ("jenis" = 'JABATAN' OR ("nominal" > 0 AND "tunj_jabatan" = 0 AND "tunj_keluarga" = 0))
    AND ("jenis" <> 'JABATAN' OR "nominal" = 0)
  ),
  ADD CONSTRAINT "versi_nominal_tanpa_draf" CHECK ("status" <> 'DRAFT'),
  ADD CONSTRAINT "versi_nominal_alasan_tolak" CHECK ("status" <> 'DITOLAK' OR COALESCE(btrim("alasan_tolak"), '') <> ''),
  ADD CONSTRAINT "versi_nominal_diputuskan" CHECK ("status" = 'DIAJUKAN' OR "diputuskan_pada" IS NOT NULL);

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Backfill: nominal master yang ada sekarang menjadi versi awal DISETUJUI, berlaku Oktober 2026 (awal data). Bila ada
--    setting gaji, slip, atau event yang lebih awal, berlaku mulai bulan paling awal itu supaya semua data lama tetap
--    punya nominal berlaku. Pengaju dan waktunya diambil dari log "master.tambah" item itu bila tercatat.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TEMP TABLE "awal_nominal" AS
SELECT LEAST(
  '2026-10',
  (SELECT min("berlaku_mulai") FROM "setting_gaji"),
  (SELECT min("periode") FROM "slip_gaji"),
  (SELECT to_char(min("tanggal_selesai"), 'YYYY-MM') FROM "event")
) AS "periode";

INSERT INTO "periode" ("periode") SELECT "periode" FROM "awal_nominal" ON CONFLICT ("periode") DO NOTHING;

INSERT INTO "versi_nominal" ("id_versi", "jenis", "id_golongan", "id_tunjangan", "id_jabatan", "nominal", "tunj_jabatan", "tunj_keluarga",
                             "berlaku_mulai", "alasan", "status", "diajukan_oleh", "diajukan_pada", "diputuskan_pada")
SELECT 'NOM-' || lpad(row_number() OVER (ORDER BY x.urut, x.kode)::text, 4, '0'),
       x.jenis::"JenisNominal", x.g, x.t, x.j, x.n, x.tj, x.tk,
       (SELECT "periode" FROM "awal_nominal"),
       'Nominal awal dari data master sebelum ada riwayat nominal (migrasi otomatis).',
       'DISETUJUI',
       l."pengguna_id",
       COALESCE(l."waktu", CURRENT_TIMESTAMP),
       COALESCE(l."waktu", CURRENT_TIMESTAMP)
FROM (
  SELECT 1 AS urut, 'GOLONGAN' AS jenis, "id_golongan" AS kode, "id_golongan" AS g, NULL::text AS t, NULL::text AS j, "jumlah" AS n, 0 AS tj, 0 AS tk, 'golongan' AS entitas FROM "golongan"
  UNION ALL
  SELECT 2, 'TUNJANGAN', "id_tunjangan", NULL, "id_tunjangan", NULL, "nominal", 0, 0, 'tunjangan' FROM "tunjangan"
  UNION ALL
  SELECT 3, 'JABATAN', "id_jabatan", NULL, NULL, "id_jabatan", 0, "tunj_jabatan", "tunj_keluarga", 'jabatan' FROM "jabatan" WHERE "kelompok" = 'INHOUSE'
  UNION ALL
  SELECT 4, 'JABATAN_EVENT', "id_jabatan", NULL, NULL, "id_jabatan", "tarif", 0, 0, 'jabatanEvent' FROM "jabatan" WHERE "kelompok" = 'EVENT'
) x
LEFT JOIN LATERAL (
  SELECT "pengguna_id", "waktu" FROM "log_aktivitas"
  WHERE "entitas" = x.entitas AND "entitas_id" = x.kode AND "aksi" = 'master.tambah'
  ORDER BY "waktu" ASC, "id" ASC LIMIT 1
) l ON TRUE;

-- Penghitung kode versi (NOM-0001, ...) melanjutkan hasil backfill.
INSERT INTO "penghitung" ("kunci", "nilai")
SELECT 'NOM', count(*) FROM "versi_nominal"
ON CONFLICT ("kunci") DO UPDATE SET "nilai" = GREATEST("penghitung"."nilai", EXCLUDED."nilai");

DROP TABLE "awal_nominal";

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Slip menyimpan versi nominal yang dipakai. Slip lama diberi versi awal hanya bila nilainya sama dengan versi itu
--    (gaji pokok, tunjangan jabatan, tunjangan istri/anak menurut status PTKP slip, nominal tunjangan, tarif). Bila berbeda
--    (nominal master sempat ditimpa sesudah slip dihitung) kolomnya kosong dan tampil "nominal sebelum riwayat".
--    Nilai slip tidak berubah.
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE "slip_gaji" ADD COLUMN "id_versi_gaji_pokok" TEXT, ADD COLUMN "id_versi_jabatan" TEXT;
ALTER TABLE "slip_tunjangan" ADD COLUMN "id_versi" TEXT;
ALTER TABLE "slip_fee" ADD COLUMN "id_versi_tarif" TEXT;

UPDATE "slip_gaji" s SET "id_versi_gaji_pokok" = v."id_versi"
FROM "versi_nominal" v
WHERE v."jenis" = 'GOLONGAN' AND v."id_golongan" = s."id_golongan" AND v."nominal" = s."gaji_pokok";

UPDATE "slip_gaji" s SET "id_versi_jabatan" = v."id_versi"
FROM "versi_nominal" v
WHERE v."jenis" = 'JABATAN' AND v."id_jabatan" = s."id_jabatan" AND v."tunj_jabatan" = s."tunj_jabatan"
  AND s."tunj_keluarga" = CASE WHEN s."status_ptkp"::text LIKE 'K/%' THEN v."tunj_keluarga" ELSE 0 END;

UPDATE "slip_tunjangan" t SET "id_versi" = v."id_versi"
FROM "versi_nominal" v
WHERE v."jenis" = 'TUNJANGAN' AND v."id_tunjangan" = t."id_tunjangan" AND v."nominal" = t."nominal";

UPDATE "slip_fee" f SET "id_versi_tarif" = v."id_versi"
FROM "versi_nominal" v
WHERE v."jenis" = 'JABATAN_EVENT' AND v."id_jabatan" = f."id_jabatan" AND v."nominal" = f."tarif";

ALTER TABLE "slip_gaji" ADD CONSTRAINT "slip_gaji_id_versi_gaji_pokok_fkey" FOREIGN KEY ("id_versi_gaji_pokok") REFERENCES "versi_nominal"("id_versi") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "slip_gaji" ADD CONSTRAINT "slip_gaji_id_versi_jabatan_fkey" FOREIGN KEY ("id_versi_jabatan") REFERENCES "versi_nominal"("id_versi") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "slip_tunjangan" ADD CONSTRAINT "slip_tunjangan_id_versi_fkey" FOREIGN KEY ("id_versi") REFERENCES "versi_nominal"("id_versi") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "slip_fee" ADD CONSTRAINT "slip_fee_id_versi_tarif_fkey" FOREIGN KEY ("id_versi_tarif") REFERENCES "versi_nominal"("id_versi") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Kolom nominal lama di master dihapus, supaya tidak ada lagi angka yang bisa ditimpa tanpa riwayat. CHECK lama
--    jabatan_event_tarif (memakai kolom tarif) diganti versi tanpa tarif; tarif > 0 kini dijaga versi_nominal_nilai.
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE "jabatan" DROP CONSTRAINT IF EXISTS "jabatan_event_tarif";
ALTER TABLE "golongan" DROP COLUMN "jumlah";
ALTER TABLE "tunjangan" DROP COLUMN "nominal";
ALTER TABLE "jabatan" DROP COLUMN "tarif", DROP COLUMN "tunj_jabatan", DROP COLUMN "tunj_keluarga";
ALTER TABLE "jabatan" ADD CONSTRAINT "jabatan_event_lengkap" CHECK ("kelompok" = 'INHOUSE' OR ("peran_event" IS NOT NULL AND "satuan_tarif" IS NOT NULL));
