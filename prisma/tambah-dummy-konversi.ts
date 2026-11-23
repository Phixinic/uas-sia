/*
 * Menambah data dummy siklus konversi (peralatan dan perlengkapan) ke database yang sudah berisi (produksi):
 * - master: 6 supplier, 3 kategori aset (Panggung & Rigging, Layar & Multimedia, Genset & Kelistrikan; semuanya memakai
 *   akun 1-150, 1-151, dan 6-110 seperti kategori lama), 15 peralatan, 13 perlengkapan;
 * - 22 pembelian Oktober sampai Desember 2026: tunai, kredit, dan investasi; DRAFT (rencana Desember), DISETUJUI
 *   (diposting Admin atau Owner), dan 2 DIBALIK lewat jurnal pembalik beserta alasannya; sebagian multi-baris;
 * - kartu aset dan jadwal penyusutan dari pembelian peralatan yang diposting (residu beragam, dasar n garansi atau masa
 *   manfaat);
 * - penyusutan November: jurnal pertama diajukan lalu disetujui Owner, jurnal kedua (pembelian proyektor yang diposting
 *   sesudahnya) diajukan dan masih menunggu Owner. Desember belum bisa diproses karena periodenya belum berjalan;
 * - nilai sisa perlengkapan November: input pertama ditolak Owner, diinput ulang, lalu disetujui;
 * - pelepasan: dijual dengan laba (disetujui), dijual dengan rugi (disetujui), dibuang (menunggu Owner).
 *
 * Data lama tidak diubah. Pengecualiannya langkah alur yang memang menyentuh data lama: proses penyusutan November
 * mengisi jurnal_no di baris jadwal November aset lama (AST-0001 sampai AST-0009), dan penghitung nomor naik.
 * PLP-2026-0001 (menunggu Owner) dan draf BP-2026-0007 dibiarkan apa adanya.
 *
 * Semua langkah meniru server action aplikasi (urutan cek, klaim status bersyarat, log) dan memakai rumus serta layanan
 * yang sama: validasi zod (skemaPembelian, skemaNilaiSisa, skemaAjukanPelepasan, skemaIsiMaster, ...), hitungJadwal,
 * nDariDasar, barisPembelian, barisPembalik, barisPenyusutan, barisOpname, barisPelepasan, hitungPelepasan,
 * akumulasiDisetujui, cekJadwalPelepasan, bahanNilaiSisa, tahanUrutanNilaiSisa, buatJurnal, ajukanJurnal, setujuiJurnal,
 * tolakJurnal, saldoAkun, nomorDokumen, kodeBerikutnya. Server action tidak bisa dipanggil langsung dari skrip karena butuh
 * cookie sesi Next dan masing-masing membuka transaksi sendiri.
 *
 * Tanggal dokumen dan waktu dibuat/disetujui memakai waktu simulasi (2 sampai 23 November 2026), jadi skrip menolak jalan
 * sebelum 23 November 2026 09:00 WIB. Jurnal pembalik bertanggal hari pembalikan di simulasi (aplikasi memakai hari ini).
 *
 * Semuanya dalam satu transaksi. Sebelum commit skrip memeriksa neraca saldo seimbang dan saldo kas tidak pernah negatif
 * (urut tanggal lalu nomor jurnal); bila gagal, semua dibatalkan. Skrip menolak jalan kedua kali (penanda di log aktivitas,
 * nama supplier baru, opname November, dan penyusutan November).
 *
 * Jalankan: npx tsx prisma/tambah-dummy-konversi.ts
 * Coba tanpa menyimpan (semua langkah dijalankan lalu dibatalkan): npx tsx prisma/tambah-dummy-konversi.ts --coba
 */
import "dotenv/config";
import { db, type Tx } from "../src/lib/server/db";
import { GalatAksi, validasi } from "../src/lib/server/aksi";
import { AWALAN, kodeBerikutnya, nomorDokumen, nomorOpname } from "../src/lib/server/nomor";
import { pastikanPeriode, pastikanTerbuka } from "../src/lib/server/periode";
import { ajukanJurnal, buatJurnal, muatJurnalBuku, saldoAkun, setujuiJurnal, tolakJurnal } from "../src/lib/server/jurnal";
import { catatLog } from "../src/lib/server/log";
import { AKUN } from "../src/lib/inti/akun";
import { barisOpname, barisPelepasan, barisPembalik, barisPembelian, barisPenyusutan, hitungPelepasan } from "../src/lib/inti/jurnal";
import { hitungJadwal, nDariDasar } from "../src/lib/inti/penyusutan";
import { neracaLajur, neracaSaldo } from "../src/lib/inti/buku-besar";
import { dariDate, hariTerakhir, keDate, labelPeriode, labelTanggal, periodeDari, periodeIni, tambahBulanTanggal } from "../src/lib/inti/tanggal";
import { LABEL_ALASAN_PELEPASAN, LABEL_CARA_BAYAR, LABEL_JENIS_PEMBELIAN } from "../src/lib/format";
import { skemaNoDanAlasan, skemaPembelian, type InputPembelian } from "../src/lib/skema/pembelian";
import { skemaAjukanPelepasan, skemaBarangCepat, skemaNilaiSisa, skemaProsesPenyusutan, skemaSupplierCepat } from "../src/lib/skema/konversi";
import { skemaIsiMaster } from "../src/lib/skema/master";
import { bahanNilaiSisa } from "../src/lib/data/konversi/nilai-sisa";
import { akumulasiDisetujui, cekJadwalPelepasan, tahanUrutanNilaiSisa } from "../src/lib/data/konversi/hitung";

const PENANDA = "data-dummy.konversi";
const PERIODE = "2026-11";
const COBA = process.argv.includes("--coba");
/** Waktu simulasi paling akhir; skrip menolak jalan sebelum waktu ini supaya tidak ada dokumen "dari masa depan". */
const WAKTU_TERAKHIR = "2026-11-23 09:00";

/** Waktu WIB: waktu("2026-10-05 10:00") -> Date. */
const waktu = (t: string) => new Date(`${t.replace(" ", "T")}:00+07:00`);

// ====================================================================== Rencana master

const SUPPLIER = [
  { kunci: "led", nama: "PT Visual LED Indonesia", alamat: "Jl. Rungkut Industri III No. 12, Surabaya", telepon: "031-8471234", email: "sales@visualled.co.id", npwp: "01.234.567.8-615.000" },
  { kunci: "rigging", nama: "CV Rigging Nusantara", alamat: "Jl. Mayjen Panjaitan No. 88, Malang", telepon: "0341-551234", email: "order@riggingnusantara.id", npwp: "02.345.678.9-623.000" },
  { kunci: "listrik", nama: "Toko Listrik Abadi Jaya", alamat: "Jl. Kyai Tamin No. 21, Malang", telepon: "0341-362211", email: "", npwp: "" },
  { kunci: "genset", nama: "PT Prima Genset Jatim", alamat: "Jl. Ahmad Yani No. 150, Sidoarjo", telepon: "031-8912345", email: "info@primagenset.co.id", npwp: "03.456.789.0-643.000" },
  { kunci: "elektronik", nama: "Toko Elektronik Kayutangan", alamat: "Jl. Basuki Rahmat No. 7, Malang", telepon: "0341-325566", email: "", npwp: "" },
];
/** Supplier yang ditambah Admin lewat tambah cepat di form pembelian (hanya nama dan telepon). */
const SUPPLIER_CEPAT = { kunci: "kamera", nama: "CV Kamera Pro Malang", telepon: "0812-3456-7788" };

const KATEGORI = [
  { kunci: "rigging", nama: "Panggung & Rigging", masaManfaatBulan: 96, persenResidu: 10 },
  { kunci: "multimedia", nama: "Layar & Multimedia", masaManfaatBulan: 48, persenResidu: 5 },
  { kunci: "listrik", nama: "Genset & Kelistrikan", masaManfaatBulan: 96, persenResidu: 10 },
];

/** kategori: kunci kategori baru atau kode kategori lama. */
const PERALATAN = [
  { kunci: "led", nama: "LED Screen Outdoor P3.9 (panel 50x50 cm)", satuan: "panel", kategori: "multimedia" },
  { kunci: "switcher", nama: "Video Switcher 4 Input", satuan: "unit", kategori: "multimedia" },
  { kunci: "proyektor", nama: "Proyektor 5000 Lumen", satuan: "unit", kategori: "multimedia" },
  { kunci: "truss", nama: "Truss Segitiga 3 m", satuan: "batang", kategori: "rigging" },
  { kunci: "hoist", nama: "Chain Hoist 1 Ton", satuan: "unit", kategori: "rigging" },
  { kunci: "panggung", nama: "Panggung Modular 1x2 m", satuan: "modul", kategori: "rigging" },
  { kunci: "genset", nama: "Genset Silent 20 kVA", satuan: "unit", kategori: "listrik" },
  { kunci: "panel", nama: "Panel Distribusi Listrik 3 Phase", satuan: "unit", kategori: "listrik" },
  { kunci: "mic", nama: "Wireless Mic Handheld (dual)", satuan: "set", kategori: "KAT-01" },
  { kunci: "par", nama: "Lampu Par LED 18x10W", satuan: "unit", kategori: "KAT-01" },
  { kunci: "smoke", nama: "Smoke Machine 1500W", satuan: "unit", kategori: "KAT-01" },
  { kunci: "dmx", nama: "Lighting Controller DMX 512", satuan: "unit", kategori: "KAT-01" },
  { kunci: "camcorder", nama: "Kamera Camcorder 4K", satuan: "unit", kategori: "KAT-02" },
  { kunci: "gimbal", nama: "Gimbal Stabilizer Kamera", satuan: "unit", kategori: "KAT-02" },
  { kunci: "lensa", nama: "Lensa Tele 70-200 mm", satuan: "unit", kategori: "KAT-02" },
];

