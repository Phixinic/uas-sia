-- Revisi nilai sisa perlengkapan (masukan dosen: "perlengkapan bisa direvisi").
-- Tabel baru revisi_opname dan detail_revisi_opname untuk revisi sesudah opname disetujui. Data lama tidak berubah.
-- CreateTable
CREATE TABLE "revisi_opname" (
    "no_revisi" TEXT NOT NULL,
    "id_opname" TEXT NOT NULL,
    "ke" INTEGER NOT NULL,
    "total_beban_lama" INTEGER NOT NULL,
    "total_beban" INTEGER NOT NULL,
    "alasan" TEXT NOT NULL,
    "status" "StatusPersetujuan" NOT NULL DEFAULT 'DIAJUKAN',
    "alasan_tolak" TEXT,
    "jurnal_lama" TEXT,
    "jurnal_pembalik" TEXT,
    "jurnal_baru" TEXT,
    "diajukan_oleh" INTEGER NOT NULL,
    "diajukan_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diputuskan_oleh" INTEGER,
    "diputuskan_pada" TIMESTAMP(3),

    CONSTRAINT "revisi_opname_pkey" PRIMARY KEY ("no_revisi")
);

-- CreateTable
CREATE TABLE "detail_revisi_opname" (
    "no_revisi" TEXT NOT NULL,
    "id_perlengkapan" TEXT NOT NULL,
    "saldo_buku" INTEGER NOT NULL,
    "nilai_sisa_lama" INTEGER NOT NULL,
    "nilai_sisa" INTEGER NOT NULL,

    CONSTRAINT "detail_revisi_opname_pkey" PRIMARY KEY ("no_revisi","id_perlengkapan")
);

-- CreateIndex
CREATE UNIQUE INDEX "revisi_opname_jurnal_pembalik_key" ON "revisi_opname"("jurnal_pembalik");

-- CreateIndex
CREATE UNIQUE INDEX "revisi_opname_jurnal_baru_key" ON "revisi_opname"("jurnal_baru");

-- CreateIndex
CREATE INDEX "revisi_opname_status_idx" ON "revisi_opname"("status");

-- CreateIndex
CREATE UNIQUE INDEX "revisi_opname_id_opname_ke_key" ON "revisi_opname"("id_opname", "ke");

-- AddForeignKey
ALTER TABLE "revisi_opname" ADD CONSTRAINT "revisi_opname_id_opname_fkey" FOREIGN KEY ("id_opname") REFERENCES "opname"("id_opname") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisi_opname" ADD CONSTRAINT "revisi_opname_jurnal_pembalik_fkey" FOREIGN KEY ("jurnal_pembalik") REFERENCES "jurnal"("no_jurnal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisi_opname" ADD CONSTRAINT "revisi_opname_jurnal_baru_fkey" FOREIGN KEY ("jurnal_baru") REFERENCES "jurnal"("no_jurnal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisi_opname" ADD CONSTRAINT "revisi_opname_diajukan_oleh_fkey" FOREIGN KEY ("diajukan_oleh") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisi_opname" ADD CONSTRAINT "revisi_opname_diputuskan_oleh_fkey" FOREIGN KEY ("diputuskan_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_revisi_opname" ADD CONSTRAINT "detail_revisi_opname_no_revisi_fkey" FOREIGN KEY ("no_revisi") REFERENCES "revisi_opname"("no_revisi") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_revisi_opname" ADD CONSTRAINT "detail_revisi_opname_id_perlengkapan_fkey" FOREIGN KEY ("id_perlengkapan") REFERENCES "perlengkapan"("id_perlengkapan") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Aturan status (sama dengan dokumen lain yang lewat persetujuan Owner).
ALTER TABLE "revisi_opname" ADD CONSTRAINT "revisi_opname_status" CHECK ("status" <> 'DRAFT');
ALTER TABLE "revisi_opname" ADD CONSTRAINT "revisi_opname_alasan" CHECK (length(btrim("alasan")) > 0);
ALTER TABLE "revisi_opname" ADD CONSTRAINT "revisi_opname_kembali_beralasan" CHECK ("status" <> 'DITOLAK' OR length(btrim(coalesce("alasan_tolak", ''))) > 0);
ALTER TABLE "revisi_opname" ADD CONSTRAINT "revisi_opname_keputusan" CHECK (("status" = 'DIAJUKAN') = ("diputuskan_pada" IS NULL));
ALTER TABLE "revisi_opname" ADD CONSTRAINT "revisi_opname_nilai" CHECK ("total_beban" >= 0 AND "total_beban_lama" >= 0 AND "ke" > 0);
ALTER TABLE "detail_revisi_opname" ADD CONSTRAINT "detail_revisi_opname_nilai" CHECK ("nilai_sisa" >= 0 AND "nilai_sisa" <= "saldo_buku" AND "nilai_sisa_lama" >= 0);
-- Paling banyak satu revisi yang menunggu Owner per opname.
CREATE UNIQUE INDEX "revisi_opname_satu_menunggu" ON "revisi_opname"("id_opname") WHERE "status" = 'DIAJUKAN';
