/*
 * Data contoh satu tahun penuh (Januari sampai Desember 2026) dari database kosong sesudah migrasi.
 * Master diisi sekali, lalu ditransaksikan tiap bulan lewat layanan yang sama dengan server action aplikasi
 * (src/lib/server/*Dalam, skema zod aplikasi), jadi tidak ada jurnal yang ditulis tangan:
 *   setoran Investasi Kas bila kas perlu ditambah, pembelian peralatan (45 aset) dan perlengkapan, penyusutan tiap bulan,
 *   nilai sisa tiap bulan (Maret dikembalikan Owner lalu disetujui, November direvisi sesudah disetujui), pelepasan
 *   (dijual, dibuang, satu ditolak Owner), presensi dan Gaji Bulanan tiap bulan (potongan dan bonus sesekali, Mei ditolak
 *   lalu diajukan ulang), 1 sampai 3 event per bulan dengan kapten, crew freelance, dan sesekali karyawan inhouse (satu
 *   laporan ditolak lalu dikirim ulang), promosi Juli, kenaikan tunjangan Makan April, setoran Maret ditolak.
 * Desember sengaja terbuka untuk dicoba di UI: penyusutan dan nilai sisa belum diproses, presensi ada tetapi Gaji Bulanan
 * belum diajukan (sudah ada upah event inhouse dari event akhir November), satu event menunggu keputusan Owner, satu event
 * masih dinilai kapten (berisi karyawan inhouse), satu setoran menunggu Owner, satu pembelian masih draf.
 *
 * Semua dalam satu transaksi. Di akhir skrip memeriksa neraca saldo seimbang tiap bulan dan semua periode, saldo kas tidak
 * pernah negatif, dan penghitung nomor dokumen cocok dengan data; bila ada yang gagal transaksi dibatalkan dan skrip
 * keluar dengan kode galat.
 *
 * Jalankan (database kosong sesudah `npx prisma migrate deploy`): npx tsx prisma/seed-setahun.ts
 * Database berisi: SEED_PAKSA=1 npx tsx prisma/seed-setahun.ts (semua tabel data dikosongkan dulu).
 * Kata sandi: admin/adminsia, hrd/hrdsia, owner/ownersia, kapten sampai kapten6/kaptensia.
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { db, type Tx } from "../src/lib/server/db";
import { GalatAksi, validasi } from "../src/lib/server/aksi";
import type { PenggunaSesi } from "../src/lib/server/auth";
import { hashKataSandi } from "../src/lib/server/kata-sandi";
import { AWALAN, kodeBerikutnya } from "../src/lib/server/nomor";
import { pastikanPeriode } from "../src/lib/server/periode";
import { ajukanJurnal, muatJurnalBuku, saldoAkun, setujuiJurnal, tolakJurnal } from "../src/lib/server/jurnal";
import { ajukanNominalDalam, setujuiNominalDalam } from "../src/lib/server/nominal";
import { ajukanSettingDalam, setujuiSettingDalam } from "../src/lib/server/setting-gaji";
import { catatInvestasiKasDalam, setujuiInvestasiKasDalam, tolakInvestasiKasDalam } from "../src/lib/server/investasi-kas";
import { simpanPembelianDalam } from "../src/lib/server/pembelian";
import { prosesPenyusutanDalam } from "../src/lib/server/penyusutan";
import { ajukanRevisiDalam, setujuiRevisiDalam, simpanNilaiSisaDalam } from "../src/lib/server/nilai-sisa";
import { ajukanPelepasanDalam, setujuiPelepasanDalam, tolakPelepasanDalam } from "../src/lib/server/pelepasan";
import { simpanPresensiDalam } from "../src/lib/server/presensi";
import { ajukanGajiBulananDalam, setujuiPenggajianDalam, simpanPenyesuaianDalam, tolakPenggajianDalam } from "../src/lib/server/gaji-bulanan";
import { simpanEventDalam, simpanKehadiranDalam, simpanPenugasanDalam, simpanSesiDalam } from "../src/lib/server/event";
import { kirimLaporanDalam, nilaiKehadiranDalam } from "../src/lib/server/penilaian";
import { setujuiFeeDalam, tolakFeeDalam } from "../src/lib/server/keputusan-fee";
import { muatBahanEvent } from "../src/lib/data/fee-event/bahan";
import { bahanNilaiSisa } from "../src/lib/data/konversi/nilai-sisa";
import { AKUN, AKUN_GAJI_BULANAN } from "../src/lib/inti/akun";
import { neracaSaldo } from "../src/lib/inti/buku-besar";
import { daftarPeriode, hariTerakhir, keMenit, labelPeriode, tambahHari } from "../src/lib/inti/tanggal";
import { rupiah } from "../src/lib/format";
import { skemaInvestasiKas } from "../src/lib/skema/modal";
import { skemaPembelian } from "../src/lib/skema/pembelian";
import { skemaAjukanPelepasan } from "../src/lib/skema/konversi";
import { skemaPresensi } from "../src/lib/skema/sdm";
import { skemaEvent, skemaKehadiran, skemaPenilaian, skemaPenugasan, skemaSesi } from "../src/lib/skema/fee-event";
import type { Peran, StatusPtkp, TipeAkun } from "../src/generated/prisma/enums";
import { kosongkanSemua } from "./kosongkan";

const BULAN = daftarPeriode("2026-01", "2026-11");
const DES = "2026-12";
/** Hari libur nasional 2026 (disederhanakan) yang tidak diisi presensi. */
const LIBUR = new Set(["2026-01-01", "2026-02-17", "2026-03-19", "2026-03-20", "2026-04-03", "2026-05-01", "2026-05-14", "2026-05-27", "2026-06-01", "2026-08-17", "2026-12-25"]);
/** Kas dijaga minimal sebesar ini di awal bulan lewat setoran Investasi Kas. */
const TARGET_KAS = 170_000_000;

// ---------------------------------------------------------------- PRNG berbiji supaya data selalu sama