const PERLENGKAPAN = [
  { kunci: "xlr", nama: "Kabel XLR 10 m", satuan: "utas" },
  { kunci: "konektor", nama: "Konektor XLR Neutrik", satuan: "pcs" },
  { kunci: "isolasi", nama: "Isolasi Listrik", satuan: "roll" },
  { kunci: "9v", nama: "Baterai 9V", satuan: "pak" },
  { kunci: "aaa", nama: "Baterai AAA", satuan: "pak" },
  { kunci: "gel", nama: "Gel Lighting (filter warna)", satuan: "lembar" },
  { kunci: "fog", nama: "Fog Fluid 5 Liter", satuan: "jeriken" },
  { kunci: "velcro", nama: "Velcro Cable Strap", satuan: "pak" },
  { kunci: "lantai", nama: "Lakban Lantai (floor marking)", satuan: "roll" },
  { kunci: "hdmi", nama: "Kabel HDMI 15 m", satuan: "utas" },
  { kunci: "terminal", nama: "Terminal Listrik 6 Lubang", satuan: "pcs" },
  { kunci: "ratchet", nama: "Ratchet Strap 5 m", satuan: "pcs" },
];
/** Perlengkapan yang ditambah Admin lewat tambah cepat di form pembelian. */
const PERLENGKAPAN_CEPAT = { kunci: "nyyhy", nama: "Kabel NYYHY 3x2,5 mm", satuan: "meter" };

// ====================================================================== Rencana pembelian

/** barang = kunci master baru atau kode master lama (LKP-01, ...). */
type RencanaBaris = { barang: string; qty: number; harga: number; residu?: number; garansi?: number; masa?: number; dasar?: "GARANSI" | "MASA_MANFAAT" };
type RencanaBeli = {
  kunci: string;
  jenis: "PERALATAN" | "PERLENGKAPAN";
  tanggal: string;
  caraBayar: "TUNAI" | "KREDIT" | "INVESTASI";
  jatuhTempo?: string;
  /** kunci supplier baru atau kode supplier lama; kosong untuk investasi. */
  supplier?: string;
  keterangan: string;
  baris: RencanaBaris[];
  dibuat: string;
  /** Posting langsung oleh Admin saat simpan, atau terpisah oleh Owner pada waktu ini. Kosong = tetap draf. */
  posting?: { oleh: "admin" | "owner"; pada: string };
};

const BELI: Record<string, RencanaBeli> = {
  lensa: {
    kunci: "lensa", jenis: "PERALATAN", tanggal: "2026-10-30", caraBayar: "KREDIT", jatuhTempo: "2026-11-30", supplier: "kamera",
    keterangan: "Lensa tele untuk dokumentasi wisuda, nota tanggal 30 Oktober baru diinput",
    baris: [{ barang: "lensa", qty: 1, harga: 14_000_000, residu: 0, garansi: 12, masa: 48, dasar: "MASA_MANFAAT" }],
    dibuat: "2026-11-02 09:15", posting: { oleh: "admin", pada: "2026-11-02 09:15" },
  },
  baterai: {
    kunci: "baterai", jenis: "PERLENGKAPAN", tanggal: "2026-10-30", caraBayar: "KREDIT", jatuhTempo: "2026-11-30", supplier: "elektronik",
    keterangan: "Stok baterai wireless mic dan HT, nota akhir Oktober",
    baris: [{ barang: "9v", qty: 10, harga: 65_000 }, { barang: "aaa", qty: 12, harga: 38_000 }],
    dibuat: "2026-11-03 08:40", posting: { oleh: "admin", pada: "2026-11-03 08:40" },
  },
  gel: {
    kunci: "gel", jenis: "PERLENGKAPAN", tanggal: "2026-10-31", caraBayar: "TUNAI", supplier: "SUP-03",
    keterangan: "Gel lighting warna untuk panggung wedding expo",
    baris: [{ barang: "gel", qty: 20, harga: 45_000 }],
    dibuat: "2026-11-03 08:55", posting: { oleh: "owner", pada: "2026-11-03 13:10" },
  },
  led: {
    kunci: "led", jenis: "PERALATAN", tanggal: "2026-11-03", caraBayar: "KREDIT", jatuhTempo: "2027-01-02", supplier: "led",
    keterangan: "Paket LED screen 2x1 m dan switcher untuk event outdoor",
    baris: [
      { barang: "led", qty: 8, harga: 6_250_000, residu: 312_500, garansi: 12, masa: 48, dasar: "MASA_MANFAAT" },
      { barang: "switcher", qty: 1, harga: 7_800_000, residu: 390_000, garansi: 12, masa: 48, dasar: "MASA_MANFAAT" },
    ],
    dibuat: "2026-11-03 10:20", posting: { oleh: "admin", pada: "2026-11-03 10:20" },
  },
  genset: {
    kunci: "genset", jenis: "PERALATAN", tanggal: "2026-11-04", caraBayar: "INVESTASI",
    keterangan: "Genset milik pemilik disetor sebagai tambahan modal usaha",
    baris: [{ barang: "genset", qty: 1, harga: 85_000_000, residu: 8_500_000, garansi: 24, masa: 96, dasar: "MASA_MANFAAT" }],
    dibuat: "2026-11-04 09:00", posting: { oleh: "owner", pada: "2026-11-04 11:30" },
  },
  kabel: {
    kunci: "kabel", jenis: "PERLENGKAPAN", tanggal: "2026-11-04", caraBayar: "TUNAI", supplier: "listrik",
    keterangan: "Kabel audio dan konektor cadangan",
    baris: [{ barang: "xlr", qty: 12, harga: 165_000 }, { barang: "konektor", qty: 20, harga: 35_000 }, { barang: "isolasi", qty: 24, harga: 8_000 }],
    dibuat: "2026-11-04 14:05", posting: { oleh: "admin", pada: "2026-11-04 14:05" },
  },
  truss: {
    kunci: "truss", jenis: "PERALATAN", tanggal: "2026-11-05", caraBayar: "KREDIT", jatuhTempo: "2026-12-05", supplier: "rigging",
    keterangan: "Truss gawang 12 m dan chain hoist untuk rigging LED",
    baris: [
      { barang: "truss", qty: 12, harga: 1_350_000, residu: 135_000, garansi: 0, masa: 96, dasar: "MASA_MANFAAT" },
      { barang: "hoist", qty: 2, harga: 6_500_000, residu: 650_000, garansi: 12, masa: 96, dasar: "MASA_MANFAAT" },
    ],
    dibuat: "2026-11-05 10:00", posting: { oleh: "admin", pada: "2026-11-05 10:00" },
  },
  mic: {
    kunci: "mic", jenis: "PERALATAN", tanggal: "2026-11-06", caraBayar: "TUNAI", supplier: "SUP-01",
    keterangan: "Tambahan wireless mic untuk seminar dan wedding",
    baris: [{ barang: "mic", qty: 2, harga: 3_750_000, residu: 0, garansi: 12, masa: 60, dasar: "GARANSI" }],
    dibuat: "2026-11-06 09:30", posting: { oleh: "admin", pada: "2026-11-06 09:30" },
  },
  fog: {
    kunci: "fog", jenis: "PERLENGKAPAN", tanggal: "2026-11-07", caraBayar: "KREDIT", jatuhTempo: "2026-12-07", supplier: "SUP-03",
    keterangan: "Cairan smoke, strap kabel, dan lakban lantai",
    baris: [{ barang: "fog", qty: 4, harga: 275_000 }, { barang: "velcro", qty: 10, harga: 55_000 }, { barang: "lantai", qty: 12, harga: 32_000 }],
    dibuat: "2026-11-07 11:15", posting: { oleh: "admin", pada: "2026-11-07 11:15" },
  },
  kamera: {
    kunci: "kamera", jenis: "PERALATAN", tanggal: "2026-11-09", caraBayar: "KREDIT", jatuhTempo: "2027-01-09", supplier: "kamera",
    keterangan: "Camcorder dan gimbal untuk tim dokumentasi",
    baris: [
      { barang: "camcorder", qty: 1, harga: 12_500_000, residu: 1_250_000, garansi: 24, masa: 48, dasar: "MASA_MANFAAT" },
      { barang: "gimbal", qty: 1, harga: 3_200_000, residu: 0, garansi: 12, masa: 48, dasar: "GARANSI" },
    ],
    dibuat: "2026-11-09 10:45", posting: { oleh: "admin", pada: "2026-11-09 10:45" },
  },
  par: {
    kunci: "par", jenis: "PERALATAN", tanggal: "2026-11-10", caraBayar: "TUNAI", supplier: "SUP-01",
    keterangan: "Lampu par LED untuk wash panggung",
    baris: [{ barang: "par", qty: 6, harga: 1_150_000, residu: 50_000, garansi: 12, masa: 60, dasar: "MASA_MANFAAT" }],
    dibuat: "2026-11-10 13:20", posting: { oleh: "admin", pada: "2026-11-10 13:20" },
  },
  smoke: {
    kunci: "smoke", jenis: "PERALATAN", tanggal: "2026-11-11", caraBayar: "KREDIT", jatuhTempo: "2026-12-11", supplier: "SUP-01",
    keterangan: "Efek panggung: smoke machine dan controller DMX",
    baris: [
      { barang: "smoke", qty: 2, harga: 2_400_000, residu: 240_000, garansi: 12, masa: 36, dasar: "MASA_MANFAAT" },
      { barang: "dmx", qty: 1, harga: 4_800_000, residu: 480_000, garansi: 12, masa: 60, dasar: "MASA_MANFAAT" },
    ],
    dibuat: "2026-11-11 09:10", posting: { oleh: "owner", pada: "2026-11-11 16:00" },
  },
  hdmi: {
    kunci: "hdmi", jenis: "PERLENGKAPAN", tanggal: "2026-11-12", caraBayar: "TUNAI", supplier: "elektronik",
    keterangan: "Kabel HDMI panjang dan terminal listrik",
    baris: [{ barang: "hdmi", qty: 4, harga: 285_000 }, { barang: "terminal", qty: 10, harga: 95_000 }],
    dibuat: "2026-11-12 10:00", posting: { oleh: "admin", pada: "2026-11-12 10:00" },
  },
  hdmiDobel: {
    kunci: "hdmiDobel", jenis: "PERLENGKAPAN", tanggal: "2026-11-12", caraBayar: "TUNAI", supplier: "elektronik",
    keterangan: "Kabel HDMI panjang dan terminal listrik",
    baris: [{ barang: "hdmi", qty: 4, harga: 285_000 }, { barang: "terminal", qty: 10, harga: 95_000 }],
    dibuat: "2026-11-12 15:40", posting: { oleh: "admin", pada: "2026-11-12 15:40" },
  },
  ratchet: {
    kunci: "ratchet", jenis: "PERLENGKAPAN", tanggal: "2026-11-16", caraBayar: "INVESTASI",
    keterangan: "Ratchet strap milik pemilik dipakai untuk usaha",
    baris: [{ barang: "ratchet", qty: 8, harga: 120_000 }],
    dibuat: "2026-11-16 08:30", posting: { oleh: "admin", pada: "2026-11-16 08:30" },
  },
  nyyhy: {
    kunci: "nyyhy", jenis: "PERLENGKAPAN", tanggal: "2026-11-18", caraBayar: "KREDIT", jatuhTempo: "2026-12-18", supplier: "listrik",
    keterangan: "Kabel power untuk distribusi genset",
    baris: [{ barang: "nyyhy", qty: 100, harga: 28_000 }],
    dibuat: "2026-11-18 09:50", posting: { oleh: "admin", pada: "2026-11-18 09:50" },
  },
  gaffer: {
    kunci: "gaffer", jenis: "PERLENGKAPAN", tanggal: "2026-11-19", caraBayar: "TUNAI", supplier: "SUP-01",
    keterangan: "Isi ulang gaffer tape dan baterai AA",
    baris: [{ barang: "LKP-01", qty: 10, harga: 85_000 }, { barang: "LKP-03", qty: 6, harga: 45_000 }],
    dibuat: "2026-11-19 14:30", posting: { oleh: "admin", pada: "2026-11-19 14:30" },
  },
  proyektor: {
    kunci: "proyektor", jenis: "PERALATAN", tanggal: "2026-11-21", caraBayar: "KREDIT", jatuhTempo: "2027-01-21", supplier: "elektronik",
    keterangan: "Proyektor untuk seminar dan gathering Desember",
    baris: [{ barang: "proyektor", qty: 2, harga: 9_750_000, residu: 500_000, garansi: 24, masa: 48, dasar: "GARANSI" }],
    dibuat: "2026-11-21 10:30", posting: { oleh: "owner", pada: "2026-11-21 15:00" },
  },
  // Rencana pembelian Desember (masih draf).
  panel: {
    kunci: "panel", jenis: "PERALATAN", tanggal: "2026-12-02", caraBayar: "KREDIT", jatuhTempo: "2027-01-02", supplier: "genset",
    keterangan: "Rencana: panel distribusi untuk konser akhir tahun",
    baris: [{ barang: "panel", qty: 1, harga: 8_500_000, residu: 850_000, garansi: 12, masa: 96, dasar: "MASA_MANFAAT" }],
    dibuat: "2026-11-22 09:00",
  },
  panggung: {
    kunci: "panggung", jenis: "PERALATAN", tanggal: "2026-12-03", caraBayar: "KREDIT", jatuhTempo: "2027-02-03", supplier: "rigging",
    keterangan: "Rencana: panggung modular 4x5 m",
    baris: [{ barang: "panggung", qty: 10, harga: 2_250_000, residu: 225_000, garansi: 0, masa: 96, dasar: "MASA_MANFAAT" }],
    dibuat: "2026-11-22 09:20",
  },
  bateraiDes: {
    kunci: "bateraiDes", jenis: "PERLENGKAPAN", tanggal: "2026-12-01", caraBayar: "TUNAI", supplier: "elektronik",
    keterangan: "Rencana: stok baterai event Desember",
    baris: [{ barang: "LKP-03", qty: 10, harga: 45_000 }, { barang: "aaa", qty: 10, harga: 38_000 }, { barang: "9v", qty: 6, harga: 65_000 }],
    dibuat: "2026-11-22 10:05",
  },
  gelDes: {
    kunci: "gelDes", jenis: "PERLENGKAPAN", tanggal: "2026-12-02", caraBayar: "KREDIT", jatuhTempo: "2027-01-02", supplier: "SUP-03",
    keterangan: "Rencana: gel lighting dan gaffer untuk konser akhir tahun",
    baris: [{ barang: "gel", qty: 30, harga: 45_000 }, { barang: "LKP-01", qty: 12, harga: 85_000 }],
    dibuat: "2026-11-22 10:20",
  },
};

