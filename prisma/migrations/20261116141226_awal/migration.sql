-- CreateEnum
CREATE TYPE "Peran" AS ENUM ('ADMIN', 'HRD', 'OWNER');

-- CreateEnum
CREATE TYPE "StatusPersetujuan" AS ENUM ('DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK');

-- CreateEnum
CREATE TYPE "StatusPembelian" AS ENUM ('DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DIBALIK');

-- CreateEnum
CREATE TYPE "TipeAkun" AS ENUM ('ASET', 'KONTRA_ASET', 'LIABILITAS', 'EKUITAS', 'PENDAPATAN', 'BEBAN');

-- CreateEnum
CREATE TYPE "SaldoNormal" AS ENUM ('D', 'K');

-- CreateEnum
CREATE TYPE "JenisJurnal" AS ENUM ('UMUM', 'PENYESUAIAN', 'PEMBALIK');

-- CreateEnum
CREATE TYPE "SumberJurnal" AS ENUM ('SALDO_AWAL', 'PEMBELIAN', 'PENYUSUTAN', 'OPNAME', 'PELEPASAN', 'PENGGAJIAN');

-- CreateEnum
CREATE TYPE "StatusPeriode" AS ENUM ('TERBUKA', 'TERKUNCI');

-- CreateEnum
CREATE TYPE "AksiPeriode" AS ENUM ('KUNCI', 'BUKA');

-- CreateEnum
CREATE TYPE "JenisPembelian" AS ENUM ('PERALATAN', 'PERLENGKAPAN');

-- CreateEnum
CREATE TYPE "CaraBayar" AS ENUM ('TUNAI', 'KREDIT', 'INVESTASI');

-- CreateEnum
CREATE TYPE "DasarN" AS ENUM ('GARANSI', 'MASA_MANFAAT');

-- CreateEnum
CREATE TYPE "StatusAset" AS ENUM ('AKTIF', 'DILEPAS', 'BATAL');

-- CreateEnum
CREATE TYPE "AlasanPelepasan" AS ENUM ('DIJUAL', 'DIBUANG', 'HILANG');

-- CreateEnum
CREATE TYPE "StatusPtkp" AS ENUM ('TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3');

-- CreateEnum
CREATE TYPE "Absensi" AS ENUM ('HADIR', 'IZIN', 'SAKIT', 'CUTI', 'ALPA');