function acak(biji: string) {
  let h = 2166136261;
  for (const c of biji) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const jam = (menit: number) => `${String(Math.floor(menit / 60)).padStart(2, "0")}:${String(menit % 60).padStart(2, "0")}`;
const tgl = (P: string, hari: number) => `${P}-${String(hari).padStart(2, "0")}`;
const hariKerja = (P: string) => {
  const akhir = Number(hariTerakhir(P).slice(8));
  const hasil: string[] = [];
  for (let d = 1; d <= akhir; d++) {
    const t = tgl(P, d);
    const w = new Date(`${t}T00:00:00Z`).getUTCDay();
    if (w !== 0 && w !== 6 && !LIBUR.has(t)) hasil.push(t);
  }
  return hasil;
};

// ---------------------------------------------------------------- Master

const PENGGUNA: { namaPengguna: string; nama: string; peran: Peran; karyawan?: string }[] = [
  { namaPengguna: "admin", nama: "Admin Keuangan", peran: "ADMIN" },
  { namaPengguna: "hrd", nama: "Staf HRD", peran: "HRD" },
  { namaPengguna: "owner", nama: "Owner D'Production", peran: "OWNER" },
  // Nama kapten sama dengan data contoh fee event dan data produksi.
  { namaPengguna: "kapten", nama: "Bima Satria", peran: "KAPTEN", karyawan: "Bima Satria" },
  { namaPengguna: "kapten2", nama: "Sari Wulandari", peran: "KAPTEN", karyawan: "Sari Wulandari" },
  { namaPengguna: "kapten3", nama: "Hendra Gunawan", peran: "KAPTEN", karyawan: "Hendra Gunawan" },
  { namaPengguna: "kapten4", nama: "Lestari Ayuningtyas", peran: "KAPTEN", karyawan: "Lestari Ayuningtyas" },
  { namaPengguna: "kapten5", nama: "Wahyu Kurniawan", peran: "KAPTEN", karyawan: "Wahyu Kurniawan" },
  { namaPengguna: "kapten6", nama: "Rina Marlina", peran: "KAPTEN", karyawan: "Rina Marlina" },
];
const sandi = (p: Peran) => `${p.toLowerCase()}sia`;

const AKUN_DASAR: { kode: string; nama: string; tipe: TipeAkun; saldoNormal: "D" | "K" }[] = [
  { kode: "1-110", nama: "Kas", tipe: "ASET", saldoNormal: "D" },
  { kode: "1-140", nama: "Perlengkapan", tipe: "ASET", saldoNormal: "D" },
  { kode: "1-150", nama: "Peralatan", tipe: "ASET", saldoNormal: "D" },
  { kode: "1-151", nama: "Akumulasi Penyusutan Peralatan", tipe: "KONTRA_ASET", saldoNormal: "K" },
  { kode: "2-110", nama: "Utang Usaha", tipe: "LIABILITAS", saldoNormal: "K" },
  { kode: "2-120", nama: "Utang PPh 21", tipe: "LIABILITAS", saldoNormal: "K" },
  { kode: "3-110", nama: "Modal Pemilik", tipe: "EKUITAS", saldoNormal: "K" },
  { kode: "3-120", nama: "Modal Investor", tipe: "EKUITAS", saldoNormal: "K" },
  { kode: "3-130", nama: "Modal Hibah", tipe: "EKUITAS", saldoNormal: "K" },
  { kode: "6-110", nama: "Biaya Penyusutan Peralatan", tipe: "BEBAN", saldoNormal: "D" },
  { kode: "6-120", nama: "Biaya Perlengkapan", tipe: "BEBAN", saldoNormal: "D" },
  { kode: "6-210", nama: "Biaya Gaji Crew & Produksi Event", tipe: "BEBAN", saldoNormal: "D" },
  { kode: "6-220", nama: "Biaya Gaji Administrasi & Umum", tipe: "BEBAN", saldoNormal: "D" },
  { kode: "6-230", nama: "Biaya Fee Crew Event (Freelance)", tipe: "BEBAN", saldoNormal: "D" },
  { kode: "7-110", nama: "Laba Pelepasan Aset", tipe: "PENDAPATAN", saldoNormal: "K" },
  { kode: "8-110", nama: "Rugi Pelepasan Aset", tipe: "BEBAN", saldoNormal: "D" },
];

const SUPPLIER = [
  { nama: "CV Sinar Audio Malang", alamat: "Jl. Letjen Sutoyo, Malang", telepon: "0341-491122" },
  { nama: "Toko Kamera Ijen", alamat: "Jl. Ijen, Malang", telepon: "0341-552210" },
  { nama: "UD Event Supply Malang", alamat: "Jl. Raya Singosari, Malang", telepon: "0341-458800" },
  { nama: "PT Cahaya Panggung Nusantara", alamat: "Jl. Rungkut Industri, Surabaya", telepon: "031-8701234" },
  { nama: "Toko Komputer Dinoyo", alamat: "Jl. MT Haryono, Malang", telepon: "0341-575757" },
];
const KATEGORI = [
  { nama: "Sound & Lighting", masa: 60 },
  { nama: "Peralatan Dokumentasi", masa: 48 },
  { nama: "Peralatan Kecil Event", masa: 24 },
  { nama: "Perangkat Kantor", masa: 48 },
];
/** [nama, satuan, indeks kategori] */
const PERALATAN: [string, string, number][] = [
  ["Speaker Aktif 15 inci (set)", "set", 0],
  ["Moving Head Beam 230W", "unit", 0],
  ["Mixer Digital 16 Channel", "unit", 0],
  ["Kamera Mirrorless", "unit", 1],
  ["Handy Talky (HT)", "unit", 2],
  ["Laptop Operasional", "unit", 3],
  ["Wireless Microphone (set)", "set", 0],
  ["Lampu Par LED 54x3W", "unit", 0],
];
const PERLENGKAPAN: [string, string][] = [
  ["Gaffer Tape", "roll"],
  ["Kabel Ties", "pak"],
  ["Baterai AA", "pak"],
  ["ID Card dan Lanyard", "pcs"],
  ["Cetak Banner/X-Banner", "lembar"],
  ["Plastik Wrap", "roll"],
];
/** [nama, akun biaya, jam masuk, jam keluar, tunj. jabatan, tunj. istri/anak] */
const JABATAN: [string, string, string, string, number, number][] = [
  ["Event Manager", "6-210", "08:00", "17:00", 1_500_000, 400_000],
  ["Crew Produksi", "6-210", "07:00", "16:00", 250_000, 200_000],
  ["Operator Sound & Lighting", "6-210", "07:00", "16:00", 500_000, 250_000],
  ["Admin Keuangan", "6-220", "08:00", "17:00", 400_000, 250_000],
  ["Marketing & Promosi", "6-220", "08:00", "17:00", 450_000, 250_000],
];
const GOLONGAN: [string, number][] = [["Golongan I", 3_800_000], ["Golongan II", 4_500_000], ["Golongan III", 5_800_000], ["Golongan IV", 8_000_000]];
const TUNJANGAN: [string, number][] = [["Transport", 300_000], ["Makan", 400_000], ["Komunikasi", 100_000], ["Kesehatan", 200_000]];
/** Karyawan inhouse: [nama, PTKP, bank, rekening, indeks jabatan, indeks golongan, indeks tunjangan] */
const INHOUSE: [string, StatusPtkp, string, string, number, number, number[]][] = [
  ["Raka Aditya Wijaya", "K2", "BCA", "1234567890", 0, 3, [0, 1, 2, 3]],
  ["Nadia Putri Anggraini", "TK0", "Mandiri", "1370012345678", 3, 1, [0, 1, 3]],
  ["Bagas Setiawan", "K1", "BRI", "002101009876", 2, 1, [0, 1]],
  ["Dimas Prakoso", "TK1", "BNI", "0987654321", 1, 0, [1]],
  ["Fajar Ramadhan", "K0", "BCA", "5550001234", 1, 0, [0, 1]],
  ["Andrew Pratama", "TK0", "BCA", "7781234500", 4, 1, [0, 1, 2]],
  ["Citra Lestari", "TK0", "Mandiri", "1440099887766", 4, 0, [0, 1, 2]],
  ["Yoga Saputra", "TK0", "BRI", "005522114455", 1, 0, [1]],
  ["Intan Permatasari", "K0", "BNI", "0466778899", 3, 0, [0, 1, 3]],
  ["Rizky Firmansyah", "TK1", "BCA", "3349876501", 2, 1, [0, 1]],
];
/** Crew freelance; enam pertama kapten (akun kapten sampai kapten6). */
const FREELANCE: [string, StatusPtkp, string, string][] = [
  ["Bima Satria", "TK0", "BCA", "8800112233"],
  ["Sari Wulandari", "TK0", "BRI", "004455667788"],
  ["Hendra Gunawan", "K2", "BCA", "7731122334"],
  ["Lestari Ayuningtyas", "TK0", "BRI", "005611223344"],
  ["Wahyu Kurniawan", "K1", "Mandiri", "1440023344556"],
  ["Rina Marlina", "TK1", "BNI", "0478912345"],
  ["Agus Salim", "TK0", "BCA", "6612003344"],
  ["Dewi Anggraini", "TK0", "BRI", "003377889900"],
  ["Eko Prasetyo", "K0", "Mandiri", "1370055667788"],
  ["Fitri Handayani", "TK0", "BNI", "0412345678"],
  ["Gilang Ramadhan", "TK0", "BCA", "7790011223"],
  ["Hana Safitri", "TK0", "BRI", "006688990011"],
];

// ---------------------------------------------------------------- Rencana transaksi

type BarisAlat = { alat: number; qty: number; harga: number; dasar: "GARANSI" | "MASA_MANFAAT"; garansi: number; masa: number };
const alat = (a: number, qty: number, harga: number, dasar: "GARANSI" | "MASA_MANFAAT", garansi: number, masa: number): BarisAlat => ({ alat: a, qty, harga, dasar, garansi, masa });
/** Pembelian peralatan: total 45 unit (satu kartu aset per unit). */
const BELI_ALAT: { tanggal: string; cara: "TUNAI" | "KREDIT" | "INVESTASI"; supplier: number | null; tempo?: string; ket: string; baris: BarisAlat[] }[] = [
  { tanggal: "2026-01-08", cara: "INVESTASI", supplier: null, ket: "Setoran peralatan awal dari pemilik", baris: [alat(0, 2, 14_500_000, "MASA_MANFAAT", 24, 60), alat(1, 4, 9_800_000, "MASA_MANFAAT", 12, 60), alat(2, 1, 18_000_000, "MASA_MANFAAT", 12, 60), alat(4, 3, 950_000, "GARANSI", 24, 24)] },
  { tanggal: "2026-02-12", cara: "TUNAI", supplier: 1, ket: "Kamera dan laptop dokumentasi", baris: [alat(3, 2, 12_500_000, "MASA_MANFAAT", 12, 48), alat(5, 2, 9_000_000, "MASA_MANFAAT", 12, 48), alat(4, 2, 950_000, "GARANSI", 24, 24)] },
  { tanggal: "2026-03-10", cara: "KREDIT", supplier: 0, tempo: "2026-04-10", ket: "Wireless mic dan lampu par", baris: [alat(6, 4, 2_800_000, "MASA_MANFAAT", 12, 60), alat(7, 2, 3_200_000, "MASA_MANFAAT", 12, 60)] },
  { tanggal: "2026-05-15", cara: "TUNAI", supplier: 3, ket: "Tambahan lighting musim wisuda", baris: [alat(1, 2, 9_800_000, "MASA_MANFAAT", 12, 60), alat(7, 4, 3_200_000, "MASA_MANFAAT", 12, 60)] },
  { tanggal: "2026-07-09", cara: "TUNAI", supplier: 2, ket: "HT dan wireless mic tambahan", baris: [alat(4, 4, 950_000, "GARANSI", 24, 24), alat(6, 2, 2_800_000, "MASA_MANFAAT", 12, 60)] },
  { tanggal: "2026-09-11", cara: "KREDIT", supplier: 1, tempo: "2026-10-11", ket: "Kamera dan laptop baru", baris: [alat(3, 1, 13_000_000, "MASA_MANFAAT", 12, 48), alat(5, 2, 9_500_000, "MASA_MANFAAT", 12, 48)] },
  { tanggal: "2026-09-21", cara: "TUNAI", supplier: 0, ket: "Mixer cadangan dan speaker", baris: [alat(2, 1, 18_500_000, "MASA_MANFAAT", 12, 60), alat(0, 2, 15_000_000, "MASA_MANFAAT", 24, 60)] },
  { tanggal: "2026-11-06", cara: "TUNAI", supplier: 3, ket: "Persiapan event akhir tahun", baris: [alat(7, 3, 3_300_000, "MASA_MANFAAT", 12, 60), alat(6, 2, 2_900_000, "MASA_MANFAAT", 12, 60)] },
];
/** Bulan tanpa pembelian perlengkapan (sisanya tiap bulan). */
const TANPA_PERLENGKAPAN = new Set(["2026-08"]);
/** Pelepasan: [tanggal, alat, bulan beli, alasan, harga jual, ditolak Owner?] */
const PELEPASAN: [string, number, string, "DIJUAL" | "DIBUANG", number, string | null][] = [
  ["2026-03-20", 5, "2026-02", "DIBUANG", 0, "Laptop masih bisa diperbaiki, jangan dibuang dulu."],
  ["2026-06-18", 4, "2026-01", "DIJUAL", 500_000, null],
  ["2026-08-20", 4, "2026-02", "DIBUANG", 0, null],
  ["2026-10-14", 1, "2026-01", "DIJUAL", 6_500_000, null],
];
/** Event per bulan (Januari sampai November). */
const JUMLAH_EVENT = [1, 2, 2, 1, 2, 3, 2, 1, 2, 2, 2];
const NAMA_EVENT = ["Gathering Tahunan", "Wedding Expo", "Seminar Nasional", "Launching Produk", "Pameran UMKM", "Konser Amal", "Wisuda Kampus", "Festival Kuliner", "Family Day", "Dies Natalis", "Ulang Tahun Kota", "Pentas Seni"];
const KLIEN = ["PT Sinar Abadi", "Hotel Tugu Malang", "Universitas Brawijaya", "Bank Jatim", "Pemkot Malang", "PT Kalbe Farma", "SMA Negeri 3 Malang", "Komunitas Kuliner Malang"];
/** Potongan dan bonus manual: [bulan, indeks karyawan inhouse, jenis, nominal, keterangan] */
const PENYESUAIAN: [string, number, "POTONGAN" | "BONUS", number, string][] = [
  ["2026-03", 7, "POTONGAN", 150_000, "Denda merusak kabel XLR saat loading out"],
  ["2026-06", 0, "BONUS", 1_000_000, "Bonus target event Juni"],
  ["2026-08", 5, "BONUS", 750_000, "Bonus pameran Agustus"],
  ["2026-10", 4, "POTONGAN", 100_000, "Denda terlambat mengembalikan HT"],
  ["2026-11", 2, "BONUS", 500_000, "Bonus lembur persiapan akhir tahun"],
];

// ---------------------------------------------------------------- Konteks

type Konteks = {
  admin: PenggunaSesi;
  hrd: PenggunaSesi;
  owner: PenggunaSesi;
  /** Akun kapten per kode karyawan crew. */
  kapten: Map<string, PenggunaSesi>;
  supplier: string[];
  alat: string[];
  lkp: string[];
  jabatan: string[];
  jabatanKapten: string;
  jabatanCrew: string;
  golongan: string[];
  tunjangan: string[];
  inhouse: string[];
  freelance: string[];
  log: (s: string) => void;
  hitung: { event: number; laporanDitolak: number; pengajuanDitolak: string[] };
};

async function buatPengguna(tx: Tx, p: (typeof PENGGUNA)[number], karyawanKode: string | null): Promise<PenggunaSesi> {
  const u = await tx.pengguna.create({ data: { namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran, karyawanKode, kataSandiHash: await hashKataSandi(sandi(p.peran)) } });
  return { id: u.id, namaPengguna: u.namaPengguna, nama: u.nama, peran: u.peran };
}

async function master(tx: Tx, log: (s: string) => void): Promise<Konteks> {
  await pastikanPeriode(tx, ...daftarPeriode("2026-01", "2027-12"));
  await tx.profilUsaha.create({ data: { id: 1, nama: "D'Production", keterangan: "SIA Konversi & SDM" } });
  await tx.akun.createMany({ data: [...AKUN_DASAR, ...AKUN_GAJI_BULANAN.map((a) => ({ ...a }))] });
  const kode = (awalan: string) => kodeBerikutnya(tx, awalan);
  const supplier: string[] = [];
  for (const s of SUPPLIER) supplier.push((await tx.supplier.create({ data: { kode: await kode(AWALAN.SUPPLIER), ...s } })).kode);
  const kategori: string[] = [];
  for (const k of KATEGORI) {
    kategori.push((await tx.kategoriAset.create({ data: { kode: await kode(AWALAN.KATEGORI), nama: k.nama, masaManfaatBulan: k.masa, akunAsetKode: AKUN.PERALATAN, akunAkumulasiKode: AKUN.AKUMULASI_PENYUSUTAN, akunBebanKode: AKUN.BIAYA_PENYUSUTAN } })).kode);
  }
  const alatKode: string[] = [];
  for (const [nama, satuan, k] of PERALATAN) alatKode.push((await tx.peralatan.create({ data: { kode: await kode(AWALAN.PERALATAN), nama, satuan, kategoriKode: kategori[k] } })).kode);
  const lkp: string[] = [];
  for (const [nama, satuan] of PERLENGKAPAN) lkp.push((await tx.perlengkapan.create({ data: { kode: await kode(AWALAN.PERLENGKAPAN), nama, satuan } })).kode);

  const jabatan: string[] = [];
  for (const [nama, akun, masuk, keluar] of JABATAN) {
    jabatan.push((await tx.jabatan.create({ data: { kode: await kode(AWALAN.JABATAN), nama, akunBebanKode: akun, kelompok: "INHOUSE", jamMasuk: masuk, jamKeluar: keluar, hariKerja: 22 } })).kode);
  }
  const jabatanKapten = (await tx.jabatan.create({ data: { kode: await kode(AWALAN.JABATAN), nama: "Kapten Event", akunBebanKode: AKUN.BIAYA_FEE_EVENT, kelompok: "EVENT", peranEvent: "KAPTEN", satuanTarif: "HARI" } })).kode;
  const jabatanCrew = (await tx.jabatan.create({ data: { kode: await kode(AWALAN.JABATAN), nama: "Crew Event", akunBebanKode: AKUN.BIAYA_FEE_EVENT, kelompok: "EVENT", peranEvent: "CREW", satuanTarif: "JAM" } })).kode;
  const golongan: string[] = [];
  for (const [nama] of GOLONGAN) golongan.push((await tx.golongan.create({ data: { kode: await kode(AWALAN.GOLONGAN), nama } })).kode);
  const tunjangan: string[] = [];
  for (const [nama] of TUNJANGAN) tunjangan.push((await tx.tunjangan.create({ data: { kode: await kode(AWALAN.TUNJANGAN), nama } })).kode);

  const inhouse: string[] = [];
  for (const [nama, ptkp, bank, noRek] of INHOUSE) inhouse.push((await tx.karyawan.create({ data: { kode: await kode(AWALAN.KARYAWAN), nama, statusPtkp: ptkp, bank, noRek, jenis: "INHOUSE" } })).kode);
  const freelance: string[] = [];
  for (const [nama, ptkp, bank, noRek] of FREELANCE) freelance.push((await tx.karyawan.create({ data: { kode: await kode(AWALAN.KARYAWAN), nama, statusPtkp: ptkp, bank, noRek, jenis: "EVENT" } })).kode);

  const [admin, hrd, owner] = [await buatPengguna(tx, PENGGUNA[0], null), await buatPengguna(tx, PENGGUNA[1], null), await buatPengguna(tx, PENGGUNA[2], null)];
  const kapten = new Map<string, PenggunaSesi>();
  for (const p of PENGGUNA.slice(3)) {
    const k = freelance[FREELANCE.findIndex((f) => f[0] === p.karyawan)];
    kapten.set(k, await buatPengguna(tx, p, k));
  }

  // Nominal awal berlaku Januari 2026: diajukan HRD, disetujui Owner.
  const nominal = async (d: Parameters<typeof ajukanNominalDalam>[2]) => {
    const a = await ajukanNominalDalam(tx, hrd.id, d);
    await setujuiNominalDalam(tx, owner.id, a.kode);
  };
  const awal = { berlaku: "2026-01", alasan: "Nominal awal tahun 2026", nominal: 0, tunjJabatan: 0, tunjKeluarga: 0 };
  for (const [i, [, n]] of GOLONGAN.entries()) await nominal({ ...awal, jenis: "GOLONGAN", itemKode: golongan[i], nominal: n });
  for (const [i, [, n]] of TUNJANGAN.entries()) await nominal({ ...awal, jenis: "TUNJANGAN", itemKode: tunjangan[i], nominal: n });
  for (const [i, j] of JABATAN.entries()) await nominal({ ...awal, jenis: "JABATAN", itemKode: jabatan[i], tunjJabatan: j[4], tunjKeluarga: j[5] });
  await nominal({ ...awal, jenis: "JABATAN_EVENT", itemKode: jabatanKapten, nominal: 200_000 });
  await nominal({ ...awal, jenis: "JABATAN_EVENT", itemKode: jabatanCrew, nominal: 20_000 });

  // Setting gaji awal semua karyawan inhouse berlaku Januari 2026.
  for (const [i, [, , , , jb, gl, tj]] of INHOUSE.entries()) {
    const a = await ajukanSettingDalam(tx, hrd.id, { karyawanKode: inhouse[i], jenisPerubahan: "SETTING_AWAL", jabatanKode: jabatan[jb], golonganKode: golongan[gl], tunjanganKodes: tj.map((t) => tunjangan[t]), alasan: "Setting awal tahun 2026" }, "2026-01");
    await setujuiSettingDalam(tx, owner.id, a.kode);
  }
  log(`Master: ${supplier.length} supplier, ${alatKode.length} peralatan, ${lkp.length} perlengkapan, ${jabatan.length + 2} jabatan, ${inhouse.length} karyawan inhouse, ${freelance.length} crew freelance, ${PENGGUNA.length} pengguna.`);
  return { admin, hrd, owner, kapten, supplier, alat: alatKode, lkp, jabatan, jabatanKapten, jabatanCrew, golongan, tunjangan, inhouse, freelance, log, hitung: { event: 0, laporanDitolak: 0, pengajuanDitolak: [] } };
}

// ---------------------------------------------------------------- Langkah per jenis transaksi

async function setoran(tx: Tx, k: Konteks, tanggal: string, jumlah: number, keterangan: string, putusan: "setujui" | "tolak" | "tunggu" = "setujui") {
  const d = validasi(skemaInvestasiKas, { tanggal, jumlah, keterangan });
  const no = await catatInvestasiKasDalam(tx, k.admin, d);
  if (putusan === "setujui") await setujuiInvestasiKasDalam(tx, k.owner, no);
  if (putusan === "tolak") {
    await tolakInvestasiKasDalam(tx, k.owner, no, "Dana belum masuk rekening usaha, catat ulang sesudah transfer diterima.");
    k.hitung.pengajuanDitolak.push(`Investasi Kas ${no}`);
  }
  return no;
}

/** Setoran awal bulan supaya kas cukup untuk pembelian tunai, gaji, dan fee bulan itu. */
async function jagaKas(tx: Tx, k: Konteks, P: string) {
  const kas = await saldoAkun(tx, AKUN.KAS);
  if (kas >= TARGET_KAS) return;
  const jumlah = Math.ceil((TARGET_KAS - kas) / 5_000_000) * 5_000_000;
  await setoran(tx, k, tgl(P, 2), jumlah, `Setoran modal pemilik ${labelPeriode(P)}`);
}

async function beliAlat(tx: Tx, k: Konteks, b: (typeof BELI_ALAT)[number]) {
  const d = validasi(skemaPembelian, {
    jenis: "PERALATAN",
    tanggal: b.tanggal,
    caraBayar: b.cara,
    jatuhTempo: b.tempo ?? "",
    supplierKode: b.supplier === null ? "" : k.supplier[b.supplier],
    keterangan: b.ket,
    baris: b.baris.map((x) => ({ barangKode: k.alat[x.alat], qty: x.qty, harga: x.harga, residu: 0, garansiBulan: x.garansi, masaManfaatBulan: x.masa, dasarN: x.dasar })),
    posting: true,
  });
  return simpanPembelianDalam(tx, k.admin, d);
}

async function beliPerlengkapan(tx: Tx, k: Konteks, P: string, r: () => number, posting = true) {
  const pilih = k.lkp.filter(() => r() < 0.6);
  const daftar = pilih.length ? pilih : [k.lkp[0], k.lkp[2]];
  const harga: Record<number, number> = { 0: 35_000, 1: 25_000, 2: 48_000, 3: 12_000, 4: 85_000, 5: 60_000 };
  const d = validasi(skemaPembelian, {
    jenis: "PERLENGKAPAN",
    tanggal: tgl(P, 4 + Math.floor(r() * 5)),
    caraBayar: "TUNAI",
    supplierKode: k.supplier[2],
    keterangan: `Perlengkapan event ${labelPeriode(P)}`,
    baris: daftar.map((kode) => ({ barangKode: kode, qty: 10 + Math.floor(r() * 30), harga: harga[k.lkp.indexOf(kode)] })),
    posting,
  });
  return simpanPembelianDalam(tx, k.admin, d);
}

async function prosesSusut(tx: Tx, k: Konteks, P: string) {
  const ada = await tx.jadwalPenyusutan.count({ where: { periodeId: P, jurnalNo: null, aset: { status: "AKTIF" } } });
  if (ada) await prosesPenyusutanDalam(tx, k.admin.id, P);
}

async function nilaiSisa(tx: Tx, k: Konteks, P: string, r: () => number) {
  const { saldo } = await bahanNilaiSisa(tx, P);
  if (!saldo.length) return;
  const isi = (f: () => number) => ({ periode: P, nilai: saldo.map((s) => ({ perlengkapanKode: s.kode, nilaiSisa: Math.floor(s.saldoBuku * f()) })) });
  // Maret: hitung fisik pertama terlalu rendah, Owner mengembalikan untuk revisi, Admin mengubah lalu mengajukan ulang.
  if (P === "2026-03") {
    const h = await simpanNilaiSisaDalam(tx, k.admin.id, isi(() => 0.15));
    await ajukanJurnal(tx, h.jurnalNo!, k.admin.id);
    await tolakJurnal(tx, h.jurnalNo!, k.owner.id, "Gudang belakang belum dihitung, nilai sisanya terlalu rendah. Hitung ulang lalu ajukan lagi.");
  }
  const h = await simpanNilaiSisaDalam(tx, k.admin.id, isi(() => 0.35 + r() * 0.25));
  if (h.jurnalNo) {
    await ajukanJurnal(tx, h.jurnalNo, k.admin.id);
    await setujuiJurnal(tx, h.jurnalNo, k.owner.id);
  }
  // November: revisi sesudah disetujui (jurnal lama dibalik, jurnal baru dibuat).
  if (P === "2026-11") {
    const o = await tx.opname.findUniqueOrThrow({ where: { periodeId: P }, include: { detail: true } });
    const nilai = o.detail.map((x, i) => ({ perlengkapanKode: x.perlengkapanKode, nilaiSisa: i === 0 ? Math.min(x.saldoBuku, x.nilaiSisa + Math.floor((x.saldoBuku - x.nilaiSisa) / 2)) : x.nilaiSisa }));
    const rv = await ajukanRevisiDalam(tx, k.admin.id, { periode: P, nilai, alasan: "Satu dus gaffer tape di mobil operasional belum terhitung." });
    await setujuiRevisiDalam(tx, k.owner.id, rv.no);
  }
}

async function lepas(tx: Tx, k: Konteks, p: (typeof PELEPASAN)[number]) {
  const [tanggal, a, bulanBeli, alasan, harga, tolak] = p;
  const aset = await tx.aset.findFirstOrThrow({
    where: { peralatanKode: k.alat[a], status: "AKTIF", bulanMulai: { gte: bulanBeli }, detailPembelian: { pembelian: { tanggal: { gte: new Date(`${bulanBeli}-01T00:00:00Z`) } } } },
    orderBy: { kode: "asc" },
  });
  const d = validasi(skemaAjukanPelepasan, { asetKode: aset.kode, tanggal, alasan, hargaJual: alasan === "DIJUAL" ? harga : "" });
  const no = await ajukanPelepasanDalam(tx, k.admin, d);
  if (tolak) {
    await tolakPelepasanDalam(tx, k.owner, no, tolak);
    k.hitung.pengajuanDitolak.push(`Pelepasan ${no}`);
  } else {
    await setujuiPelepasanDalam(tx, k.owner, no);
  }
}

async function presensiBulan(tx: Tx, k: Konteks, P: string, r: () => number) {
  for (const [i, karyawanKode] of k.inhouse.entries()) {
    // Jadwal kerja dari jabatan versi setting yang berlaku bulan itu (promosi Juli mengganti jabatan dan jamnya).
    const versi = await tx.settingGaji.findFirstOrThrow({ where: { karyawanKode, status: "DISETUJUI", berlakuMulai: { lte: P } }, orderBy: [{ berlakuMulai: "desc" }, { diputuskanPada: "desc" }] });
    const jb = JABATAN[k.jabatan.indexOf(versi.jabatanKode)] ?? JABATAN[INHOUSE[i][4]];
    for (const tanggal of hariKerja(P)) {
      const x = r();
      const absensi = x < 0.92 ? "HADIR" : x < 0.95 ? "IZIN" : x < 0.97 ? "SAKIT" : x < 0.985 ? "CUTI" : "ALPA";
      const masuk = keMenit(jb[2]) - 10 + Math.floor(r() * 15) + (r() < 0.1 ? 10 + Math.floor(r() * 25) : 0);
      const keluar = keMenit(jb[3]) + Math.floor(r() * 40);
      const d = validasi(skemaPresensi, { karyawanKode, tanggal, absensi, ...(absensi === "HADIR" ? { jamMasuk: jam(masuk), jamKeluar: jam(keluar) } : {}) });
      await simpanPresensiDalam(tx, k.hrd.id, d);
    }
  }
}

/**
 * Satu event: sesi Loading in dan Hari H (dua hari bila `duaHari`), kapten, crew freelance, dan karyawan inhouse sebagai crew,
 * kehadiran per sesi, penilaian kapten. `sampai` menentukan sejauh mana alurnya: dinilai sebagian, dikirim, atau diputuskan.
 */
async function event(tx: Tx, k: Konteks, o: { nama: string; klien: string; mulai: string; duaHari: boolean; kaptenKe: number; crew: string[]; inhouse: string[]; sampai: "sebagian" | "dikirim" | "putus"; putusPada?: string; tolakDulu?: boolean }, r: () => number) {
  const selesai = o.duaHari ? tambahHari(o.mulai, 1) : o.mulai;
  const kode = await simpanEventDalam(tx, k.hrd, validasi(skemaEvent, { nama: o.nama, klien: o.klien, tanggalMulai: o.mulai, tanggalSelesai: selesai }));
  k.hitung.event++;
  const sesi = o.duaHari
    ? [{ nama: "Loading in", tanggal: o.mulai, jamMulai: "13:00", jamSelesai: "20:00" }, { nama: "Hari H", tanggal: selesai, jamMulai: "08:00", jamSelesai: "17:00" }]
    : [{ nama: "Loading in", tanggal: o.mulai, jamMulai: "06:00", jamSelesai: "09:00" }, { nama: "Hari H", tanggal: o.mulai, jamMulai: "09:00", jamSelesai: "18:00" }];
  for (const s of sesi) await simpanSesiDalam(tx, k.hrd, validasi(skemaSesi, { eventKode: kode, ...s }));
  const kaptenKode = k.freelance[o.kaptenKe % 6];
  const tugas = [{ kode: kaptenKode, jabatan: k.jabatanKapten }, ...o.crew.map((c) => ({ kode: c, jabatan: k.jabatanCrew })), ...o.inhouse.map((c) => ({ kode: c, jabatan: k.jabatanCrew }))];
  for (const t of tugas) await simpanPenugasanDalam(tx, k.hrd, validasi(skemaPenugasan, { eventKode: kode, karyawanKode: t.kode, jabatanKode: t.jabatan }));
  const daftarSesi = await tx.sesiEvent.findMany({ where: { eventKode: kode }, orderBy: [{ tanggal: "asc" }, { jamMulai: "asc" }] });
  for (const s of daftarSesi) {
    for (const t of tugas) {
      const telat = t.kode === kaptenKode ? 0 : r() < 0.2 ? 15 + Math.floor(r() * 30) : Math.floor(r() * 5);
      const pulang = keMenit(s.jamSelesai) - (r() < 0.1 ? 60 : 0);
      await simpanKehadiranDalam(tx, k.hrd, validasi(skemaKehadiran, { sesiId: s.id, karyawanKode: t.kode, jamMasuk: jam(keMenit(s.jamMulai) + telat), jamPulang: jam(pulang), catatanProgres: s.nama === "Hari H" ? "Setup panggung dan operasional acara" : "Loading peralatan" }));
    }
  }
  // Kapten menilai kehadiran crew (bukan dirinya); sesekali KURANG dengan jam diakui dan catatan.
  const kapten = k.kapten.get(kaptenKode)!;
  const kehadiran = await tx.kehadiranEvent.findMany({ where: { sesi: { eventKode: kode }, karyawanKode: { not: kaptenKode } }, orderBy: { id: "asc" }, include: { sesi: true } });
  const dinilai = o.sampai === "sebagian" ? kehadiran.slice(0, Math.ceil(kehadiran.length / 2)) : kehadiran;
  for (const kh of dinilai) {
    const tercatat = Math.min(keMenit(kh.jamPulang), keMenit(kh.sesi.jamSelesai)) - Math.max(keMenit(kh.jamMasuk), keMenit(kh.sesi.jamMulai));
    const kurang = r() < 0.12 && tercatat > 90;
    await nilaiKehadiranDalam(tx, kapten, validasi(skemaPenilaian, kurang ? { id: kh.id, penilaian: "KURANG", jamDiakui: `${Math.floor((tercatat - 60) / 60)}:${String((tercatat - 60) % 60).padStart(2, "0")}`, catatan: "Istirahat terlalu lama tanpa izin kapten" } : { id: kh.id, penilaian: "SESUAI" }));
  }
  if (o.sampai === "sebagian") return kode;
  let no = await kirimLaporanDalam(tx, kapten, kode, "Acara berjalan lancar.");
  if (o.sampai === "dikirim") return kode;
  const tanggal = o.putusPada ?? tambahHari(selesai, 2);
  if (o.tolakDulu) {
    await tolakFeeDalam(tx, k.owner.id, no, "Jam pulang crew di sesi Hari H tidak sesuai foto absen. Mohon dicek ulang.");
    k.hitung.laporanDitolak++;
    k.hitung.pengajuanDitolak.push(`Laporan fee ${no}`);
    no = await kirimLaporanDalam(tx, kapten, kode, "Sudah dicek ulang dengan foto absen, jam sesuai.");
  }
  const b = (await muatBahanEvent(tx, kode))!;
  await setujuiFeeDalam(tx, k.owner.id, { no, fee: b.orang.map((x) => ({ karyawanKode: x.karyawanKode, feeAkhir: x.usulan.fee })) }, tanggal);
  return kode;
}

async function eventBulan(tx: Tx, k: Konteks, P: string, ke: number, r: () => number) {
  const n = JUMLAH_EVENT[ke];
  for (let i = 0; i < n; i++) {
    const urut = k.hitung.event;
    const crewFreelance = k.freelance.slice(6).filter(() => r() < 0.55).slice(0, 4);
    const crew = crewFreelance.length >= 2 ? crewFreelance : k.freelance.slice(6 + (urut % 5), 8 + (urut % 5));
    // Karyawan inhouse ikut sebagai crew sesekali (marketing di pameran, crew produksi di event besar).
    const inhouse = urut % 3 === 1 ? [k.inhouse[5]] : urut % 4 === 2 ? [k.inhouse[7]] : [];
    const hari = 5 + i * 7 + Math.floor(r() * 3);
    await event(tx, k, {
      nama: `${NAMA_EVENT[urut % NAMA_EVENT.length]} ${KLIEN[urut % KLIEN.length].replace(/^PT /, "")}`,
      klien: KLIEN[urut % KLIEN.length],
      mulai: tgl(P, hari),
      duaHari: r() < 0.4,
      kaptenKe: urut,
      crew,
      inhouse,
      sampai: "putus",
      tolakDulu: P === "2026-02" && i === 1,
    }, r);
  }
}

async function gajiBulan(tx: Tx, k: Konteks, P: string) {
  for (const [bulan, i, jenis, nominal, keterangan] of PENYESUAIAN) {
    if (bulan === P) await simpanPenyesuaianDalam(tx, k.hrd.id, { periode: P, karyawanKode: k.inhouse[i], jenis, nominal, keterangan });
  }
  const a = await ajukanGajiBulananDalam(tx, k.hrd.id, P);
  // Mei: Owner menolak karena satu presensi salah, HRD memperbaiki lalu mengajukan ulang.
  if (P === "2026-05") {
    await tolakPenggajianDalam(tx, k.owner.id, a.no, "Presensi Fajar tanggal 12 Mei tertulis alpa, padahal ada surat sakit. Perbaiki lalu ajukan ulang.");
    k.hitung.pengajuanDitolak.push(`Gaji Bulanan ${a.no}`);
    const p = await tx.presensi.findFirstOrThrow({ where: { karyawanKode: k.inhouse[4], tanggal: new Date("2026-05-12T00:00:00Z") } });
    await simpanPresensiDalam(tx, k.hrd.id, validasi(skemaPresensi, { id: p.id, karyawanKode: k.inhouse[4], tanggal: "2026-05-12", absensi: "SAKIT" }));
    const ulang = await ajukanGajiBulananDalam(tx, k.hrd.id, P);
    await setujuiPenggajianDalam(tx, k.owner.id, ulang.no);
    return;
  }
  await setujuiPenggajianDalam(tx, k.owner.id, a.no);
}

// ---------------------------------------------------------------- Pemeriksaan akhir

export type HasilPeriksa = { seimbang: { periode: string; debit: number; kredit: number; seimbang: boolean }[]; kasTerendah: { saldo: number; tanggal: string; no: string }; penghitung: { kunci: string; nilai: number; data: number }[] };

/** Nomor terbesar yang dipakai data untuk tiap kunci penghitung. */
async function nomorTerpakai(tx: Tx): Promise<Map<string, number>> {
  const hasil = new Map<string, number>();
  const catat = (kunci: string, n: number) => hasil.set(kunci, Math.max(hasil.get(kunci) ?? 0, n));
  const bertahun = (no: string) => {
    const m = /^([A-Z]+)-(\d{4})-(\d+)$/.exec(no);
    if (m) catat(m[1] + m[2], Number(m[3]));
  };
  const tanpaTahun = (no: string) => {
    const m = /^([A-Z]+)-(\d+)$/.exec(no);
    if (m) catat(m[1], Number(m[2]));
  };
  const [jurnal, beli, lepasD, gaji, ev, fee, inv] = await Promise.all([
    tx.jurnal.findMany({ select: { no: true } }), tx.pembelian.findMany({ select: { no: true } }), tx.pelepasan.findMany({ select: { no: true } }),
    tx.penggajian.findMany({ select: { no: true } }), tx.event.findMany({ select: { kode: true } }), tx.laporanFee.findMany({ select: { no: true } }), tx.investasiKas.findMany({ select: { no: true } }),
  ]);
  for (const x of [...jurnal, ...beli, ...lepasD, ...gaji, ...fee, ...inv]) bertahun(x.no);
  for (const x of ev) bertahun(x.kode);
  const master = await Promise.all([
    tx.aset.findMany({ select: { kode: true } }), tx.supplier.findMany({ select: { kode: true } }), tx.peralatan.findMany({ select: { kode: true } }), tx.perlengkapan.findMany({ select: { kode: true } }),
    tx.kategoriAset.findMany({ select: { kode: true } }), tx.karyawan.findMany({ select: { kode: true } }), tx.jabatan.findMany({ select: { kode: true } }), tx.golongan.findMany({ select: { kode: true } }),
    tx.tunjangan.findMany({ select: { kode: true } }), tx.settingGaji.findMany({ select: { kode: true } }), tx.versiNominal.findMany({ select: { kode: true } }),
  ]);
  for (const daftar of master) for (const x of daftar) tanpaTahun(x.kode);
  return hasil;
}

export async function periksaAkhir(tx: Tx): Promise<HasilPeriksa> {
  const buku = await muatJurnalBuku(tx);
  const akun = (await tx.akun.findMany({ select: { kode: true } })).map((a) => a.kode);
  const seimbang = [...daftarPeriode("2026-01", DES), null].map((P) => {
    const n = neracaSaldo(P ? buku.filter((j) => j.periode <= P) : buku, akun, P);
    return { periode: P ?? "semua", debit: n.debit, kredit: n.kredit, seimbang: n.seimbang };
  });
  // Saldo kas berjalan urut tanggal lalu nomor jurnal (jurnal DISETUJUI saja).
  let saldo = 0;
  let kasTerendah = { saldo: Number.POSITIVE_INFINITY, tanggal: "", no: "" };
  for (const j of [...buku].sort((a, b) => (a.tanggal + a.no).localeCompare(b.tanggal + b.no))) {
    for (const b of j.baris) if (b.akun === AKUN.KAS) saldo += b.debit - b.kredit;
    if (saldo < kasTerendah.saldo) kasTerendah = { saldo, tanggal: j.tanggal, no: j.no };
  }
  const terpakai = await nomorTerpakai(tx);
  const penghitung = (await tx.penghitung.findMany({ orderBy: { kunci: "asc" } })).map((p) => ({ kunci: p.kunci, nilai: p.nilai, data: terpakai.get(p.kunci) ?? 0 }));
  for (const [kunci, n] of terpakai) if (!penghitung.some((p) => p.kunci === kunci)) penghitung.push({ kunci, nilai: 0, data: n });
  return { seimbang, kasTerendah, penghitung };
}

/** Lempar galat bila neraca tidak seimbang, kas pernah negatif, atau penghitung tidak cocok dengan data. */
export function wajibLolos(h: HasilPeriksa) {
  const galat: string[] = [];
  for (const s of h.seimbang) if (!s.seimbang) galat.push(`Neraca saldo ${s.periode} tidak seimbang: debit ${s.debit}, kredit ${s.kredit}.`);
  if (h.kasTerendah.saldo < 0) galat.push(`Saldo kas negatif ${h.kasTerendah.saldo} sesudah ${h.kasTerendah.no} (${h.kasTerendah.tanggal}).`);
  for (const p of h.penghitung) if (p.nilai !== p.data) galat.push(`Penghitung ${p.kunci} = ${p.nilai}, nomor terbesar di data = ${p.data}.`);
  if (galat.length) throw new Error(`Pemeriksaan akhir gagal:\n- ${galat.join("\n- ")}`);
}

export async function ringkasan(tx: Tx) {
  const [jurnal, aset, asetAktif, event, kas, slip, pelepasan] = await Promise.all([
    tx.jurnal.count(), tx.aset.count(), tx.aset.count({ where: { status: "AKTIF" } }), tx.event.count(), saldoAkun(tx, AKUN.KAS), tx.slipGaji.count(), tx.pelepasan.count({ where: { status: "DISETUJUI" } }),
  ]);
  const perStatus = await tx.jurnal.groupBy({ by: ["status"], _count: true });
  return { jurnal, jurnalPerStatus: Object.fromEntries(perStatus.map((s) => [s.status, s._count])), aset, asetAktif, pelepasan, event, slip, kas };
}

// ---------------------------------------------------------------- Seed utama

export async function seedSetahun(tx: Tx, log: (s: string) => void = console.log) {
  const k = await master(tx, log);
  const r = acak("sia-setahun-2026");

  // Contoh pengajuan ditolak: setoran Maret yang dananya belum masuk.
  for (const [ke, P] of BULAN.entries()) {
    await jagaKas(tx, k, P);
    if (P === "2026-03") await setoran(tx, k, "2026-03-05", 25_000_000, "Setoran tambahan dari rekening pribadi pemilik", "tolak");
    if (P === "2026-04") {
      // Kenaikan tunjangan Makan berlaku April, diajukan HRD dan disetujui Owner di awal April.
      const a = await ajukanNominalDalam(tx, k.hrd.id, { jenis: "TUNJANGAN", itemKode: k.tunjangan[1], nominal: 450_000, tunjJabatan: 0, tunjKeluarga: 0, berlaku: "2026-04", alasan: "Kenaikan uang makan mengikuti harga bahan pokok" });
      await setujuiNominalDalam(tx, k.owner.id, a.kode);
    }
    if (P === "2026-07") {
      // Promosi Dimas Prakoso: Crew Produksi Golongan I menjadi Operator Sound & Lighting Golongan II mulai Juli.
      const a = await ajukanSettingDalam(tx, k.hrd.id, { karyawanKode: k.inhouse[3], jenisPerubahan: "PROMOSI", jabatanKode: k.jabatan[2], golonganKode: k.golongan[1], tunjanganKodes: [k.tunjangan[0], k.tunjangan[1]], alasan: "Promosi menjadi operator sound sesudah sertifikasi" }, "2026-07");
      await setujuiSettingDalam(tx, k.owner.id, a.kode);
    }
    for (const b of BELI_ALAT.filter((x) => x.tanggal.startsWith(P))) await beliAlat(tx, k, b);
    if (!TANPA_PERLENGKAPAN.has(P)) await beliPerlengkapan(tx, k, P, r);
    for (const p of PELEPASAN.filter((x) => x[0].startsWith(P))) await lepas(tx, k, p);
    await presensiBulan(tx, k, P, r);
    await eventBulan(tx, k, P, ke, r);
    if (P === "2026-11") {
      // Event akhir November dengan karyawan inhouse; Owner memutuskan 2 Desember, jadi upahnya masuk Gaji Bulanan Desember.
      await event(tx, k, { nama: "Pameran Akhir Tahun Malang Town Square", klien: "Malang Town Square", mulai: "2026-11-27", duaHari: true, kaptenKe: 2, crew: [k.freelance[6], k.freelance[8]], inhouse: [k.inhouse[5], k.inhouse[7]], sampai: "dikirim" }, r);
    }
    await gajiBulan(tx, k, P);
    await prosesSusut(tx, k, P);
    await nilaiSisa(tx, k, P, r);
    log(`${labelPeriode(P)}: selesai, kas ${rupiah(await saldoAkun(tx, AKUN.KAS))}.`);
  }

  // Desember: sebagian alur sengaja dibiarkan terbuka untuk dicoba di UI.
  await jagaKas(tx, k, DES);
  const lapNov = await tx.laporanFee.findFirstOrThrow({ where: { status: "DIAJUKAN", event: { tanggalMulai: new Date("2026-11-27T00:00:00Z") } } });
  const bNov = (await muatBahanEvent(tx, lapNov.eventKode))!;
  await setujuiFeeDalam(tx, k.owner.id, { no: lapNov.no, fee: bNov.orang.map((x) => ({ karyawanKode: x.karyawanKode, feeAkhir: x.usulan.fee })) }, "2026-12-02");
  await beliPerlengkapan(tx, k, DES, r, false);
  await presensiBulan(tx, k, DES, r);
  await event(tx, k, { nama: "Natal Bersama Hotel Tugu", klien: "Hotel Tugu Malang", mulai: "2026-12-05", duaHari: false, kaptenKe: 0, crew: [k.freelance[7], k.freelance[9], k.freelance[10]], inhouse: [], sampai: "dikirim" }, r);
  await event(tx, k, { nama: "Malam Tahun Baru Alun-alun", klien: "Pemkot Malang", mulai: "2026-12-12", duaHari: false, kaptenKe: 1, crew: [k.freelance[6], k.freelance[11]], inhouse: [k.inhouse[7]], sampai: "sebagian" }, r);
  await setoran(tx, k, "2026-12-10", 50_000_000, "Setoran modal untuk event akhir tahun", "tunggu");
  log("Desember: presensi, setoran menunggu, pembelian draf, event menunggu Owner, event dinilai kapten. Penyusutan, nilai sisa, dan Gaji Bulanan belum diproses.");
  return k.hitung;
}

function cetak(h: HasilPeriksa, r: Awaited<ReturnType<typeof ringkasan>>, catatan: Awaited<ReturnType<typeof seedSetahun>>) {
  console.log("\nNeraca saldo (debit = kredit):");
  for (const s of h.seimbang) console.log(`  ${s.periode.padEnd(7)} ${rupiah(s.debit).padStart(18)} ${rupiah(s.kredit).padStart(18)} ${s.seimbang ? "seimbang" : "TIDAK SEIMBANG"}`);
  console.log(`Saldo kas terendah: ${rupiah(h.kasTerendah.saldo)} sesudah ${h.kasTerendah.no} (${h.kasTerendah.tanggal}).`);
  const tidakCocok = h.penghitung.filter((p) => p.nilai !== p.data);
  console.log(`Penghitung nomor: ${h.penghitung.length} kunci, ${tidakCocok.length ? `${tidakCocok.length} tidak cocok` : "semua cocok dengan data"}.`);
  console.log(`Ringkasan: ${r.jurnal} jurnal (${Object.entries(r.jurnalPerStatus).map(([s, n]) => `${s} ${n}`).join(", ")}), ${r.aset} aset (${r.asetAktif} aktif, ${r.pelepasan} dilepas), ${r.event} event, ${r.slip} slip gaji, kas akhir ${rupiah(r.kas)}.`);
  console.log(`Contoh pengajuan ditolak: ${catatan.pengajuanDitolak.join(", ")}.`);
}

/** Satu transaksi penuh: kosongkan (opsional), seed, periksa. Dipakai skrip ini dan bangun-ulang-setahun.ts. */
export async function jalankanSeedSetahun(opsi: { kosongkan: boolean; coba: boolean }) {
  class Batal extends Error {}
  const OPSI_TX = { timeout: 30 * 60_000, maxWait: 60_000 };
  try {
    await db.$transaction(async (tx) => {
      if (opsi.kosongkan) {
        const tabel = await kosongkanSemua(tx);
        console.log(`Dikosongkan ${tabel.length} tabel: ${tabel.join(", ")}.`);
      }
      const catatan = await seedSetahun(tx);
      const h = await periksaAkhir(tx);
      cetak(h, await ringkasan(tx), catatan);
      wajibLolos(h);
      if (opsi.coba) throw new Batal();
    }, OPSI_TX);
    console.log("\nSelesai dan tersimpan. Masuk dengan admin/adminsia, hrd/hrdsia, owner/ownersia, kapten sampai kapten6/kaptensia.");
  } catch (e) {
    if (e instanceof Batal) {
      console.log("\nMode --coba: semua langkah berhasil, lalu dibatalkan (tidak ada yang tersimpan).");
      return;
    }
    throw e;
  }
}

async function main() {
  const ada = await db.pengguna.count();
  if (ada > 0 && process.env.SEED_PAKSA !== "1") {
    console.error("Database sudah berisi data. Pakai database kosong sesudah migrasi, atau jalankan dengan SEED_PAKSA=1 untuk mengosongkan semua tabel data dulu.");
    process.exit(1);
  }
  await jalankanSeedSetahun({ kosongkan: ada > 0, coba: process.argv.includes("--coba") });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e instanceof GalatAksi ? `Galat: ${e.message}` : e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}