/** Nilai sisa hasil hitung fisik November, persen dari saldo buku per perlengkapan (kunci baru atau kode lama). */
const PERSEN_SISA: Record<string, number> = {
  "LKP-01": 40, "LKP-02": 50, "LKP-03": 25, "LKP-04": 70, "LKP-05": 100,
  xlr: 85, konektor: 60, isolasi: 50, "9v": 40, aaa: 50, gel: 35, fog: 50, velcro: 80, lantai: 30, hdmi: 100, terminal: 100, ratchet: 100, nyyhy: 65,
};
/** Input pertama yang ditolak Owner: kabel XLR dan NYYHY salah dicatat habis. */
const PERSEN_SISA_SALAH: Record<string, number> = { ...PERSEN_SISA, xlr: 0, nyyhy: 0 };

// ====================================================================== Konteks

type Konteks = {
  admin: number;
  owner: number;
  supplier: Record<string, string>;
  kategori: Record<string, string>;
  peralatan: Record<string, string>;
  perlengkapan: Record<string, string>;
  /** kunci rencana pembelian -> nomor pembelian */
  beli: Record<string, string>;
  jurnalBaru: string[];
  asetBaru: string[];
  pelepasanBaru: string[];
};

const kodeBarang = (k: Konteks, jenis: "PERALATAN" | "PERLENGKAPAN", barang: string) =>
  (jenis === "PERALATAN" ? k.peralatan[barang] : k.perlengkapan[barang]) ?? barang;

// ====================================================================== Master (meniru simpanMaster dan tambah cepat)

async function tambahMaster(tx: Tx, k: Konteks) {
  // Kategori aset dikelola Owner (izin master.akun-kategori), memakai akun bawaan peralatan.
  for (const c of KATEGORI) {
    const v = validasi(skemaIsiMaster("kategori"), {
      nama: c.nama, masaManfaatBulan: String(c.masaManfaatBulan), persenResidu: String(c.persenResidu),
      akunAsetKode: AKUN.PERALATAN, akunAkumulasiKode: AKUN.AKUMULASI_PENYUSUTAN, akunBebanKode: AKUN.BIAYA_PENYUSUTAN,
    }) as Record<string, string | number>;
    const akun = await tx.akun.count({ where: { kode: { in: [String(v.akunAsetKode), String(v.akunAkumulasiKode), String(v.akunBebanKode)] }, aktif: true } });
    if (akun !== 3) throw new GalatAksi(`Akun untuk kategori ${c.nama} tidak lengkap atau nonaktif.`);
    const kode = await kodeBerikutnya(tx, AWALAN.KATEGORI);
    await tx.kategoriAset.create({
      data: { kode, nama: String(v.nama), masaManfaatBulan: Number(v.masaManfaatBulan), persenResidu: Number(v.persenResidu), akunAsetKode: String(v.akunAsetKode), akunAkumulasiKode: String(v.akunAkumulasiKode), akunBebanKode: String(v.akunBebanKode) },
    });
    await catatLog(tx, k.owner, "master.tambah", "kategori", kode);
    k.kategori[c.kunci] = kode;
  }

  // Supplier, peralatan, perlengkapan oleh Admin (izin master-konversi.ubah).
  for (const s of SUPPLIER) {
    const v = validasi(skemaIsiMaster("supplier"), { nama: s.nama, alamat: s.alamat, telepon: s.telepon, email: s.email, npwp: s.npwp }) as Record<string, string>;
    const npwp = v.npwp.trim() === "" ? null : v.npwp.trim();
    if (npwp && (await tx.supplier.findFirst({ where: { npwp }, select: { kode: true } }))) throw new GalatAksi(`NPWP ${npwp} sudah dipakai supplier lain.`);
    const kode = await kodeBerikutnya(tx, AWALAN.SUPPLIER);
    await tx.supplier.create({ data: { kode, nama: v.nama, alamat: v.alamat, telepon: v.telepon, email: v.email, npwp } });
    await catatLog(tx, k.admin, "master.tambah", "supplier", kode);
    k.supplier[s.kunci] = kode;
  }
  for (const p of PERALATAN) {
    const kategoriKode = k.kategori[p.kategori] ?? p.kategori;
    const v = validasi(skemaIsiMaster("peralatan"), { nama: p.nama, satuan: p.satuan, kategoriKode }) as Record<string, string>;
    const kat = await tx.kategoriAset.findUnique({ where: { kode: v.kategoriKode }, select: { aktif: true } });
    if (!kat || !kat.aktif) throw new GalatAksi(`Kategori ${v.kategoriKode} tidak ditemukan atau nonaktif.`);
    const kode = await kodeBerikutnya(tx, AWALAN.PERALATAN);
    await tx.peralatan.create({ data: { kode, nama: v.nama, satuan: v.satuan, kategoriKode: v.kategoriKode } });
    await catatLog(tx, k.admin, "master.tambah", "peralatan", kode);
    k.peralatan[p.kunci] = kode;
  }
  for (const p of PERLENGKAPAN) {
    const v = validasi(skemaIsiMaster("perlengkapan"), { nama: p.nama, satuan: p.satuan }) as Record<string, string>;
    const kode = await kodeBerikutnya(tx, AWALAN.PERLENGKAPAN);
    await tx.perlengkapan.create({ data: { kode, nama: v.nama, satuan: v.satuan } });
    await catatLog(tx, k.admin, "master.tambah", "perlengkapan", kode);
    k.perlengkapan[p.kunci] = kode;
  }
}

