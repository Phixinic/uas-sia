-- Gaji Bulanan (masukan dosen): Hitung Gaji dan Distribusi digabung; potongan dan bonus manual; upah event inhouse di slip.
-- CreateEnum
CREATE TYPE "JenisPenyesuaianGaji" AS ENUM ('POTONGAN', 'BONUS');

-- AlterTable
ALTER TABLE "slip_gaji" ADD COLUMN     "bonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gaji_tetap" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "potongan_lain" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "upah_event" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "penyesuaian_gaji" (
    "id_penyesuaian" SERIAL NOT NULL,
    "periode" TEXT NOT NULL,
    "id_karyawan" TEXT NOT NULL,
    "jenis" "JenisPenyesuaianGaji" NOT NULL,
    "nominal" INTEGER NOT NULL,
    "keterangan" TEXT NOT NULL,
    "dibuat_oleh" INTEGER NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penyesuaian_gaji_pkey" PRIMARY KEY ("id_penyesuaian")
);

-- CreateIndex
CREATE INDEX "penyesuaian_gaji_periode_id_karyawan_idx" ON "penyesuaian_gaji"("periode", "id_karyawan");

-- AddForeignKey
ALTER TABLE "penyesuaian_gaji" ADD CONSTRAINT "penyesuaian_gaji_periode_fkey" FOREIGN KEY ("periode") REFERENCES "periode"("periode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penyesuaian_gaji" ADD CONSTRAINT "penyesuaian_gaji_id_karyawan_fkey" FOREIGN KEY ("id_karyawan") REFERENCES "karyawan"("id_karyawan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penyesuaian_gaji" ADD CONSTRAINT "penyesuaian_gaji_dibuat_oleh_fkey" FOREIGN KEY ("dibuat_oleh") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Slip lama: seluruh bruto adalah gaji tetap (belum ada upah event, bonus, dan potongan manual). Nilai slip tidak berubah.
UPDATE "slip_gaji" SET "gaji_tetap" = "bruto";

ALTER TABLE "slip_gaji" ADD CONSTRAINT "slip_gaji_komponen" CHECK (
  "upah_event" >= 0 AND "bonus" >= 0 AND "potongan_lain" >= 0
  AND "bruto" = "gaji_tetap" + "upah_event" + "bonus"
  AND "thp" = "bruto" - "pph21" - "potongan_lain"
);
ALTER TABLE "penyesuaian_gaji" ADD CONSTRAINT "penyesuaian_gaji_isi" CHECK ("nominal" > 0 AND length(btrim("keterangan")) > 0);
