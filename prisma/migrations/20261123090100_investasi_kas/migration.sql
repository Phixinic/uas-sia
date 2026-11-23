-- Investasi Kas, langkah 2 dari 2: tabel setoran modal pemilik berupa kas, lalu backfill setoran lama.
-- Lihat docs/KONTRAK.md bagian Investasi Kas. Aman di database kosong (backfill tidak menemukan apa pun)
-- maupun berisi, tanpa langkah manual. Angka jurnal tidak diubah; yang berubah hanya sumber_tipe dan sumber_id
-- jurnal setoran lama supaya menunjuk dokumen Investasi Kas, sama seperti jurnal pelepasan atau penggajian.

-- CreateTable
CREATE TABLE "investasi_kas" (
    "no_investasi" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "keterangan" TEXT NOT NULL,
    "status" "StatusPersetujuan" NOT NULL DEFAULT 'DIAJUKAN',
    "alasan_tolak" TEXT,
    "jurnal_no" TEXT,
    "dibuat_oleh" INTEGER NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diputuskan_oleh" INTEGER,
    "diputuskan_pada" TIMESTAMP(3),

    CONSTRAINT "investasi_kas_pkey" PRIMARY KEY ("no_investasi")
);

-- CreateIndex
CREATE UNIQUE INDEX "investasi_kas_jurnal_no_key" ON "investasi_kas"("jurnal_no");

-- CreateIndex
CREATE INDEX "investasi_kas_status_idx" ON "investasi_kas"("status");

-- CreateIndex
CREATE INDEX "investasi_kas_tanggal_idx" ON "investasi_kas"("tanggal");

-- AddForeignKey
ALTER TABLE "investasi_kas" ADD CONSTRAINT "investasi_kas_jurnal_no_fkey" FOREIGN KEY ("jurnal_no") REFERENCES "jurnal"("no_jurnal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investasi_kas" ADD CONSTRAINT "investasi_kas_dibuat_oleh_fkey" FOREIGN KEY ("dibuat_oleh") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investasi_kas" ADD CONSTRAINT "investasi_kas_diputuskan_oleh_fkey" FOREIGN KEY ("diputuskan_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Aturan isi (ditulis manual, Prisma tidak membuat CHECK).
ALTER TABLE "investasi_kas"
  ADD CONSTRAINT "investasi_kas_jumlah_positif" CHECK ("jumlah" > 0),
  ADD CONSTRAINT "investasi_kas_tanpa_draf" CHECK ("status" <> 'DRAFT'),
  ADD CONSTRAINT "investasi_kas_jurnal_sesuai_status" CHECK (("status" = 'DISETUJUI') = ("jurnal_no" IS NOT NULL)),
  ADD CONSTRAINT "investasi_kas_alasan_tolak" CHECK ("status" <> 'DITOLAK' OR COALESCE(btrim("alasan_tolak"), '') <> '');

-- Backfill: jurnal setoran modal lama (sumber SALDO_AWAL, DISETUJUI, tepat dua baris Dr 1-110 Kas dan Kr 3-110
-- Modal Pemilik dengan nilai sama) menjadi Investasi Kas DISETUJUI yang menunjuk jurnalnya. Nomor INV-YYYY-NNNN
-- urut tanggal lalu nomor jurnal, per tahun tanggal setoran. Pembuat dan penyetuju disalin dari jurnalnya.
INSERT INTO "investasi_kas" ("no_investasi", "tanggal", "jumlah", "keterangan", "status", "jurnal_no", "dibuat_oleh", "dibuat_pada", "diputuskan_oleh", "diputuskan_pada")
SELECT
  'INV-' || k.tahun || '-' || lpad(k.urut::text, 4, '0'),
  k.tanggal, k.jumlah, k.keterangan, 'DISETUJUI', k.no_jurnal, k.dibuat_oleh, k.dibuat_pada,
  COALESCE(k.disetujui_oleh, k.dibuat_oleh), COALESCE(k.disetujui_pada, k.dibuat_pada)
FROM (
  SELECT j."no_jurnal", j."tanggal", j."keterangan", j."dibuat_oleh", j."dibuat_pada", j."disetujui_oleh", j."disetujui_pada",
         kas."debit" AS jumlah,
         to_char(j."tanggal", 'YYYY') AS tahun,
         row_number() OVER (PARTITION BY to_char(j."tanggal", 'YYYY') ORDER BY j."tanggal", j."no_jurnal") AS urut
  FROM "jurnal" j
  JOIN "detail_jurnal" kas ON kas."no_jurnal" = j."no_jurnal" AND kas."kode_akun" = '1-110' AND kas."debit" > 0 AND kas."kredit" = 0
  JOIN "detail_jurnal" modal ON modal."no_jurnal" = j."no_jurnal" AND modal."kode_akun" = '3-110' AND modal."kredit" = kas."debit" AND modal."debit" = 0
  WHERE j."sumber_tipe" = 'SALDO_AWAL' AND j."status" = 'DISETUJUI' AND j."jenis" = 'UMUM'
    AND (SELECT count(*) FROM "detail_jurnal" x WHERE x."no_jurnal" = j."no_jurnal") = 2
) k;

-- Penghitung nomor INV per tahun melanjutkan hasil backfill, supaya setoran baru tidak bertabrakan nomor.
INSERT INTO "penghitung" ("kunci", "nilai")
SELECT 'INV' || substr("no_investasi", 5, 4), count(*)::int FROM "investasi_kas" GROUP BY 1
ON CONFLICT ("kunci") DO UPDATE SET "nilai" = GREATEST("penghitung"."nilai", EXCLUDED."nilai");

-- Jejak jurnal: sumber jurnal setoran lama menunjuk dokumen Investasi Kas (debit, kredit, nomor, dan tanggal tetap).
UPDATE "jurnal" j SET "sumber_tipe" = 'INVESTASI_KAS', "sumber_id" = i."no_investasi"
FROM "investasi_kas" i
WHERE i."jurnal_no" = j."no_jurnal";