/** tambahSupplierCepat (Admin, dari form pembelian). */
async function supplierCepat(tx: Tx, k: Konteks) {
  const d = validasi(skemaSupplierCepat, { nama: SUPPLIER_CEPAT.nama, telepon: SUPPLIER_CEPAT.telepon });
  const kode = await kodeBerikutnya(tx, AWALAN.SUPPLIER);
  await tx.supplier.create({ data: { kode, nama: d.nama, telepon: d.telepon } });
  await catatLog(tx, k.admin, "supplier.tambah-cepat", "supplier", kode, d.nama);
  k.supplier[SUPPLIER_CEPAT.kunci] = kode;
}

/** tambahBarangCepat untuk perlengkapan (Admin, dari form pembelian). */
async function perlengkapanCepat(tx: Tx, k: Konteks) {
  const d = validasi(skemaBarangCepat, { jenis: "PERLENGKAPAN", nama: PERLENGKAPAN_CEPAT.nama, satuan: PERLENGKAPAN_CEPAT.satuan });
  const kode = await kodeBerikutnya(tx, AWALAN.PERLENGKAPAN);
  await tx.perlengkapan.create({ data: { kode, nama: d.nama, satuan: d.satuan } });
  await catatLog(tx, k.admin, "perlengkapan.tambah-cepat", "perlengkapan", kode, d.nama);
  k.perlengkapan[PERLENGKAPAN_CEPAT.kunci] = kode;
}

// ====================================================================== Pembelian (meniru simpanPembelian, postingPembelian, balikPembelian)

/** simpanPembelian untuk draf baru (Admin), dengan posting langsung bila rencananya diposting Admin saat simpan. */
async function simpanPembelian(tx: Tx, k: Konteks, r: RencanaBeli): Promise<string> {
  const peralatan = r.jenis === "PERALATAN";
  const postingLangsung = r.posting?.oleh === "admin";
  const input: InputPembelian = {
    no: null,
    jenis: r.jenis,
    tanggal: r.tanggal,
    caraBayar: r.caraBayar,
    jatuhTempo: r.jatuhTempo ?? "",
    supplierKode: r.supplier ? (k.supplier[r.supplier] ?? r.supplier) : "",
    keterangan: r.keterangan,
    baris: r.baris.map((b) => ({
      barangKode: kodeBarang(k, r.jenis, b.barang), qty: b.qty, harga: b.harga,
      ...(peralatan ? { residu: b.residu ?? 0, garansiBulan: b.garansi ?? 0, masaManfaatBulan: b.masa ?? 0, dasarN: b.dasar ?? "GARANSI" } : {}),
    })),
    posting: postingLangsung,
  };
  const d = validasi(skemaPembelian, input);

  if (d.supplierKode) {
    const s = await tx.supplier.findUnique({ where: { kode: d.supplierKode }, select: { aktif: true } });
    if (!s) throw new GalatAksi("Supplier tidak ditemukan.");
    if (!s.aktif) throw new GalatAksi("Supplier ini sudah dinonaktifkan.");
  }
  const kode = [...new Set(d.baris.map((b) => b.barangKode))];
  const barang = peralatan
    ? await tx.peralatan.findMany({ where: { kode: { in: kode } }, select: { kode: true, aktif: true } })
    : await tx.perlengkapan.findMany({ where: { kode: { in: kode } }, select: { kode: true, aktif: true } });
  for (const [i, b] of d.baris.entries()) {
    const x = barang.find((y) => y.kode === b.barangKode);
    if (!x) throw new GalatAksi(`${r.kunci} baris ${i + 1}: barang ${b.barangKode} tidak ditemukan.`);
    if (!x.aktif) throw new GalatAksi(`${r.kunci} baris ${i + 1}: barang ${b.barangKode} sudah dinonaktifkan.`);
  }

  const total = d.baris.reduce((s, b) => s + b.qty * b.harga, 0);
  const no = await nomorDokumen(tx, peralatan ? AWALAN.PEMBELIAN_PERALATAN : AWALAN.PEMBELIAN_PERLENGKAPAN, d.tanggal);
  await tx.pembelian.create({
    data: {
      no,
      jenis: d.jenis,
      tanggal: keDate(d.tanggal),
      supplierKode: d.supplierKode || null,
      caraBayar: d.caraBayar,
      jatuhTempo: d.caraBayar === "KREDIT" ? keDate(d.jatuhTempo) : null,
      keterangan: d.keterangan,
      total,
      status: "DRAFT",
      dibuatOlehId: k.admin,
      dibuatPada: waktu(r.dibuat),
      detail: {
        create: d.baris.map((b, i) =>
          peralatan
            ? { noUrut: i + 1, peralatanKode: b.barangKode, qty: b.qty, harga: b.harga, residu: b.residu, garansiBulan: b.garansiBulan, masaManfaatBulan: b.masaManfaatBulan, dasarN: b.dasarN }
            : { noUrut: i + 1, perlengkapanKode: b.barangKode, qty: b.qty, harga: b.harga },
        ),
      },
    },
  });
  await catatLog(tx, k.admin, "pembelian.buat", "pembelian", no);
  k.beli[r.kunci] = no;
  if (d.posting) await posting(tx, k, no, k.admin, r.posting!.pada);
  return no;
}

/** postingDalamTransaksi: jurnal umum DISETUJUI, lalu kartu aset per unit beserta jadwal penyusutannya. */
async function posting(tx: Tx, k: Konteks, no: string, olehId: number, pada: string) {
  const b = await tx.pembelian.findUnique({
    where: { no },
    include: { supplier: true, detail: { orderBy: { noUrut: "asc" }, include: { peralatan: { include: { kategori: true } } } } },
  });
  if (!b) throw new GalatAksi("Pembelian tidak ditemukan.");
  if (b.status !== "DRAFT") throw new GalatAksi(`${no} sudah diposting.`);
  const tanggal = dariDate(b.tanggal);
  const mulai = periodeDari(tanggal);

  const klaim = await tx.pembelian.updateMany({ where: { no, status: "DRAFT" }, data: { status: "DISETUJUI", disetujuiOlehId: olehId, disetujuiPada: waktu(pada) } });
  if (klaim.count !== 1) throw new GalatAksi(`${no} baru saja diposting pengguna lain.`);

  const debit: Record<string, number> = {};
  const rencanaAset: { jadwal: ReturnType<typeof hitungJadwal>; d: (typeof b.detail)[number] }[] = [];
  for (const d of b.detail) {
    if (b.jenis === "PERALATAN") {
      if (!d.peralatan) throw new GalatAksi(`Baris ${d.noUrut}: peralatan tidak ditemukan.`);
      const n = nDariDasar(d.dasarN ?? "GARANSI", d.garansiBulan ?? 0, d.masaManfaatBulan ?? 0);
      const jadwal = hitungJadwal(d.harga, d.residu ?? 0, n, mulai);
      const akunAset = d.peralatan.kategori.akunAsetKode || AKUN.PERALATAN;
      debit[akunAset] = (debit[akunAset] ?? 0) + d.qty * d.harga;
      rencanaAset.push({ jadwal, d });
    } else {
      debit[AKUN.PERLENGKAPAN] = (debit[AKUN.PERLENGKAPAN] ?? 0) + d.qty * d.harga;
    }
  }

  const namaSupplier = b.supplier?.nama ?? "Setoran pemilik";
  const jurnalNo = await buatJurnal(tx, {
    tanggal,
    jenis: "UMUM",
    status: "DISETUJUI",
    keterangan: `Pembelian ${LABEL_JENIS_PEMBELIAN[b.jenis].toLowerCase()} ${no}, ${namaSupplier} (${LABEL_CARA_BAYAR[b.caraBayar]})`,
    baris: barisPembelian(debit, b.caraBayar),
    sumberTipe: "PEMBELIAN",
    sumberId: no,
    dibuatOlehId: olehId,
    disetujuiOlehId: olehId,
  });
  k.jurnalBaru.push(jurnalNo);

  const kodeAset: string[] = [];
  for (const { jadwal, d } of rencanaAset) {
    const alat = d.peralatan!;
    await pastikanPeriode(tx, ...jadwal.baris.map((r) => r.periode));
    for (let u = 0; u < d.qty; u++) {
      const kode = await kodeBerikutnya(tx, AWALAN.ASET, 4);
      kodeAset.push(kode);
      await tx.aset.create({
        data: {
          kode,
          pembelianNo: no,
          noUrut: d.noUrut,
          peralatanKode: alat.kode,
          kategoriKode: alat.kategoriKode,
          nama: alat.nama,
          tglPerolehan: b.tanggal,
          bulanMulai: mulai,
          nilaiPerolehan: d.harga,
          residu: d.residu ?? 0,
          garansiBulan: d.garansiBulan ?? 0,
          garansiSampai: d.garansiBulan ? keDate(tambahBulanTanggal(tanggal, d.garansiBulan)) : null,
          masaManfaatBulan: d.masaManfaatBulan ?? 0,
          dasarN: d.dasarN ?? "GARANSI",
          n: jadwal.baris.length,
          d: jadwal.d,
          terakhir: jadwal.terakhir,
          pengaman: jadwal.pengaman,
          akunAsetKode: alat.kategori.akunAsetKode,
          akunAkumulasiKode: alat.kategori.akunAkumulasiKode,
          akunBebanKode: alat.kategori.akunBebanKode,
          jadwal: { create: jadwal.baris.map((r) => ({ periodeKe: r.periodeKe, periodeId: r.periode, beban: r.beban, akumulasi: r.akumulasi, nilaiBuku: r.nilaiBuku })) },
        },
      });
    }
  }
  k.asetBaru.push(...kodeAset);

  await tx.pembelian.update({ where: { no }, data: { jurnalNo } });
  await catatLog(tx, olehId, "pembelian.posting", "pembelian", no, `Jurnal ${jurnalNo}${kodeAset.length ? `, aset ${kodeAset.join(", ")}` : ""}`);
  return { jurnalNo, aset: kodeAset };
}