-- CreateTable
CREATE TABLE "pengguna" (
    "id" SERIAL NOT NULL,
    "nama_pengguna" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kata_sandi_hash" TEXT NOT NULL,
    "peran" "Peran" NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengguna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesi" (
    "id" SERIAL NOT NULL,
    "token_hash" TEXT NOT NULL,
    "pengguna_id" INTEGER NOT NULL,
    "kedaluwarsa" TIMESTAMP(3) NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_aktivitas" (
    "id" SERIAL NOT NULL,
    "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pengguna_id" INTEGER,
    "aksi" TEXT NOT NULL,
    "entitas" TEXT NOT NULL,
    "entitas_id" TEXT,
    "keterangan" TEXT,

    CONSTRAINT "log_aktivitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profil_usaha" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nama" TEXT NOT NULL,
    "keterangan" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "profil_usaha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penghitung" (
    "kunci" TEXT NOT NULL,
    "nilai" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "penghitung_pkey" PRIMARY KEY ("kunci")
);

-- CreateTable
CREATE TABLE "akun" (
    "kode_akun" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tipe" "TipeAkun" NOT NULL,
    "saldo_normal" "SaldoNormal" NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "akun_pkey" PRIMARY KEY ("kode_akun")
);

-- CreateTable
CREATE TABLE "periode" (
    "periode" TEXT NOT NULL,
    "status" "StatusPeriode" NOT NULL DEFAULT 'TERBUKA',
    "dikunci_oleh" INTEGER,
    "dikunci_pada" TIMESTAMP(3),

    CONSTRAINT "periode_pkey" PRIMARY KEY ("periode")
);

-- CreateTable
CREATE TABLE "riwayat_periode" (
    "id" SERIAL NOT NULL,
    "periode" TEXT NOT NULL,
    "aksi" "AksiPeriode" NOT NULL,
    "oleh" INTEGER NOT NULL,
    "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alasan" TEXT,

    CONSTRAINT "riwayat_periode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jurnal" (
    "no_jurnal" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "periode" TEXT NOT NULL,
    "jenis" "JenisJurnal" NOT NULL,
    "keterangan" TEXT NOT NULL,
    "status" "StatusPersetujuan" NOT NULL DEFAULT 'DRAFT',
    "alasan_tolak" TEXT,
    "sumber_tipe" "SumberJurnal",
    "sumber_id" TEXT,
    "pembalik_dari" TEXT,
    "dibuat_oleh" INTEGER NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diajukan_pada" TIMESTAMP(3),
    "disetujui_oleh" INTEGER,
    "disetujui_pada" TIMESTAMP(3),

    CONSTRAINT "jurnal_pkey" PRIMARY KEY ("no_jurnal")
);

-- CreateTable
CREATE TABLE "detail_jurnal" (
    "no_jurnal" TEXT NOT NULL,
    "no_urut" INTEGER NOT NULL,
    "kode_akun" TEXT NOT NULL,
    "debit" INTEGER NOT NULL DEFAULT 0,
    "kredit" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "detail_jurnal_pkey" PRIMARY KEY ("no_jurnal","no_urut")
);

-- CreateTable
CREATE TABLE "supplier" (
    "id_supplier" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "alamat" TEXT NOT NULL DEFAULT '',
    "telepon" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "npwp" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id_supplier")
);

-- CreateTable
CREATE TABLE "kategori_aset" (
    "id_kategori" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "masa_manfaat_bulan" INTEGER NOT NULL,
    "persen_residu" INTEGER NOT NULL DEFAULT 0,
    "akun_aset" TEXT NOT NULL,
    "akun_akumulasi" TEXT NOT NULL,
    "akun_beban" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "kategori_aset_pkey" PRIMARY KEY ("id_kategori")
);

-- CreateTable
CREATE TABLE "peralatan" (
    "id_peralatan" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "satuan" TEXT NOT NULL,
    "id_kategori" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "peralatan_pkey" PRIMARY KEY ("id_peralatan")
);

-- CreateTable
CREATE TABLE "perlengkapan" (
    "id_perlengkapan" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "satuan" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "perlengkapan_pkey" PRIMARY KEY ("id_perlengkapan")
);

-- CreateTable
CREATE TABLE "pembelian" (
    "no_pembelian" TEXT NOT NULL,
    "jenis" "JenisPembelian" NOT NULL,
    "tanggal" DATE NOT NULL,
    "id_supplier" TEXT,
    "cara_bayar" "CaraBayar" NOT NULL,
    "jatuh_tempo" DATE,
    "keterangan" TEXT NOT NULL DEFAULT '',
    "total" INTEGER NOT NULL,
    "status" "StatusPembelian" NOT NULL DEFAULT 'DRAFT',
    "alasan_tolak" TEXT,
    "jurnal_no" TEXT,
    "jurnal_pembalik" TEXT,
    "alasan_balik" TEXT,
    "dibuat_oleh" INTEGER NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,
    "disetujui_oleh" INTEGER,
    "disetujui_pada" TIMESTAMP(3),
    "dibalik_oleh" INTEGER,
    "dibalik_pada" TIMESTAMP(3),

    CONSTRAINT "pembelian_pkey" PRIMARY KEY ("no_pembelian")
);

-- CreateTable
CREATE TABLE "detail_pembelian" (
    "no_pembelian" TEXT NOT NULL,
    "no_urut" INTEGER NOT NULL,
    "id_peralatan" TEXT,
    "id_perlengkapan" TEXT,
    "qty" INTEGER NOT NULL,
    "harga" INTEGER NOT NULL,
    "residu" INTEGER,
    "garansi_bulan" INTEGER,
    "masa_manfaat_bulan" INTEGER,
    "dasar_n" "DasarN",

    CONSTRAINT "detail_pembelian_pkey" PRIMARY KEY ("no_pembelian","no_urut")
);

-- CreateTable
CREATE TABLE "aset" (
    "id_aset" TEXT NOT NULL,
    "no_pembelian" TEXT NOT NULL,
    "no_urut" INTEGER NOT NULL,
    "id_peralatan" TEXT NOT NULL,
    "id_kategori" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tgl_perolehan" DATE NOT NULL,
    "bulan_mulai" TEXT NOT NULL,
    "nilai_perolehan" INTEGER NOT NULL,
    "residu" INTEGER NOT NULL,
    "garansi_bulan" INTEGER NOT NULL,
    "garansi_sampai" DATE,
    "masa_manfaat_bulan" INTEGER NOT NULL,
    "dasar_n" "DasarN" NOT NULL,
    "n" INTEGER NOT NULL,
    "d" INTEGER NOT NULL,
    "terakhir" INTEGER NOT NULL,
    "pengaman" BOOLEAN NOT NULL DEFAULT false,
    "akun_aset" TEXT NOT NULL,
    "akun_akumulasi" TEXT NOT NULL,
    "akun_beban" TEXT NOT NULL,
    "status" "StatusAset" NOT NULL DEFAULT 'AKTIF',
    "tanggal_lepas" DATE,

    CONSTRAINT "aset_pkey" PRIMARY KEY ("id_aset")
);

-- CreateTable
CREATE TABLE "jadwal_penyusutan" (
    "id_aset" TEXT NOT NULL,
    "periode_ke" INTEGER NOT NULL,
    "periode" TEXT NOT NULL,
    "beban" INTEGER NOT NULL,
    "akumulasi" INTEGER NOT NULL,
    "nilai_buku" INTEGER NOT NULL,
    "jurnal_no" TEXT,

    CONSTRAINT "jadwal_penyusutan_pkey" PRIMARY KEY ("id_aset","periode_ke")
);

-- CreateTable
CREATE TABLE "opname" (
    "id_opname" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "total_beban" INTEGER NOT NULL,
    "status" "StatusPersetujuan" NOT NULL DEFAULT 'DRAFT',
    "alasan_tolak" TEXT,
    "jurnal_no" TEXT,
    "dibuat_oleh" INTEGER NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disetujui_oleh" INTEGER,
    "disetujui_pada" TIMESTAMP(3),

    CONSTRAINT "opname_pkey" PRIMARY KEY ("id_opname")
);

-- CreateTable
CREATE TABLE "detail_opname" (
    "id_opname" TEXT NOT NULL,
    "id_perlengkapan" TEXT NOT NULL,
    "saldo_buku" INTEGER NOT NULL,
    "nilai_sisa" INTEGER NOT NULL,

    CONSTRAINT "detail_opname_pkey" PRIMARY KEY ("id_opname","id_perlengkapan")
);

-- CreateTable
CREATE TABLE "pelepasan" (
    "no_pelepasan" TEXT NOT NULL,
    "id_aset" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "alasan" "AlasanPelepasan" NOT NULL,
    "harga_jual" INTEGER NOT NULL DEFAULT 0,
    "nilai_perolehan" INTEGER NOT NULL,
    "akumulasi" INTEGER NOT NULL,
    "nilai_buku" INTEGER NOT NULL,
    "laba_rugi" INTEGER NOT NULL,
    "status" "StatusPersetujuan" NOT NULL DEFAULT 'DIAJUKAN',
    "alasan_tolak" TEXT,
    "jurnal_no" TEXT,
    "dibuat_oleh" INTEGER NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disetujui_oleh" INTEGER,
    "disetujui_pada" TIMESTAMP(3),

    CONSTRAINT "pelepasan_pkey" PRIMARY KEY ("no_pelepasan")
);

-- CreateTable
CREATE TABLE "karyawan" (
    "id_karyawan" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "status_ptkp" "StatusPtkp" NOT NULL,
    "bank" TEXT NOT NULL,
    "no_rek" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "karyawan_pkey" PRIMARY KEY ("id_karyawan")
);

-- CreateTable
CREATE TABLE "jabatan" (
    "id_jabatan" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tunj_jabatan" INTEGER NOT NULL DEFAULT 0,
    "tunj_keluarga" INTEGER NOT NULL DEFAULT 0,
    "akun_beban" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "jabatan_pkey" PRIMARY KEY ("id_jabatan")
);

-- CreateTable
CREATE TABLE "golongan" (
    "id_golongan" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "golongan_pkey" PRIMARY KEY ("id_golongan")
);

-- CreateTable
CREATE TABLE "tunjangan" (
    "id_tunjangan" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "nominal" INTEGER NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tunjangan_pkey" PRIMARY KEY ("id_tunjangan")
);

-- CreateTable
CREATE TABLE "jadwal_kerja" (
    "id_jadwal" TEXT NOT NULL,
    "id_jabatan" TEXT NOT NULL,
    "jam_masuk" TEXT NOT NULL,
    "jam_keluar" TEXT NOT NULL,
    "hari_kerja" INTEGER NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "jadwal_kerja_pkey" PRIMARY KEY ("id_jadwal")
);

-- CreateTable
CREATE TABLE "setting_gaji" (
    "id_setting" TEXT NOT NULL,
    "id_karyawan" TEXT NOT NULL,
    "id_jabatan" TEXT NOT NULL,
    "id_golongan" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "setting_gaji_pkey" PRIMARY KEY ("id_setting")
);

-- CreateTable
CREATE TABLE "setting_tunjangan" (
    "id_setting" TEXT NOT NULL,
    "id_tunjangan" TEXT NOT NULL,

    CONSTRAINT "setting_tunjangan_pkey" PRIMARY KEY ("id_setting","id_tunjangan")
);

-- CreateTable
CREATE TABLE "presensi" (
    "id_presensi" SERIAL NOT NULL,
    "id_karyawan" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "id_jadwal" TEXT NOT NULL,
    "absensi" "Absensi" NOT NULL,
    "jam_masuk" TEXT,
    "jam_keluar" TEXT,
    "terlambat" INTEGER NOT NULL DEFAULT 0,
    "dibuat_oleh" INTEGER NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presensi_pkey" PRIMARY KEY ("id_presensi")
);

-- CreateTable
CREATE TABLE "slip_gaji" (
    "id_slip" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "id_karyawan" TEXT NOT NULL,
    "id_jabatan" TEXT NOT NULL,
    "id_golongan" TEXT NOT NULL,
    "id_jadwal" TEXT,
    "akun_beban" TEXT NOT NULL,
    "status_ptkp" "StatusPtkp" NOT NULL,
    "hari_kerja" INTEGER NOT NULL,
    "jumlah_presensi" INTEGER NOT NULL,
    "hadir" INTEGER NOT NULL,
    "izin" INTEGER NOT NULL,
    "sakit" INTEGER NOT NULL,
    "cuti" INTEGER NOT NULL,
    "alpa" INTEGER NOT NULL,
    "jam_kerja" DOUBLE PRECISION NOT NULL,
    "terlambat_menit" INTEGER NOT NULL,
    "gaji_pokok" INTEGER NOT NULL,
    "tunj_jabatan" INTEGER NOT NULL,
    "tunj_keluarga" INTEGER NOT NULL,
    "tunj_lain" INTEGER NOT NULL,
    "potongan_absen" INTEGER NOT NULL,
    "bruto" INTEGER NOT NULL,
    "bruto_setahun" INTEGER NOT NULL,
    "biaya_jabatan" INTEGER NOT NULL,
    "neto_setahun" INTEGER NOT NULL,
    "ptkp" INTEGER NOT NULL,
    "pkp" INTEGER NOT NULL,
    "pph_setahun" INTEGER NOT NULL,
    "pph21" INTEGER NOT NULL,
    "thp" INTEGER NOT NULL,
    "status" "StatusPersetujuan" NOT NULL DEFAULT 'DRAFT',
    "alasan_tolak" TEXT,
    "no_penggajian" TEXT,
    "dibuat_oleh" INTEGER NOT NULL,
    "dihitung_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disetujui_oleh" INTEGER,
    "disetujui_pada" TIMESTAMP(3),

    CONSTRAINT "slip_gaji_pkey" PRIMARY KEY ("id_slip")
);

-- CreateTable
CREATE TABLE "slip_tunjangan" (
    "id_slip" TEXT NOT NULL,
    "id_tunjangan" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "nominal" INTEGER NOT NULL,

    CONSTRAINT "slip_tunjangan_pkey" PRIMARY KEY ("id_slip","id_tunjangan")
);

-- CreateTable
CREATE TABLE "penggajian" (
    "no_penggajian" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "jumlah_slip" INTEGER NOT NULL,
    "total_bruto" INTEGER NOT NULL,
    "total_pph" INTEGER NOT NULL,
    "total_thp" INTEGER NOT NULL,
    "status" "StatusPersetujuan" NOT NULL DEFAULT 'DIAJUKAN',
    "alasan_tolak" TEXT,
    "jurnal_no" TEXT,
    "dibuat_oleh" INTEGER NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disetujui_oleh" INTEGER,
    "disetujui_pada" TIMESTAMP(3),

    CONSTRAINT "penggajian_pkey" PRIMARY KEY ("no_penggajian")
);

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_nama_pengguna_key" ON "pengguna"("nama_pengguna");

-- CreateIndex
CREATE UNIQUE INDEX "sesi_token_hash_key" ON "sesi"("token_hash");

-- CreateIndex
CREATE INDEX "sesi_pengguna_id_idx" ON "sesi"("pengguna_id");

-- CreateIndex
CREATE INDEX "log_aktivitas_waktu_idx" ON "log_aktivitas"("waktu");

-- CreateIndex
CREATE INDEX "log_aktivitas_entitas_entitas_id_idx" ON "log_aktivitas"("entitas", "entitas_id");

-- CreateIndex
CREATE INDEX "riwayat_periode_periode_idx" ON "riwayat_periode"("periode");

-- CreateIndex
CREATE UNIQUE INDEX "jurnal_pembalik_dari_key" ON "jurnal"("pembalik_dari");

-- CreateIndex
CREATE INDEX "jurnal_periode_status_idx" ON "jurnal"("periode", "status");

-- CreateIndex
CREATE INDEX "jurnal_jenis_status_idx" ON "jurnal"("jenis", "status");

-- CreateIndex
CREATE INDEX "jurnal_sumber_tipe_sumber_id_idx" ON "jurnal"("sumber_tipe", "sumber_id");

-- CreateIndex
CREATE INDEX "detail_jurnal_kode_akun_idx" ON "detail_jurnal"("kode_akun");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_npwp_key" ON "supplier"("npwp");

-- CreateIndex
CREATE UNIQUE INDEX "pembelian_jurnal_no_key" ON "pembelian"("jurnal_no");

-- CreateIndex
CREATE UNIQUE INDEX "pembelian_jurnal_pembalik_key" ON "pembelian"("jurnal_pembalik");

-- CreateIndex
CREATE INDEX "pembelian_jenis_status_idx" ON "pembelian"("jenis", "status");

-- CreateIndex
CREATE INDEX "pembelian_tanggal_idx" ON "pembelian"("tanggal");

-- CreateIndex
CREATE INDEX "aset_status_idx" ON "aset"("status");

-- CreateIndex
CREATE INDEX "aset_no_pembelian_idx" ON "aset"("no_pembelian");

-- CreateIndex
CREATE INDEX "jadwal_penyusutan_periode_idx" ON "jadwal_penyusutan"("periode");

-- CreateIndex
CREATE INDEX "jadwal_penyusutan_jurnal_no_idx" ON "jadwal_penyusutan"("jurnal_no");

-- CreateIndex
CREATE UNIQUE INDEX "opname_periode_key" ON "opname"("periode");

-- CreateIndex
CREATE UNIQUE INDEX "opname_jurnal_no_key" ON "opname"("jurnal_no");

-- CreateIndex
CREATE UNIQUE INDEX "pelepasan_jurnal_no_key" ON "pelepasan"("jurnal_no");

-- CreateIndex
CREATE INDEX "pelepasan_id_aset_status_idx" ON "pelepasan"("id_aset", "status");

-- CreateIndex
CREATE UNIQUE INDEX "jadwal_kerja_id_jabatan_key" ON "jadwal_kerja"("id_jabatan");

-- CreateIndex
CREATE UNIQUE INDEX "setting_gaji_id_karyawan_key" ON "setting_gaji"("id_karyawan");

-- CreateIndex
CREATE INDEX "presensi_tanggal_idx" ON "presensi"("tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "presensi_id_karyawan_tanggal_key" ON "presensi"("id_karyawan", "tanggal");

-- CreateIndex
CREATE INDEX "slip_gaji_no_penggajian_idx" ON "slip_gaji"("no_penggajian");

-- CreateIndex
CREATE UNIQUE INDEX "slip_gaji_periode_id_karyawan_key" ON "slip_gaji"("periode", "id_karyawan");

-- CreateIndex
CREATE UNIQUE INDEX "penggajian_jurnal_no_key" ON "penggajian"("jurnal_no");

-- CreateIndex
CREATE INDEX "penggajian_periode_status_idx" ON "penggajian"("periode", "status");

-- AddForeignKey
ALTER TABLE "sesi" ADD CONSTRAINT "sesi_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_aktivitas" ADD CONSTRAINT "log_aktivitas_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periode" ADD CONSTRAINT "periode_dikunci_oleh_fkey" FOREIGN KEY ("dikunci_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_periode" ADD CONSTRAINT "riwayat_periode_periode_fkey" FOREIGN KEY ("periode") REFERENCES "periode"("periode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riwayat_periode" ADD CONSTRAINT "riwayat_periode_oleh_fkey" FOREIGN KEY ("oleh") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jurnal" ADD CONSTRAINT "jurnal_periode_fkey" FOREIGN KEY ("periode") REFERENCES "periode"("periode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jurnal" ADD CONSTRAINT "jurnal_pembalik_dari_fkey" FOREIGN KEY ("pembalik_dari") REFERENCES "jurnal"("no_jurnal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jurnal" ADD CONSTRAINT "jurnal_dibuat_oleh_fkey" FOREIGN KEY ("dibuat_oleh") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jurnal" ADD CONSTRAINT "jurnal_disetujui_oleh_fkey" FOREIGN KEY ("disetujui_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_jurnal" ADD CONSTRAINT "detail_jurnal_no_jurnal_fkey" FOREIGN KEY ("no_jurnal") REFERENCES "jurnal"("no_jurnal") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_jurnal" ADD CONSTRAINT "detail_jurnal_kode_akun_fkey" FOREIGN KEY ("kode_akun") REFERENCES "akun"("kode_akun") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kategori_aset" ADD CONSTRAINT "kategori_aset_akun_aset_fkey" FOREIGN KEY ("akun_aset") REFERENCES "akun"("kode_akun") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kategori_aset" ADD CONSTRAINT "kategori_aset_akun_akumulasi_fkey" FOREIGN KEY ("akun_akumulasi") REFERENCES "akun"("kode_akun") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kategori_aset" ADD CONSTRAINT "kategori_aset_akun_beban_fkey" FOREIGN KEY ("akun_beban") REFERENCES "akun"("kode_akun") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peralatan" ADD CONSTRAINT "peralatan_id_kategori_fkey" FOREIGN KEY ("id_kategori") REFERENCES "kategori_aset"("id_kategori") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembelian" ADD CONSTRAINT "pembelian_id_supplier_fkey" FOREIGN KEY ("id_supplier") REFERENCES "supplier"("id_supplier") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembelian" ADD CONSTRAINT "pembelian_jurnal_no_fkey" FOREIGN KEY ("jurnal_no") REFERENCES "jurnal"("no_jurnal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembelian" ADD CONSTRAINT "pembelian_jurnal_pembalik_fkey" FOREIGN KEY ("jurnal_pembalik") REFERENCES "jurnal"("no_jurnal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembelian" ADD CONSTRAINT "pembelian_dibuat_oleh_fkey" FOREIGN KEY ("dibuat_oleh") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembelian" ADD CONSTRAINT "pembelian_disetujui_oleh_fkey" FOREIGN KEY ("disetujui_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembelian" ADD CONSTRAINT "pembelian_dibalik_oleh_fkey" FOREIGN KEY ("dibalik_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_pembelian" ADD CONSTRAINT "detail_pembelian_no_pembelian_fkey" FOREIGN KEY ("no_pembelian") REFERENCES "pembelian"("no_pembelian") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_pembelian" ADD CONSTRAINT "detail_pembelian_id_peralatan_fkey" FOREIGN KEY ("id_peralatan") REFERENCES "peralatan"("id_peralatan") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_pembelian" ADD CONSTRAINT "detail_pembelian_id_perlengkapan_fkey" FOREIGN KEY ("id_perlengkapan") REFERENCES "perlengkapan"("id_perlengkapan") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aset" ADD CONSTRAINT "aset_no_pembelian_no_urut_fkey" FOREIGN KEY ("no_pembelian", "no_urut") REFERENCES "detail_pembelian"("no_pembelian", "no_urut") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aset" ADD CONSTRAINT "aset_id_peralatan_fkey" FOREIGN KEY ("id_peralatan") REFERENCES "peralatan"("id_peralatan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aset" ADD CONSTRAINT "aset_id_kategori_fkey" FOREIGN KEY ("id_kategori") REFERENCES "kategori_aset"("id_kategori") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aset" ADD CONSTRAINT "aset_akun_aset_fkey" FOREIGN KEY ("akun_aset") REFERENCES "akun"("kode_akun") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aset" ADD CONSTRAINT "aset_akun_akumulasi_fkey" FOREIGN KEY ("akun_akumulasi") REFERENCES "akun"("kode_akun") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aset" ADD CONSTRAINT "aset_akun_beban_fkey" FOREIGN KEY ("akun_beban") REFERENCES "akun"("kode_akun") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_penyusutan" ADD CONSTRAINT "jadwal_penyusutan_id_aset_fkey" FOREIGN KEY ("id_aset") REFERENCES "aset"("id_aset") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_penyusutan" ADD CONSTRAINT "jadwal_penyusutan_periode_fkey" FOREIGN KEY ("periode") REFERENCES "periode"("periode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_penyusutan" ADD CONSTRAINT "jadwal_penyusutan_jurnal_no_fkey" FOREIGN KEY ("jurnal_no") REFERENCES "jurnal"("no_jurnal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opname" ADD CONSTRAINT "opname_periode_fkey" FOREIGN KEY ("periode") REFERENCES "periode"("periode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opname" ADD CONSTRAINT "opname_jurnal_no_fkey" FOREIGN KEY ("jurnal_no") REFERENCES "jurnal"("no_jurnal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opname" ADD CONSTRAINT "opname_dibuat_oleh_fkey" FOREIGN KEY ("dibuat_oleh") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opname" ADD CONSTRAINT "opname_disetujui_oleh_fkey" FOREIGN KEY ("disetujui_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_opname" ADD CONSTRAINT "detail_opname_id_opname_fkey" FOREIGN KEY ("id_opname") REFERENCES "opname"("id_opname") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_opname" ADD CONSTRAINT "detail_opname_id_perlengkapan_fkey" FOREIGN KEY ("id_perlengkapan") REFERENCES "perlengkapan"("id_perlengkapan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pelepasan" ADD CONSTRAINT "pelepasan_id_aset_fkey" FOREIGN KEY ("id_aset") REFERENCES "aset"("id_aset") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pelepasan" ADD CONSTRAINT "pelepasan_jurnal_no_fkey" FOREIGN KEY ("jurnal_no") REFERENCES "jurnal"("no_jurnal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pelepasan" ADD CONSTRAINT "pelepasan_dibuat_oleh_fkey" FOREIGN KEY ("dibuat_oleh") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pelepasan" ADD CONSTRAINT "pelepasan_disetujui_oleh_fkey" FOREIGN KEY ("disetujui_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jabatan" ADD CONSTRAINT "jabatan_akun_beban_fkey" FOREIGN KEY ("akun_beban") REFERENCES "akun"("kode_akun") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_kerja" ADD CONSTRAINT "jadwal_kerja_id_jabatan_fkey" FOREIGN KEY ("id_jabatan") REFERENCES "jabatan"("id_jabatan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setting_gaji" ADD CONSTRAINT "setting_gaji_id_karyawan_fkey" FOREIGN KEY ("id_karyawan") REFERENCES "karyawan"("id_karyawan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setting_gaji" ADD CONSTRAINT "setting_gaji_id_jabatan_fkey" FOREIGN KEY ("id_jabatan") REFERENCES "jabatan"("id_jabatan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setting_gaji" ADD CONSTRAINT "setting_gaji_id_golongan_fkey" FOREIGN KEY ("id_golongan") REFERENCES "golongan"("id_golongan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setting_tunjangan" ADD CONSTRAINT "setting_tunjangan_id_setting_fkey" FOREIGN KEY ("id_setting") REFERENCES "setting_gaji"("id_setting") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setting_tunjangan" ADD CONSTRAINT "setting_tunjangan_id_tunjangan_fkey" FOREIGN KEY ("id_tunjangan") REFERENCES "tunjangan"("id_tunjangan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presensi" ADD CONSTRAINT "presensi_id_karyawan_fkey" FOREIGN KEY ("id_karyawan") REFERENCES "karyawan"("id_karyawan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presensi" ADD CONSTRAINT "presensi_id_jadwal_fkey" FOREIGN KEY ("id_jadwal") REFERENCES "jadwal_kerja"("id_jadwal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presensi" ADD CONSTRAINT "presensi_dibuat_oleh_fkey" FOREIGN KEY ("dibuat_oleh") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_gaji" ADD CONSTRAINT "slip_gaji_periode_fkey" FOREIGN KEY ("periode") REFERENCES "periode"("periode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_gaji" ADD CONSTRAINT "slip_gaji_id_karyawan_fkey" FOREIGN KEY ("id_karyawan") REFERENCES "karyawan"("id_karyawan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_gaji" ADD CONSTRAINT "slip_gaji_id_jabatan_fkey" FOREIGN KEY ("id_jabatan") REFERENCES "jabatan"("id_jabatan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_gaji" ADD CONSTRAINT "slip_gaji_id_golongan_fkey" FOREIGN KEY ("id_golongan") REFERENCES "golongan"("id_golongan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_gaji" ADD CONSTRAINT "slip_gaji_id_jadwal_fkey" FOREIGN KEY ("id_jadwal") REFERENCES "jadwal_kerja"("id_jadwal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_gaji" ADD CONSTRAINT "slip_gaji_akun_beban_fkey" FOREIGN KEY ("akun_beban") REFERENCES "akun"("kode_akun") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_gaji" ADD CONSTRAINT "slip_gaji_no_penggajian_fkey" FOREIGN KEY ("no_penggajian") REFERENCES "penggajian"("no_penggajian") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_gaji" ADD CONSTRAINT "slip_gaji_dibuat_oleh_fkey" FOREIGN KEY ("dibuat_oleh") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_gaji" ADD CONSTRAINT "slip_gaji_disetujui_oleh_fkey" FOREIGN KEY ("disetujui_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_tunjangan" ADD CONSTRAINT "slip_tunjangan_id_slip_fkey" FOREIGN KEY ("id_slip") REFERENCES "slip_gaji"("id_slip") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_tunjangan" ADD CONSTRAINT "slip_tunjangan_id_tunjangan_fkey" FOREIGN KEY ("id_tunjangan") REFERENCES "tunjangan"("id_tunjangan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penggajian" ADD CONSTRAINT "penggajian_periode_fkey" FOREIGN KEY ("periode") REFERENCES "periode"("periode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penggajian" ADD CONSTRAINT "penggajian_jurnal_no_fkey" FOREIGN KEY ("jurnal_no") REFERENCES "jurnal"("no_jurnal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penggajian" ADD CONSTRAINT "penggajian_dibuat_oleh_fkey" FOREIGN KEY ("dibuat_oleh") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penggajian" ADD CONSTRAINT "penggajian_disetujui_oleh_fkey" FOREIGN KEY ("disetujui_oleh") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ======================================================================
-- Aturan tambahan yang tidak bisa ditulis di schema.prisma (ditambah manual).
-- ======================================================================

-- Satu baris jurnal berisi debit ATAU kredit, tidak boleh negatif.
ALTER TABLE "detail_jurnal" ADD CONSTRAINT "detail_jurnal_debit_atau_kredit"
  CHECK ("debit" >= 0 AND "kredit" >= 0 AND ("debit" > 0) <> ("kredit" > 0));

-- Baris pembelian menunjuk tepat satu barang: peralatan atau perlengkapan.
ALTER TABLE "detail_pembelian" ADD CONSTRAINT "detail_pembelian_satu_barang"
  CHECK (("id_peralatan" IS NULL) <> ("id_perlengkapan" IS NULL));
ALTER TABLE "detail_pembelian" ADD CONSTRAINT "detail_pembelian_angka_positif"
  CHECK ("qty" >= 1 AND "harga" > 0);

-- Periode berbentuk YYYY-MM.
ALTER TABLE "periode" ADD CONSTRAINT "periode_format" CHECK ("periode" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- Nilai residu lebih kecil dari harga perolehan, n minimal 1.
ALTER TABLE "aset" ADD CONSTRAINT "aset_residu_n" CHECK ("residu" >= 0 AND "residu" < "nilai_perolehan" AND "n" >= 1);

-- Nilai sisa opname 0 sampai saldo buku.
ALTER TABLE "detail_opname" ADD CONSTRAINT "detail_opname_nilai_sisa" CHECK ("nilai_sisa" >= 0 AND "nilai_sisa" <= "saldo_buku");