/** Buat dan (bila direncanakan) posting satu pembelian sesuai urutan waktu kejadian. */
async function beli(tx: Tx, k: Konteks, kunci: string) {
  const r = BELI[kunci];
  const no = await simpanPembelian(tx, k, r);
  if (r.posting?.oleh === "owner") await posting(tx, k, no, k.owner, r.posting.pada);
  return no;
}

/** balikPembelian (Owner). Jurnal pembalik bertanggal hari pembalikan (di simulasi: `tanggal`). */
async function balik(tx: Tx, k: Konteks, kunci: string, alasanMentah: string, tanggal: string, pada: string) {
  const { no, alasan } = validasi(skemaNoDanAlasan, { no: k.beli[kunci], alasan: alasanMentah });
  const b = await tx.pembelian.findUnique({
    where: { no },
    include: { jurnal: { include: { detail: { orderBy: { noUrut: "asc" } } } }, detail: { include: { aset: { include: { jadwal: { where: { jurnalNo: { not: null } }, select: { periodeKe: true } } } } } } },
  });
  if (!b || b.status !== "DISETUJUI") throw new GalatAksi("Hanya pembelian yang sudah diposting yang bisa dibalik.");
  if (!b.jurnal) throw new GalatAksi("Jurnal asli pembelian ini tidak ditemukan.");
  const aset = b.detail.flatMap((d) => d.aset);
  if (b.jenis === "PERALATAN") {
    for (const a of aset) {
      if (a.status !== "AKTIF" || a.jadwal.length) throw new GalatAksi(`${a.kode} sudah punya penyusutan yang dijurnal atau sudah dilepas. Gunakan Pelepasan Peralatan.`);
    }
  } else {
    const opname = await tx.opname.count({ where: { status: { not: "DITOLAK" }, periodeId: { gte: periodeDari(dariDate(b.tanggal)) } } });
    if (opname) throw new GalatAksi("Nilai sisa perlengkapan untuk periode ini atau sesudahnya sudah diinput, jadi pembelian tidak bisa dibalik.");
  }
  const klaim = await tx.pembelian.updateMany({ where: { no, status: "DISETUJUI" }, data: { status: "DIBALIK", alasanBalik: alasan, dibalikOlehId: k.owner, dibalikPada: waktu(pada) } });
  if (klaim.count !== 1) throw new GalatAksi(`${no} baru saja dibalik pengguna lain.`);
  const jb = await buatJurnal(tx, {
    tanggal,
    jenis: "PEMBALIK",
    status: "DISETUJUI",
    keterangan: `Pembalik ${b.jurnal.no} (pembelian ${no}): ${alasan}`,
    baris: barisPembalik(b.jurnal.detail.map((x) => ({ akun: x.akunKode, debit: x.debit, kredit: x.kredit }))),
    sumberTipe: "PEMBELIAN",
    sumberId: no,
    pembalikDariNo: b.jurnal.no,
    dibuatOlehId: k.owner,
    disetujuiOlehId: k.owner,
  });
  k.jurnalBaru.push(jb);
  if (aset.length) {
    await tx.jadwalPenyusutan.deleteMany({ where: { asetKode: { in: aset.map((a) => a.kode) } } });
    await tx.aset.updateMany({ where: { kode: { in: aset.map((a) => a.kode) } }, data: { status: "BATAL" } });
  }
  await tx.pembelian.update({ where: { no }, data: { jurnalPembalikNo: jb } });
  await catatLog(tx, k.owner, "pembelian.balik", "pembelian", no, alasan);
  return jb;
}

// ====================================================================== Penyesuaian (meniru prosesPenyusutan, simpanNilaiSisa, aksi jurnal penyesuaian)

/** prosesPenyusutan (Admin): satu jurnal penyesuaian DRAFT untuk baris jadwal periode P yang belum dijurnal. */
async function prosesPenyusutan(tx: Tx, k: Konteks, periode: string) {
  const { periode: P } = validasi(skemaProsesPenyusutan, { periode });
  if (P > periodeIni()) throw new GalatAksi("Periode ini belum berjalan, jadi belum bisa diproses.");
  await pastikanTerbuka(tx, P);
  const lebihAwal = await tx.jadwalPenyusutan.findFirst({ where: { periodeId: { lt: P }, jurnalNo: null, aset: { status: "AKTIF" } }, orderBy: { periodeId: "asc" }, select: { periodeId: true } });
  if (lebihAwal) throw new GalatAksi(`Periode ${labelPeriode(lebihAwal.periodeId)} belum diproses. Proses periode paling lama dulu supaya urutan jadwal tetap benar.`);
  const baris = await tx.jadwalPenyusutan.findMany({
    where: { periodeId: P, jurnalNo: null, aset: { status: "AKTIF" } },
    orderBy: { asetKode: "asc" },
    include: { aset: { select: { akunBebanKode: true, akunAkumulasiKode: true } } },
  });
  if (!baris.length) throw new GalatAksi(`Penyusutan ${labelPeriode(P)} sudah diproses atau tidak ada.`);
  const jurnalNo = await buatJurnal(tx, {
    tanggal: hariTerakhir(P),
    jenis: "PENYESUAIAN",
    status: "DRAFT",
    keterangan: `Penyusutan peralatan ${labelPeriode(P)}`,
    baris: barisPenyusutan(baris.map((r) => ({ akunBeban: r.aset.akunBebanKode, akunAkumulasi: r.aset.akunAkumulasiKode, beban: r.beban }))),
    sumberTipe: "PENYUSUTAN",
    sumberId: P,
    dibuatOlehId: k.admin,
  });
  k.jurnalBaru.push(jurnalNo);
  const klaim = await tx.jadwalPenyusutan.updateMany({ where: { periodeId: P, jurnalNo: null, asetKode: { in: baris.map((r) => r.asetKode) } }, data: { jurnalNo } });
  if (klaim.count !== baris.length) throw new GalatAksi(`Penyusutan ${labelPeriode(P)} baru saja diproses pengguna lain.`);
  await catatLog(tx, k.admin, "penyusutan.proses", "jurnal", jurnalNo, `${labelPeriode(P)}, ${baris.length} aset`);
  return jurnalNo;
}

/** Kunci baris jurnal dan pastikan jenisnya penyesuaian, seperti aksi halaman Jurnal Penyesuaian. */
async function kunciPenyesuaian(tx: Tx, no: string) {
  await tx.$queryRaw`SELECT no_jurnal FROM jurnal WHERE no_jurnal = ${no} FOR UPDATE`;
  const j = await tx.jurnal.findUnique({ where: { no }, select: { jenis: true } });
  if (!j) throw new GalatAksi(`Jurnal ${no} tidak ditemukan.`);
  if (j.jenis !== "PENYESUAIAN") throw new GalatAksi(`${no} bukan jurnal penyesuaian.`);
}
/** ajukanJurnalPenyesuaian (Admin). */
async function ajukan(tx: Tx, k: Konteks, no: string) {
  await kunciPenyesuaian(tx, no);
  await ajukanJurnal(tx, no, k.admin);
}
/** setujuiJurnalPenyesuaian (Owner). */
async function setujui(tx: Tx, k: Konteks, no: string) {
  await kunciPenyesuaian(tx, no);
  await setujuiJurnal(tx, no, k.owner);
}
/** tolakJurnalPenyesuaian (Owner, alasan wajib). */
async function tolak(tx: Tx, k: Konteks, no: string, alasan: string) {
  await kunciPenyesuaian(tx, no);
  await tolakJurnal(tx, no, k.owner, alasan);
}

/** simpanNilaiSisa (Admin): saldo buku dari bahanNilaiSisa, biaya = saldo buku - nilai sisa, jurnal penyesuaian DRAFT. */
async function inputNilaiSisa(tx: Tx, k: Konteks, periode: string, persen: Record<string, number>, pada: string) {
  // Nilai sisa dihitung dari saldo buku yang tampil di form (fungsi yang sama dengan halaman dan server action).
  const tampil = await bahanNilaiSisa(tx, periode);
  const kunciKode = new Map(Object.entries(k.perlengkapan).map(([kunci, kode]) => [kode, kunci]));
  const nilaiForm = tampil.saldo.map((s) => {
    const p = persen[kunciKode.get(s.kode) ?? s.kode];
    if (p === undefined) throw new GalatAksi(`Persen nilai sisa ${s.kode} belum ditentukan di rencana.`);
    return { perlengkapanKode: s.kode, nilaiSisa: Math.min(s.saldoBuku, Math.round((s.saldoBuku * p) / 100 / 100) * 100) };
  });

  const d = validasi(skemaNilaiSisa, { periode, nilai: nilaiForm });
  const P = d.periode;
  if (P > periodeIni()) throw new GalatAksi("Periode ini belum berjalan, jadi nilai sisanya belum bisa diinput.");
  const no = nomorOpname(P);
  await pastikanTerbuka(tx, P);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(7410002)`;
  const lama = await tx.opname.findUnique({ where: { periodeId: P }, select: { status: true } });
  if (lama && lama.status !== "DITOLAK") throw new GalatAksi(`Nilai sisa ${labelPeriode(P)} sudah diinput.`);
  const [lain, { saldo, terlewat }] = await Promise.all([
    tx.opname.findMany({ where: { periodeId: { not: P }, status: { not: "DITOLAK" } }, select: { periodeId: true, status: true } }),
    bahanNilaiSisa(tx, P),
  ]);
  const tahan = tahanUrutanNilaiSisa(P, lain, terlewat);
  if (tahan) throw new GalatAksi(tahan);
  if (!saldo.length) throw new GalatAksi("Tidak ada perlengkapan untuk dihitung.");
  const nilai = new Map(d.nilai.map((x) => [x.perlengkapanKode, x.nilaiSisa]));
  const baris = saldo.map((s) => {
    const v = nilai.get(s.kode);
    if (v === undefined) throw new GalatAksi(`${s.nama}: belum dihitung.`);
    if (v > s.saldoBuku) throw new GalatAksi(`${s.nama}: nilai sisa harus 0 sampai ${s.saldoBuku}.`);
    return { kode: s.kode, saldoBuku: s.saldoBuku, nilaiSisa: v };
  });
  const total = baris.reduce((s, b) => s + (b.saldoBuku - b.nilaiSisa), 0);
  const saldoAkunLkp = await saldoAkun(tx, AKUN.PERLENGKAPAN, P);
  if (total > saldoAkunLkp) throw new GalatAksi(`Biaya perlengkapan ${total} melebihi saldo akun Perlengkapan sampai ${labelPeriode(P)} (${saldoAkunLkp}).`);

  let jurnalNo: string | null = null;
  if (total > 0) {
    jurnalNo = await buatJurnal(tx, {
      tanggal: hariTerakhir(P),
      jenis: "PENYESUAIAN",
      status: "DRAFT",
      keterangan: `Biaya perlengkapan ${labelPeriode(P)} (dari input nilai sisa)`,
      baris: barisOpname(total),
      sumberTipe: "OPNAME",
      sumberId: no,
      dibuatOlehId: k.admin,
    });
    k.jurnalBaru.push(jurnalNo);
  }
  const sekarang = waktu(pada);
  const data = {
    totalBeban: total,
    status: total > 0 ? ("DRAFT" as const) : ("DISETUJUI" as const),
    alasanTolak: null,
    jurnalNo,
    dibuatOlehId: k.admin,
    dibuatPada: sekarang,
    disetujuiOlehId: total > 0 ? null : k.admin,
    disetujuiPada: total > 0 ? null : sekarang,
  };
  const detail = baris.map((b) => ({ perlengkapanKode: b.kode, saldoBuku: b.saldoBuku, nilaiSisa: b.nilaiSisa }));
  if (lama) {
    const klaim = await tx.opname.updateMany({ where: { no, status: "DITOLAK" }, data });
    if (klaim.count !== 1) throw new GalatAksi(`Nilai sisa ${labelPeriode(P)} baru saja diinput pengguna lain.`);
    await tx.detailOpname.deleteMany({ where: { opnameNo: no } });
    await tx.detailOpname.createMany({ data: detail.map((x) => ({ ...x, opnameNo: no })) });
  } else {
    await tx.opname.create({ data: { no, periodeId: P, ...data, detail: { create: detail } } });
  }
  await catatLog(tx, k.admin, lama ? "opname.input-ulang" : "opname.input", "opname", no, jurnalNo ? `Jurnal ${jurnalNo}, biaya ${total}` : "Tanpa biaya");
  if (!jurnalNo) throw new GalatAksi("Rencana nilai sisa November harus punya selisih (biaya perlengkapan).");
  return jurnalNo;
}

/** Waktu keputusan opname mengikuti simulasi (layanan jurnal memakai waktu sekarang). */
const waktuOpname = (tx: Tx, no: string, pada: string) => tx.opname.updateMany({ where: { jurnalNo: no }, data: { disetujuiPada: waktu(pada) } });

// ====================================================================== Pelepasan (meniru ajukanPelepasan, setujuiPelepasan)

async function posisiAset(tx: Tx, kode: string) {
  const a = await tx.aset.findUnique({ where: { kode }, include: { jadwal: { select: { periodeKe: true, periodeId: true, beban: true, jurnalNo: true, jurnal: { select: { status: true } } } } } });
  if (!a) throw new GalatAksi("Peralatan tidak ditemukan.");
  const jadwal = a.jadwal.map((r) => ({ periodeKe: r.periodeKe, periode: r.periodeId, beban: r.beban, jurnalNo: r.jurnalNo, statusJurnal: r.jurnal?.status ?? null }));
  return { a, jadwal, akumulasi: akumulasiDisetujui(jadwal) };
}

/** Aset pertama dari baris pembelian tertentu (urut kode). */
async function asetDari(tx: Tx, k: Konteks, kunciBeli: string, noUrut: number) {
  const a = await tx.aset.findFirst({ where: { pembelianNo: k.beli[kunciBeli], noUrut, status: "AKTIF" }, orderBy: { kode: "asc" }, select: { kode: true } });
  if (!a) throw new GalatAksi(`Aset dari ${k.beli[kunciBeli]} baris ${noUrut} tidak ditemukan.`);
  return a.kode;
}

async function ajukanPelepasan(tx: Tx, k: Konteks, input: { asetKode: string; tanggal: string; alasan: "DIJUAL" | "DIBUANG" | "HILANG"; hargaJual: number | "" }, pada: string) {
  const d = validasi(skemaAjukanPelepasan, input);
  const harga = d.alasan === "DIJUAL" ? Number(d.hargaJual) : 0;
  const { a, jadwal, akumulasi } = await posisiAset(tx, d.asetKode);
  if (a.status !== "AKTIF") throw new GalatAksi("Aset ini tidak aktif.");
  if (d.tanggal < dariDate(a.tglPerolehan)) throw new GalatAksi("Tanggal pelepasan tidak boleh sebelum tanggal perolehan.");
  await pastikanTerbuka(tx, periodeDari(d.tanggal));
  if (await tx.pelepasan.count({ where: { asetKode: a.kode, status: "DIAJUKAN" } })) throw new GalatAksi("Aset ini sudah punya pengajuan yang menunggu keputusan.");
  const tahan = cekJadwalPelepasan(jadwal, d.tanggal);
  if (tahan) throw new GalatAksi(tahan);
  const h = hitungPelepasan(a.nilaiPerolehan, akumulasi, harga);
  const no = await nomorDokumen(tx, AWALAN.PELEPASAN, d.tanggal);
  await tx.pelepasan.create({
    data: {
      no, asetKode: a.kode, tanggal: keDate(d.tanggal), alasan: d.alasan, hargaJual: harga, nilaiPerolehan: a.nilaiPerolehan,
      akumulasi: h.akumulasi, nilaiBuku: h.nilaiBuku, labaRugi: h.labaRugi, status: "DIAJUKAN", dibuatOlehId: k.admin, dibuatPada: waktu(pada),
    },
  });
  await catatLog(tx, k.admin, "pelepasan.ajukan", "pelepasan", no, `${a.kode}, ${LABEL_ALASAN_PELEPASAN[d.alasan]}`);
  k.pelepasanBaru.push(no);
  return no;
}

async function setujuiPelepasan(tx: Tx, k: Konteks, no: string, pada: string) {
  const p = await tx.pelepasan.findUnique({ where: { no } });
  if (!p || p.status !== "DIAJUKAN") throw new GalatAksi("Pengajuan ini sudah diputuskan.");
  const klaim = await tx.pelepasan.updateMany({ where: { no, status: "DIAJUKAN" }, data: { status: "DISETUJUI", disetujuiOlehId: k.owner, disetujuiPada: waktu(pada) } });
  if (klaim.count !== 1) throw new GalatAksi("Pengajuan ini baru saja diputuskan pengguna lain.");
  const { a, jadwal, akumulasi } = await posisiAset(tx, p.asetKode);
  if (a.status !== "AKTIF") throw new GalatAksi("Aset ini sudah tidak aktif.");
  const tanggal = dariDate(p.tanggal);
  const tahan = cekJadwalPelepasan(jadwal, tanggal);
  if (tahan) throw new GalatAksi(tahan);
  const h = hitungPelepasan(a.nilaiPerolehan, akumulasi, p.hargaJual);
  const jurnalNo = await buatJurnal(tx, {
    tanggal,
    jenis: "UMUM",
    status: "DISETUJUI",
    keterangan: `Pelepasan ${a.kode} ${a.nama} (${LABEL_ALASAN_PELEPASAN[p.alasan].toLowerCase()})`,
    baris: barisPelepasan({ nilaiPerolehan: a.nilaiPerolehan, akumulasi: h.akumulasi, hargaJual: p.hargaJual, akunAset: a.akunAsetKode, akunAkumulasi: a.akunAkumulasiKode }),
    sumberTipe: "PELEPASAN",
    sumberId: no,
    dibuatOlehId: p.dibuatOlehId,
    disetujuiOlehId: k.owner,
  });
  k.jurnalBaru.push(jurnalNo);
  const lepas = await tx.aset.updateMany({ where: { kode: a.kode, status: "AKTIF" }, data: { status: "DILEPAS", tanggalLepas: p.tanggal } });
  if (lepas.count !== 1) throw new GalatAksi("Aset ini sudah tidak aktif.");
  await tx.jadwalPenyusutan.deleteMany({ where: { asetKode: a.kode, jurnalNo: null } });
  await tx.pelepasan.update({ where: { no }, data: { jurnalNo, akumulasi: h.akumulasi, nilaiBuku: h.nilaiBuku, labaRugi: h.labaRugi } });
  await catatLog(tx, k.owner, "pelepasan.setujui", "pelepasan", no, `Jurnal ${jurnalNo}`);
  return { jurnalNo, labaRugi: h.labaRugi };
}

// ====================================================================== Alur utama

/** Penghitung nomor harus sudah melewati nomor terbesar yang ada, supaya nomor baru tidak bentrok. */
async function cekPenghitung(tx: Tx) {
  const daftar: { kunci: string; kueri: Promise<{ kode: string }[]> }[] = [
    { kunci: "BP2026", kueri: tx.pembelian.findMany({ where: { no: { startsWith: "BP-2026-" } }, select: { no: true } }).then((x) => x.map((y) => ({ kode: y.no }))) },
    { kunci: "BL2026", kueri: tx.pembelian.findMany({ where: { no: { startsWith: "BL-2026-" } }, select: { no: true } }).then((x) => x.map((y) => ({ kode: y.no }))) },
    { kunci: "JU2026", kueri: tx.jurnal.findMany({ where: { no: { startsWith: "JU-2026-" } }, select: { no: true } }).then((x) => x.map((y) => ({ kode: y.no }))) },
    { kunci: "JP2026", kueri: tx.jurnal.findMany({ where: { no: { startsWith: "JP-2026-" } }, select: { no: true } }).then((x) => x.map((y) => ({ kode: y.no }))) },
    { kunci: "JB2026", kueri: tx.jurnal.findMany({ where: { no: { startsWith: "JB-2026-" } }, select: { no: true } }).then((x) => x.map((y) => ({ kode: y.no }))) },
    { kunci: "PLP2026", kueri: tx.pelepasan.findMany({ where: { no: { startsWith: "PLP-2026-" } }, select: { no: true } }).then((x) => x.map((y) => ({ kode: y.no }))) },
    { kunci: "AST", kueri: tx.aset.findMany({ select: { kode: true } }) },
    { kunci: "SUP", kueri: tx.supplier.findMany({ select: { kode: true } }) },
    { kunci: "ALT", kueri: tx.peralatan.findMany({ select: { kode: true } }) },
    { kunci: "LKP", kueri: tx.perlengkapan.findMany({ select: { kode: true } }) },
    { kunci: "KAT", kueri: tx.kategoriAset.findMany({ select: { kode: true } }) },
  ];
  const nilai = new Map((await tx.penghitung.findMany()).map((p) => [p.kunci, p.nilai]));
  for (const x of daftar) {
    const maks = Math.max(0, ...(await x.kueri).map((y) => Number(y.kode.split("-").at(-1))));
    const h = nilai.get(x.kunci) ?? 0;
    if (h < maks) throw new GalatAksi(`Dibatalkan: penghitung ${x.kunci} (${h}) tertinggal dari nomor terbesar yang ada (${maks}).`);
  }
}

async function prasyarat(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(7410778)`;
  if (new Date() < waktu(WAKTU_TERAKHIR)) throw new GalatAksi(`Dibatalkan: skrip ini memakai waktu simulasi sampai ${WAKTU_TERAKHIR} WIB, jadi baru boleh dijalankan sesudahnya.`);
  const penanda = await tx.logAktivitas.count({ where: { aksi: PENANDA } });
  const namaSupplier = [...SUPPLIER.map((s) => s.nama), SUPPLIER_CEPAT.nama];
  const supplierAda = await tx.supplier.findMany({ where: { nama: { in: namaSupplier } }, select: { nama: true } });
  const opnameNov = await tx.opname.count({ where: { periodeId: PERIODE } });
  const susutNov = await tx.jurnal.count({ where: { sumberTipe: "PENYUSUTAN", sumberId: PERIODE } });
  if (penanda || supplierAda.length || opnameNov || susutNov) {
    throw new GalatAksi(`Dibatalkan: data dummy konversi sudah pernah ditambahkan atau ${labelPeriode(PERIODE)} sudah diproses (penanda log ${penanda}, supplier ${supplierAda.map((s) => s.nama).join(", ") || "-"}, opname ${opnameNov}, jurnal penyusutan ${susutNov}).`);
  }
  const admin = await tx.pengguna.findFirst({ where: { peran: "ADMIN", aktif: true }, orderBy: { id: "asc" }, select: { id: true } });
  const owner = await tx.pengguna.findFirst({ where: { peran: "OWNER", aktif: true }, orderBy: { id: "asc" }, select: { id: true } });
  if (!admin || !owner) throw new GalatAksi("Dibatalkan: butuh minimal satu pengguna Admin dan satu Owner yang aktif.");
  const akun = await tx.akun.count({ where: { kode: { in: Object.values(AKUN) }, aktif: true } });
  if (akun !== Object.values(AKUN).length) throw new GalatAksi("Dibatalkan: bagan akun bawaan tidak lengkap atau ada yang nonaktif.");
  const lama = await Promise.all([
    tx.supplier.count({ where: { kode: { in: ["SUP-01", "SUP-03"] }, aktif: true } }),
    tx.kategoriAset.count({ where: { kode: { in: ["KAT-01", "KAT-02"] }, aktif: true } }),
    tx.perlengkapan.count({ where: { kode: { in: ["LKP-01", "LKP-03"] }, aktif: true } }),
  ]);
  if (lama.some((n) => n !== 2)) throw new GalatAksi("Dibatalkan: master contoh SUP-01, SUP-03, KAT-01, KAT-02, LKP-01, LKP-03 harus ada dan aktif.");
  const oktober = await tx.opname.findUnique({ where: { periodeId: "2026-10" }, select: { status: true } });
  if (oktober?.status !== "DISETUJUI") throw new GalatAksi("Dibatalkan: nilai sisa Oktober 2026 (OPN-2026-10) harus sudah disetujui.");
  const susutBelum = await tx.jadwalPenyusutan.count({ where: { periodeId: { lt: PERIODE }, jurnalNo: null, aset: { status: "AKTIF" } } });
  if (susutBelum) throw new GalatAksi(`Dibatalkan: masih ada ${susutBelum} baris jadwal penyusutan sebelum ${labelPeriode(PERIODE)} yang belum dijurnal.`);
  await cekPenghitung(tx);
  return { admin: admin.id, owner: owner.id };
}

/** Periksa sebelum commit: neraca saldo seimbang dan saldo kas tidak pernah negatif (urut tanggal, lalu nomor jurnal). */
async function periksaAkhir(tx: Tx) {
  const jurnal = await muatJurnalBuku(tx);
  const akun = await tx.akun.findMany({ select: { kode: true } });
  const kodeAkun = akun.map((a) => a.kode);
  const neraca = neracaSaldo(jurnal, kodeAkun, null);
  if (!neraca.seimbang) throw new GalatAksi(`Neraca saldo tidak seimbang: debit ${neraca.debit}, kredit ${neraca.kredit}.`);
  const lajur = neracaLajur(jurnal, kodeAkun, PERIODE);
  if (!lajur.seimbang) throw new GalatAksi(`Neraca lajur ${labelPeriode(PERIODE)} tidak seimbang.`);
  let kas = 0;
  let terendah = { saldo: Infinity, no: "", tanggal: "" };
  for (const j of [...jurnal].sort((a, b) => (a.tanggal + a.no).localeCompare(b.tanggal + b.no))) {
    for (const b of j.baris) if (b.akun === AKUN.KAS) kas += b.debit - b.kredit;
    if (kas < terendah.saldo) terendah = { saldo: kas, no: j.no, tanggal: j.tanggal };
  }
  if (terendah.saldo < 0) throw new GalatAksi(`Saldo kas negatif ${terendah.saldo} sesudah ${terendah.no} (${terendah.tanggal}).`);
  if (kas !== (await saldoAkun(tx, AKUN.KAS))) throw new GalatAksi("Saldo kas hasil hitung berbeda dengan saldoAkun.");
  return { neraca, lajur: lajur.total, kasAkhir: kas, terendah };
}

/** Ringkasan dihitung di dalam transaksi, jadi mode coba menampilkan angka yang sama dengan jalan sungguhan. */
async function ringkasan(tx: Tx, k: Konteks) {
  const noBeli = Object.values(k.beli);
  const [beli, aset, jadwal, opname, pelepasan, jurnal] = await Promise.all([
    tx.pembelian.groupBy({ by: ["jenis", "status"], where: { no: { in: noBeli } }, _count: true, orderBy: [{ jenis: "asc" }, { status: "asc" }] }),
    tx.aset.groupBy({ by: ["status"], where: { kode: { in: k.asetBaru } }, _count: true, orderBy: { status: "asc" } }),
    tx.jadwalPenyusutan.groupBy({ by: ["jurnalNo"], where: { asetKode: { in: k.asetBaru } }, _count: true, orderBy: { jurnalNo: "asc" } }),
    tx.opname.findUnique({ where: { periodeId: PERIODE }, select: { no: true, status: true, totalBeban: true, jurnalNo: true, _count: { select: { detail: true } } } }),
    tx.pelepasan.findMany({ where: { no: { in: k.pelepasanBaru } }, orderBy: { no: "asc" }, select: { no: true, asetKode: true, alasan: true, hargaJual: true, nilaiBuku: true, labaRugi: true, status: true } }),
    tx.jurnal.findMany({ where: { no: { in: k.jurnalBaru } }, orderBy: [{ tanggal: "asc" }, { no: "asc" }], include: { detail: { select: { debit: true } } } }),
  ]);
  const caraBayar = await tx.pembelian.groupBy({ by: ["caraBayar"], where: { no: { in: noBeli } }, _count: true, orderBy: { caraBayar: "asc" } });
  return { beli, caraBayar, aset, jadwal, opname, pelepasan, jurnal };
}

async function main() {
  const hasil = await db.$transaction(
    async (tx) => {
      const p = await prasyarat(tx);
      const k: Konteks = { admin: p.admin, owner: p.owner, supplier: {}, kategori: {}, peralatan: {}, perlengkapan: {}, beli: {}, jurnalBaru: [], asetBaru: [], pelepasanBaru: [] };
      await catatLog(tx, k.owner, PENANDA, "data-dummy", null, "Data dummy siklus konversi Oktober sampai Desember 2026 (prisma/tambah-dummy-konversi.ts)");

      // ---- Master (1 sampai 2 November).
      await tambahMaster(tx, k);

      // ---- Pembelian, urut waktu input supaya nomor dokumen dan jurnal mengikuti urutan kejadian.
      await supplierCepat(tx, k); // Admin menambah CV Kamera Pro dari form pembelian lensa.
      await beli(tx, k, "lensa"); // bertanggal 30 Oktober, diinput 2 November
      await beli(tx, k, "baterai"); // bertanggal 30 Oktober
      await beli(tx, k, "gel"); // draf Admin, diposting Owner
      await beli(tx, k, "led"); // multi-baris, 9 kartu aset
      await balik(tx, k, "lensa", "Lensa yang dikirim ternyata unit bekas pakai. Barang diretur ke CV Kamera Pro dan tagihannya dibatalkan.", "2026-11-04", "2026-11-04 09:30");
      await beli(tx, k, "genset"); // investasi pemilik, diposting Owner
      await beli(tx, k, "kabel");
      await beli(tx, k, "truss"); // multi-baris, 14 kartu aset
      await beli(tx, k, "mic");
      await beli(tx, k, "fog");
      await beli(tx, k, "kamera");
      await beli(tx, k, "par");
      await beli(tx, k, "smoke"); // draf Admin, diposting Owner
      await beli(tx, k, "hdmi");
      await beli(tx, k, "hdmiDobel"); // nota yang sama diinput dua kali
      await balik(tx, k, "hdmiDobel", `Dobel input: nota yang sama sudah dicatat di ${k.beli.hdmi}.`, "2026-11-13", "2026-11-13 08:45");
      await beli(tx, k, "ratchet"); // perlengkapan setoran pemilik
      await perlengkapanCepat(tx, k); // Admin menambah kabel NYYHY dari form pembelian.
      await beli(tx, k, "nyyhy");
      await beli(tx, k, "gaffer"); // memakai master perlengkapan lama

      // ---- Penyusutan November (20 November): diajukan Admin, disetujui Owner.
      const susut1 = await prosesPenyusutan(tx, k, PERIODE);
      await ajukan(tx, k, susut1);
      await setujui(tx, k, susut1);

      // ---- Nilai sisa November: input pertama ditolak, diinput ulang, lalu disetujui.
      const opn1 = await inputNilaiSisa(tx, k, PERIODE, PERSEN_SISA_SALAH, "2026-11-20 15:00");
      await ajukan(tx, k, opn1);
      await tolak(tx, k, opn1, "Kabel XLR dan kabel NYYHY dicatat habis, padahal di gudang masih ada. Tolong hitung ulang kedua barang itu.");
      await waktuOpname(tx, opn1, "2026-11-20 17:00");
      const opn2 = await inputNilaiSisa(tx, k, PERIODE, PERSEN_SISA, "2026-11-21 08:30");
      await ajukan(tx, k, opn2);
      await setujui(tx, k, opn2);
      await waktuOpname(tx, opn2, "2026-11-21 09:15");

      // ---- Pelepasan 1: smoke machine dijual ke vendor rekanan di atas nilai buku (laba), disetujui.
      const plp1 = await ajukanPelepasan(tx, k, { asetKode: await asetDari(tx, k, "smoke", 1), tanggal: "2026-11-21", alasan: "DIJUAL", hargaJual: 2_375_000 }, "2026-11-21 10:00");
      await setujuiPelepasan(tx, k, plp1, "2026-11-21 13:00");

      // ---- Proyektor diposting sesudah penyusutan November diproses, jadi barisnya masuk jurnal penyusutan kedua.
      await beli(tx, k, "proyektor");

      // ---- Pelepasan 2: wireless mic rusak kena hujan, dijual murah (rugi), disetujui.
      const plp2 = await ajukanPelepasan(tx, k, { asetKode: await asetDari(tx, k, "mic", 1), tanggal: "2026-11-22", alasan: "DIJUAL", hargaJual: 900_000 }, "2026-11-22 09:00");
      await setujuiPelepasan(tx, k, plp2, "2026-11-22 11:00");

      // ---- Penyusutan November kedua (proyektor): diajukan, menunggu Owner.
      const susut2 = await prosesPenyusutan(tx, k, PERIODE);
      await ajukan(tx, k, susut2);

      // ---- Rencana pembelian Desember (draf).
      await beli(tx, k, "panel");
      await beli(tx, k, "panggung");
      await beli(tx, k, "bateraiDes");
      await beli(tx, k, "gelDes");

      // ---- Pelepasan 3: lampu par terbakar, dibuang, menunggu Owner.
      await ajukanPelepasan(tx, k, { asetKode: await asetDari(tx, k, "par", 1), tanggal: "2026-11-23", alasan: "DIBUANG", hargaJual: "" }, "2026-11-23 08:30");

      const periksa = await periksaAkhir(tx);
      const ringkas = { k, periksa, data: await ringkasan(tx, k) };
      if (COBA) throw Object.assign(new Error("COBA"), { ringkas });
      return ringkas;
    },
    { timeout: 600_000, maxWait: 30_000 },
  ).catch((e) => {
    if (e instanceof Error && e.message === "COBA") return (e as Error & { ringkas: unknown }).ringkas as never;
    throw e;
  });

  cetakRingkasan(hasil);
}

function cetakRingkasan(h: { k: Konteks; periksa: Awaited<ReturnType<typeof periksaAkhir>>; data: Awaited<ReturnType<typeof ringkasan>> }) {
  const rp = (n: number) => `${n < 0 ? "-" : ""}Rp${Math.abs(n).toLocaleString("id-ID")}`;
  const { k, data: d, periksa } = h;
  console.log(COBA ? "MODE COBA: semua langkah berhasil lalu DIBATALKAN, tidak ada yang tersimpan.\n" : "Data dummy konversi tersimpan.\n");
  console.log(`Master baru: supplier ${Object.keys(k.supplier).length} (${Object.values(k.supplier).join(", ")}), kategori ${Object.keys(k.kategori).length} (${Object.values(k.kategori).join(", ")}), peralatan ${Object.keys(k.peralatan).length}, perlengkapan ${Object.keys(k.perlengkapan).length}.`);
  console.log(`Pembelian baru: ${Object.keys(k.beli).length} (${d.beli.map((x) => `${x.jenis} ${x.status} ${x._count}`).join(", ")}).`);
  console.log(`  cara bayar: ${d.caraBayar.map((x) => `${x.caraBayar} ${x._count}`).join(", ")}`);
  console.log(`Kartu aset baru: ${k.asetBaru.length} (${d.aset.map((x) => `${x.status} ${x._count}`).join(", ")}), ${k.asetBaru[0]} sampai ${k.asetBaru.at(-1)}.`);
  console.log(`  baris jadwal aset baru: ${d.jadwal.map((x) => `${x.jurnalNo ?? "belum dijurnal"} ${x._count}`).join(", ")}`);
  if (d.opname) console.log(`Nilai sisa ${d.opname.no}: ${d.opname.status}, ${d.opname._count.detail} perlengkapan, biaya ${rp(d.opname.totalBeban)}, jurnal ${d.opname.jurnalNo}.`);
  console.log("Pelepasan baru:");
  for (const x of d.pelepasan) console.log(`  ${x.no}  ${x.asetKode}  ${x.alasan.padEnd(7)}  harga ${rp(x.hargaJual)}, nilai buku ${rp(x.nilaiBuku)}, ${x.labaRugi >= 0 ? "laba" : "rugi"} ${rp(Math.abs(x.labaRugi))}  ${x.status}`);
  console.log(`Jurnal baru (${d.jurnal.length}):`);
  for (const j of d.jurnal) {
    console.log(`  ${j.no}  ${labelTanggal(dariDate(j.tanggal)).padEnd(17)} ${j.jenis.padEnd(11)} ${j.status.padEnd(9)} ${rp(j.detail.reduce((s, x) => s + x.debit, 0)).padStart(15)}  ${j.keterangan}`);
  }
  const n = periksa.neraca;
  console.log(`Neraca saldo semua periode: debit ${rp(n.debit)}, kredit ${rp(n.kredit)}, ${n.seimbang ? "SEIMBANG" : "TIDAK SEIMBANG"}.`);
  const l = periksa.lajur;
  console.log(`Neraca lajur ${labelPeriode(PERIODE)}: sebelum penyesuaian ${rp(l.neracaSaldo.debit)} / ${rp(l.neracaSaldo.kredit)}, penyesuaian ${rp(l.penyesuaian.debit)} / ${rp(l.penyesuaian.kredit)}, setelah ${rp(l.setelah.debit)} / ${rp(l.setelah.kredit)}.`);
  console.log(`Saldo kas akhir ${rp(periksa.kasAkhir)}, terendah ${rp(periksa.terendah.saldo)} sesudah ${periksa.terendah.no} (${labelTanggal(periksa.terendah.tanggal)}).`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
