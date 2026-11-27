/*
 * Data contoh dari database kosong sesudah migrasi, sekarang Januari 2025 sampai Desember 2026 (TAHUN_AWAL dan
 * TAHUN_AKHIR). Nama berkas tetap seed-setahun.ts supaya perintah lama (`npm run db:seed`, seed Prisma,
 * bangun-ulang-setahun.ts) tidak berubah. Master diisi sekali di bulan pertama, lalu ditransaksikan tiap bulan lewat
 * layanan yang sama dengan server action aplikasi (src/lib/server/*Dalam, skema zod aplikasi), jadi tidak ada jurnal
 * yang ditulis tangan:
 *   setoran modal awal dan setoran berikutnya lewat Investasi Kas (Maret 2026 ditolak), setoran peralatan dari pemilik,
 *   pembelian peralatan dan perlengkapan, penyusutan dan nilai sisa tiap bulan (Maret 2026 dikembalikan Owner lalu
 *   disetujui, November 2026 direvisi sesudah disetujui), pelepasan dijual dan dibuang termasuk aset yang masa manfaatnya
 *   habis (satu ditolak Owner Maret 2026), karyawan inhouse bertambah 2025 dan 2026, presensi dan Gaji Bulanan tiap bulan
 *   (Mei 2026 ditolak lalu diajukan ulang), 1 sampai 3 event per bulan dengan kapten, crew freelance, dan sesekali
 *   karyawan inhouse (satu laporan Februari 2026 ditolak lalu dikirim ulang), kenaikan nominal tiap Januari (satu kenaikan
 *   Januari 2026 ditolak) dan uang makan April 2026, diajukan HRD dan diputuskan Owner, serta promosi.
 *
 * Desember 2026 (bulan berjalan user) terbuka untuk dicoba di UI:
 *  - Gaji Bulanan sudah diajukan HRD dan menunggu Owner (berisi upah event inhouse dari event akhir November);
 *  - penyusutan dan nilai sisa belum diproses;
 *  - satu setoran menunggu Owner, satu pembelian perlengkapan masih draf, satu fee event menunggu Owner, satu event masih
 *    dinilai kapten (berisi karyawan inhouse; karena gaji Desember sudah diajukan, upahnya masuk gaji Januari 2027);
 *  - pengajuan setting gaji dan nominal dari HRD berlaku Januari 2027 menunggu Owner.
 *
 * Rentang bisa diperluas dengan mengubah TAHUN_AWAL dan TAHUN_AKHIR: tabel per tahun di bawah terisi 2023 sampai 2028,
 * dan rentangnya harus memuat 2026. Bila data melewati Desember 2026, penyusutan dan nilai sisa Desember 2026 ikut
 * diproses (bulan sesudahnya hanya boleh diproses bila bulan yang lebih lama sudah selesai), Desember tahun akhir yang
 * dibiarkan belum diproses, dan pengajuan HRD berlaku di bulan itu. Aplikasi membatasi pemrosesan sampai Desember tahun
 * berjalan (periodeBatasProses), jadi seed memakai batas sendiri (BATAS_PROSES).
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
import { ajukanNominalDalam, setujuiNominalDalam, tolakNominalDalam } from "../src/lib/server/nominal";
import { ajukanSettingDalam, setujuiSettingDalam } from "../src/lib/server/setting-gaji";
import { catatInvestasiKasDalam, setujuiInvestasiKasDalam, tolakInvestasiKasDalam } from "../src/lib/server/investasi-kas";
import { simpanPembelianDalam } from "../src/lib/server/pembelian";
import { prosesPenyusutanDalam } from "../src/lib/server/penyusutan";
import { ajukanRevisiDalam, setujuiRevisiDalam, simpanNilaiSisaDalam } from "../src/lib/server/nilai-sisa";
import { ajukanPelepasanDalam, setujuiPelepasanDalam, tolakPelepasanDalam } from "../src/lib/server/pelepasan";
import { simpanPresensiDalam } from "../src/lib/server/presensi";
import { ajukanGajiBulananDalam, hapusPenyesuaianDalam, setujuiPenggajianDalam, simpanPenyesuaianDalam, tolakPenggajianDalam } from "../src/lib/server/gaji-bulanan";
import { simpanEventDalam, simpanKehadiranDalam, simpanPenugasanDalam, simpanSesiDalam } from "../src/lib/server/event";
import { kirimLaporanDalam, nilaiKehadiranDalam } from "../src/lib/server/penilaian";
import { setujuiFeeDalam, tolakFeeDalam } from "../src/lib/server/keputusan-fee";
import { muatBahanEvent } from "../src/lib/data/fee-event/bahan";
import { bahanNilaiSisa } from "../src/lib/data/konversi/nilai-sisa";
import { AKUN, AKUN_GAJI_BULANAN } from "../src/lib/inti/akun";
import { neracaSaldo } from "../src/lib/inti/buku-besar";
import { daftarPeriode, hariTerakhir, keMenit, labelPeriode, tambahBulan, tambahBulanTanggal, tambahHari } from "../src/lib/inti/tanggal";
import { rupiah } from "../src/lib/format";
import { skemaInvestasiKas } from "../src/lib/skema/modal";
import { skemaPembelian } from "../src/lib/skema/pembelian";
import { skemaAjukanPelepasan } from "../src/lib/skema/konversi";
import { skemaPresensi } from "../src/lib/skema/sdm";
import { skemaEvent, skemaKehadiran, skemaPenilaian, skemaPenugasan, skemaSesi } from "../src/lib/skema/fee-event";
import type { JenisNominal, Peran, StatusPtkp, TipeAkun } from "../src/generated/prisma/enums";
import { kosongkanSemua } from "./kosongkan";

/** Rentang data contoh (lihat keterangan berkas). */
const TAHUN_AWAL = 2025;
const TAHUN_AKHIR = 2026;
const AWAL = `${TAHUN_AWAL}-01`;
/** Bulan berjalan user: sebagian alur dibiarkan terbuka. */
const DES_COBA = "2026-12";
/** Bulan terakhir data: penyusutan dan nilai sisanya belum diproses. */
const AKHIR = `${TAHUN_AKHIR}-12`;
const BULAN = daftarPeriode(AWAL, AKHIR);
const TAHUN = Array.from({ length: TAHUN_AKHIR - TAHUN_AWAL + 1 }, (_, i) => TAHUN_AWAL + i);
/** Seed memproses penyusutan dan nilai sisa sampai bulan terakhir data (aplikasi: Desember tahun berjalan). */
const BATAS_PROSES = AKHIR;
/** Bulan berlaku pengajuan HRD yang menunggu Owner: bulan yang belum punya slip gaji diajukan atau dibayar. */
const BERLAKU_MENUNGGU = AKHIR === DES_COBA ? tambahBulan(AKHIR, 1) : AKHIR;
export const RENTANG = `${labelPeriode(AWAL)} sampai ${labelPeriode(AKHIR)}`;
const tahunDari = (P: string) => Number(P.slice(0, 4));

/** Hari libur nasional per tahun (disederhanakan) yang tidak diisi presensi. */
const LIBUR = new Set([
  "2023-01-02", "2023-01-23", "2023-03-22", "2023-04-07", "2023-04-21", "2023-04-24", "2023-04-25", "2023-05-01", "2023-05-18", "2023-06-01", "2023-06-29", "2023-07-19", "2023-08-17", "2023-09-28", "2023-12-25",
  "2024-01-01", "2024-02-08", "2024-03-11", "2024-03-29", "2024-04-10", "2024-04-11", "2024-05-01", "2024-05-09", "2024-05-23", "2024-06-17", "2024-08-16", "2024-09-16", "2024-12-25",
  "2025-01-01", "2025-01-27", "2025-01-29", "2025-03-31", "2025-04-01", "2025-04-18", "2025-05-01", "2025-05-12", "2025-05-29", "2025-06-06", "2025-06-27", "2025-09-05", "2025-12-25",
  "2026-01-01", "2026-02-17", "2026-03-19", "2026-03-20", "2026-04-03", "2026-05-01", "2026-05-14", "2026-05-27", "2026-06-01", "2026-08-17", "2026-12-25",
  "2027-01-01", "2027-02-08", "2027-03-08", "2027-03-10", "2027-03-11", "2027-03-26", "2027-05-06", "2027-05-17", "2027-05-20", "2027-06-01", "2027-08-17", "2027-12-24",
  "2028-01-26", "2028-02-28", "2028-02-29", "2028-04-14", "2028-05-01", "2028-05-05", "2028-05-09", "2028-05-25", "2028-06-01", "2028-08-03", "2028-08-17", "2028-12-25",
]);
/** Kas dijaga minimal sebesar ini di awal bulan lewat setoran Investasi Kas (naik mengikuti gaji dan event). */
const TARGET_KAS: Record<number, number> = { 2023: 120_000_000, 2024: 135_000_000, 2025: 150_000_000, 2026: 170_000_000, 2027: 185_000_000, 2028: 200_000_000 };
/**
 * Tambahan target kas untuk bulan sesudah Desember 2026 (hanya bila rentang diperluas). Gaji Bulanan, fee event, dan
 * pembelian draf Desember 2026 baru dibayar saat dicoba di UI, jadi saldo kas sesudahnya harus tetap positif.
 */
const CADANGAN_DES_COBA = 100_000_000;

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
/** Harga 2026, dasar N, garansi, dan masa manfaat bawaan tiap peralatan (urutan sama dengan PERALATAN). */
const ALAT_DASAR: [number, "GARANSI" | "MASA_MANFAAT", number, number][] = [
  [14_500_000, "MASA_MANFAAT", 24, 60],
  [9_800_000, "MASA_MANFAAT", 12, 60],
  [18_000_000, "MASA_MANFAAT", 12, 60],
  [12_500_000, "MASA_MANFAAT", 12, 48],
  [950_000, "GARANSI", 24, 24],
  [9_000_000, "MASA_MANFAAT", 12, 48],
  [2_800_000, "MASA_MANFAAT", 12, 60],
  [3_200_000, "MASA_MANFAAT", 12, 60],
];
/** [nama, satuan, harga 2026] */
const PERLENGKAPAN: [string, string, number][] = [
  ["Gaffer Tape", "roll", 35_000],
  ["Kabel Ties", "pak", 25_000],
  ["Baterai AA", "pak", 48_000],
  ["ID Card dan Lanyard", "pcs", 12_000],
  ["Cetak Banner/X-Banner", "lembar", 85_000],
  ["Plastik Wrap", "roll", 60_000],
];
/** Harga naik kira-kira 3,5% per tahun dari harga 2026. */
const hargaTahun = (dasar: number, Y: number, pembulat: number) => Math.round((dasar * (1 + 0.035 * (Y - 2026))) / pembulat) * pembulat;

/** [nama, akun biaya, jam masuk, jam keluar, tunj. jabatan 2026, tunj. istri/anak 2026] */
const JABATAN: [string, string, string, string, number, number][] = [
  ["Event Manager", "6-210", "08:00", "17:00", 1_500_000, 400_000],
  ["Crew Produksi", "6-210", "07:00", "16:00", 250_000, 200_000],
  ["Operator Sound & Lighting", "6-210", "07:00", "16:00", 500_000, 250_000],
  ["Admin Keuangan", "6-220", "08:00", "17:00", 400_000, 250_000],
  ["Marketing & Promosi", "6-220", "08:00", "17:00", 450_000, 250_000],
];
/** Tunjangan jabatan dan istri/anak per tahun relatif terhadap 2026, dibulatkan ke Rp10.000. */
const FAKTOR_JABATAN: Record<number, number> = { 2023: 0.85, 2024: 0.9, 2025: 0.95, 2026: 1, 2027: 1.05, 2028: 1.1 };
const bulat10rb = (x: number) => Math.round(x / 10_000) * 10_000;
const GOLONGAN = ["Golongan I", "Golongan II", "Golongan III", "Golongan IV"];
/** Gaji pokok per golongan, berlaku tiap Januari. */
const NOMINAL_GOLONGAN: Record<number, number[]> = {
  2023: [3_200_000, 3_800_000, 4_900_000, 6_800_000],
  2024: [3_400_000, 4_000_000, 5_200_000, 7_200_000],
  2025: [3_600_000, 4_250_000, 5_500_000, 7_600_000],
  2026: [3_800_000, 4_500_000, 5_800_000, 8_000_000],
  2027: [4_000_000, 4_750_000, 6_100_000, 8_400_000],
  2028: [4_200_000, 5_000_000, 6_400_000, 8_800_000],
};
const TUNJANGAN = ["Transport", "Makan", "Komunikasi", "Kesehatan"];
/** Tunjangan lain per tahun, berlaku tiap Januari (Makan naik lagi April 2026). Nilai sama dengan tahun lalu tidak diajukan. */
const NOMINAL_TUNJANGAN: Record<number, number[]> = {
  2023: [250_000, 350_000, 75_000, 150_000],
  2024: [275_000, 375_000, 100_000, 175_000],
  2025: [300_000, 400_000, 100_000, 200_000],
  2026: [300_000, 400_000, 100_000, 200_000],
  2027: [325_000, 475_000, 125_000, 225_000],
  2028: [350_000, 500_000, 125_000, 250_000],
};
/** Tarif jabatan event: [berlaku, kapten per hari, crew per jam]. */
const TARIF_EVENT: [string, number, number][] = [["2023-01", 175_000, 17_500], ["2025-01", 200_000, 20_000], ["2027-07", 225_000, 22_500]];

/** Karyawan inhouse: [nama, PTKP, bank, rekening, indeks jabatan, indeks golongan, indeks tunjangan, mulai bekerja] */
const INHOUSE: [string, StatusPtkp, string, string, number, number, number[], string][] = [
  ["Raka Aditya Wijaya", "K2", "BCA", "1234567890", 0, 3, [0, 1, 2, 3], "2023-01"],
  ["Nadia Putri Anggraini", "TK0", "Mandiri", "1370012345678", 3, 1, [0, 1, 3], "2023-01"],
  ["Bagas Setiawan", "K1", "BRI", "002101009876", 2, 1, [0, 1], "2023-01"],
  ["Dimas Prakoso", "TK1", "BNI", "0987654321", 1, 0, [1], "2023-01"],
  ["Fajar Ramadhan", "K0", "BCA", "5550001234", 1, 0, [0, 1], "2023-01"],
  ["Andrew Pratama", "TK0", "BCA", "7781234500", 4, 1, [0, 1, 2], "2024-03"],
  ["Citra Lestari", "TK0", "Mandiri", "1440099887766", 4, 0, [0, 1, 2], "2025-02"],
  ["Yoga Saputra", "TK0", "BRI", "005522114455", 1, 0, [1], "2023-01"],
  ["Intan Permatasari", "K0", "BNI", "0466778899", 3, 0, [0, 1, 3], "2023-01"],
  ["Rizky Firmansyah", "TK1", "BCA", "3349876501", 2, 1, [0, 1], "2026-01"],
];
/** Perubahan setting gaji: [berlaku, karyawan, jenis, jabatan, golongan, tunjangan, alasan] */
const UBAH_SETTING: [string, number, "PROMOSI" | "PENYESUAIAN", number, number, number[], string][] = [
  ["2024-07", 1, "PENYESUAIAN", 3, 2, [0, 1, 3], "Penyesuaian golongan sesudah 18 bulan masa kerja"],
  ["2026-07", 3, "PROMOSI", 2, 1, [0, 1], "Promosi menjadi operator sound sesudah sertifikasi"],
  ["2027-08", 7, "PROMOSI", 2, 1, [0, 1], "Promosi menjadi operator sound & lighting sesudah sertifikasi"],
  ["2028-04", 2, "PENYESUAIAN", 2, 2, [0, 1], "Penyesuaian golongan operator senior"],
];
/** Pengajuan HRD yang menunggu Owner dan bisa disetujui, berlaku BERLAKU_MENUNGGU. */
const SETTING_MENUNGGU = { karyawan: 8, jabatan: 3, golongan: 1, tunjangan: [0, 1, 3], alasan: "Penyesuaian golongan sesudah evaluasi tahunan" };
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
type RencanaBeli = { tanggal: string; cara: "TUNAI" | "KREDIT" | "INVESTASI"; supplier: number | null; tempo?: string; ket: string; baris: BarisAlat[] };
const alat = (a: number, qty: number, harga: number, dasar: "GARANSI" | "MASA_MANFAAT", garansi: number, masa: number): BarisAlat => ({ alat: a, qty, harga, dasar, garansi, masa });
/** Pembelian dengan harga, dasar N, garansi, dan masa manfaat bawaan tahun itu. Kredit jatuh tempo sebulan. */
function beli(tanggal: string, cara: RencanaBeli["cara"], supplier: number | null, ket: string, isi: [number, number][]): RencanaBeli {
  const Y = tahunDari(tanggal);
  const baris = isi.map(([a, qty]) => alat(a, qty, hargaTahun(ALAT_DASAR[a][0], Y, 50_000), ALAT_DASAR[a][1], ALAT_DASAR[a][2], ALAT_DASAR[a][3]));
  return { tanggal, cara, supplier, tempo: cara === "KREDIT" ? tambahBulanTanggal(tanggal, 1) : undefined, ket, baris };
}
/** Pembelian peralatan per bulan (satu kartu aset per unit); yang di luar rentang data dilewati. */
const BELI_ALAT: RencanaBeli[] = [
  beli("2023-01-09", "INVESTASI", null, "Setoran peralatan awal dari pemilik", [[0, 2], [2, 1], [4, 4], [1, 2]]),
  beli("2023-03-14", "TUNAI", 1, "Kamera dan laptop pertama", [[3, 1], [5, 1]]),
  beli("2023-06-12", "KREDIT", 0, "Wireless mic dan lampu par", [[6, 3], [7, 4]]),
  beli("2023-09-18", "TUNAI", 3, "Lighting untuk musim wisuda", [[1, 2], [7, 2]]),
  beli("2023-11-08", "TUNAI", 4, "Laptop dan HT tambahan", [[5, 1], [4, 2]]),
  beli("2024-02-06", "TUNAI", 1, "Kamera kedua dan HT", [[3, 1], [4, 3]]),
  beli("2024-04-15", "KREDIT", 3, "Moving head dan lampu par", [[1, 2], [7, 4]]),
  beli("2024-07-10", "TUNAI", 0, "Speaker dan wireless mic", [[0, 2], [6, 2]]),
  beli("2024-09-10", "TUNAI", 3, "Lampu par dan wireless mic tambahan", [[7, 4], [6, 2]]),
  beli("2024-10-07", "TUNAI", 4, "Laptop editing", [[5, 2]]),
  // Dua HT bekas (sisa umur setahun) ditulis paling depan supaya masa manfaatnya habis di dalam rentang data.
  {
    ...beli("2025-01-13", "INVESTASI", null, "Setoran peralatan dari pemilik", []),
    baris: [alat(4, 2, 400_000, "GARANSI", 12, 12), ...beli("2025-01-13", "INVESTASI", null, "", [[0, 4], [1, 6], [2, 1], [3, 2], [4, 6], [5, 2], [6, 3], [7, 6]]).baris],
  },
  beli("2025-03-11", "TUNAI", 1, "Kamera dan HT", [[3, 2], [4, 3]]),
  beli("2025-06-16", "KREDIT", 3, "Lighting panggung besar", [[1, 4], [7, 4]]),
  beli("2025-08-12", "TUNAI", 2, "Wireless mic dan HT", [[6, 3], [4, 2]]),
  beli("2025-11-10", "TUNAI", 4, "Laptop operasional", [[5, 2]]),
  { tanggal: "2026-01-08", cara: "INVESTASI", supplier: null, ket: "Setoran peralatan ketiga dari pemilik", baris: [alat(0, 2, 14_500_000, "MASA_MANFAAT", 24, 60), alat(1, 4, 9_800_000, "MASA_MANFAAT", 12, 60), alat(2, 1, 18_000_000, "MASA_MANFAAT", 12, 60), alat(4, 3, 950_000, "GARANSI", 24, 24)] },
  { tanggal: "2026-02-12", cara: "TUNAI", supplier: 1, ket: "Kamera dan laptop dokumentasi", baris: [alat(3, 2, 12_500_000, "MASA_MANFAAT", 12, 48), alat(5, 2, 9_000_000, "MASA_MANFAAT", 12, 48), alat(4, 2, 950_000, "GARANSI", 24, 24)] },
  { tanggal: "2026-03-10", cara: "KREDIT", supplier: 0, tempo: "2026-04-10", ket: "Wireless mic dan lampu par", baris: [alat(6, 4, 2_800_000, "MASA_MANFAAT", 12, 60), alat(7, 2, 3_200_000, "MASA_MANFAAT", 12, 60)] },
  { tanggal: "2026-05-15", cara: "TUNAI", supplier: 3, ket: "Tambahan lighting musim wisuda", baris: [alat(1, 2, 9_800_000, "MASA_MANFAAT", 12, 60), alat(7, 4, 3_200_000, "MASA_MANFAAT", 12, 60)] },
  { tanggal: "2026-07-09", cara: "TUNAI", supplier: 2, ket: "HT dan wireless mic tambahan", baris: [alat(4, 4, 950_000, "GARANSI", 24, 24), alat(6, 2, 2_800_000, "MASA_MANFAAT", 12, 60)] },
  { tanggal: "2026-09-11", cara: "KREDIT", supplier: 1, tempo: "2026-10-11", ket: "Kamera dan laptop baru", baris: [alat(3, 1, 13_000_000, "MASA_MANFAAT", 12, 48), alat(5, 2, 9_500_000, "MASA_MANFAAT", 12, 48)] },
  { tanggal: "2026-09-21", cara: "TUNAI", supplier: 0, ket: "Mixer cadangan dan speaker", baris: [alat(2, 1, 18_500_000, "MASA_MANFAAT", 12, 60), alat(0, 2, 15_000_000, "MASA_MANFAAT", 24, 60)] },
  { tanggal: "2026-11-06", cara: "TUNAI", supplier: 3, ket: "Persiapan event akhir tahun", baris: [alat(7, 3, 3_300_000, "MASA_MANFAAT", 12, 60), alat(6, 2, 2_900_000, "MASA_MANFAAT", 12, 60)] },
  beli("2027-02-09", "TUNAI", 1, "Kamera dan laptop pengganti", [[3, 2], [5, 1]]),
  beli("2027-04-13", "KREDIT", 3, "Lighting untuk panggung outdoor", [[1, 4], [7, 6]]),
  beli("2027-06-08", "TUNAI", 0, "Speaker dan mixer pengganti", [[0, 2], [2, 1]]),
  beli("2027-07-13", "TUNAI", 3, "Moving head dan lampu par tambahan", [[1, 2], [7, 4]]),
  beli("2027-09-14", "TUNAI", 2, "HT pengganti dan wireless mic", [[4, 6], [6, 2]]),
  beli("2027-11-09", "TUNAI", 4, "Laptop operasional", [[5, 2]]),
  beli("2028-01-11", "TUNAI", 1, "Kamera dokumentasi", [[3, 2]]),
  beli("2028-03-14", "KREDIT", 3, "Moving head dan lampu par", [[1, 4], [7, 6]]),
  beli("2028-05-09", "TUNAI", 0, "Speaker dan wireless mic", [[0, 2], [6, 4]]),
  beli("2028-06-13", "TUNAI", 1, "Kamera dan laptop untuk tim dokumentasi kedua", [[3, 2], [5, 2]]),
  beli("2028-08-08", "TUNAI", 2, "HT untuk crew", [[4, 6]]),
  beli("2028-10-10", "TUNAI", 4, "Laptop dan mixer cadangan", [[5, 2], [2, 1]]),
];
/** Bulan tanpa pembelian perlengkapan (sisanya tiap bulan). */
const TANPA_PERLENGKAPAN = new Set(["2023-02", "2024-08", "2025-05", "2026-08", "2027-03", "2028-07"]);
/**
 * Pelepasan: [tanggal, alat, bulan beli, alasan, harga jual, alasan tolak Owner]. Aset yang dipilih = aset aktif pertama
 * jenis itu yang dibeli pada bulan beli atau sesudahnya; baris dengan bulan beli sebelum AWAL dilewati. Sebagian aset
 * sudah habis masa manfaatnya (nilai buku 0).
 */
const PELEPASAN: [string, number, string, "DIJUAL" | "DIBUANG", number, string | null][] = [
  ["2023-10-17", 4, "2023-01", "DIBUANG", 0, null],
  ["2024-05-21", 5, "2023-03", "DIJUAL", 4_500_000, null],
  ["2025-02-18", 4, "2023-01", "DIBUANG", 0, null],
  ["2025-02-19", 4, "2023-01", "DIBUANG", 0, null],
  ["2025-09-23", 1, "2023-01", "DIJUAL", 5_000_000, null],
  ["2025-09-24", 1, "2025-01", "DIJUAL", 6_500_000, null],
  ["2026-03-20", 5, "2026-02", "DIBUANG", 0, "Laptop masih bisa diperbaiki, jangan dibuang dulu."],
  ["2026-04-15", 4, "2025-01", "DIBUANG", 0, null],
  ["2026-06-18", 4, "2026-01", "DIJUAL", 500_000, null],
  ["2026-08-20", 4, "2026-02", "DIBUANG", 0, null],
  ["2026-10-14", 1, "2026-01", "DIJUAL", 6_500_000, null],
  ["2027-03-16", 4, "2025-03", "DIBUANG", 0, null],
  ["2027-07-20", 3, "2023-03", "DIJUAL", 2_500_000, null],
  ["2027-10-19", 0, "2023-01", "DIJUAL", 3_000_000, null],
  ["2028-02-15", 5, "2023-11", "DIBUANG", 0, null],
  ["2028-06-20", 2, "2023-01", "DIJUAL", 4_000_000, null],
  ["2028-09-19", 4, "2025-08", "DIBUANG", 0, null],
  ["2028-11-14", 1, "2024-04", "DIJUAL", 6_000_000, "Masih dipakai untuk event akhir tahun, jual sesudah Januari."],
];
/** Event biasa per bulan (Januari sampai Desember). Desember 2026 diisi alur khusus yang terbuka untuk dicoba. */
const JUMLAH_EVENT: Record<number, number[]> = {
  2023: [1, 1, 1, 1, 2, 1, 2, 1, 1, 2, 1, 2],
  2024: [1, 2, 1, 1, 2, 2, 2, 1, 2, 2, 1, 2],
  2025: [1, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2],
  2026: [1, 2, 2, 1, 2, 3, 2, 1, 2, 2, 2, 0],
  2027: [2, 2, 2, 1, 2, 3, 2, 2, 2, 2, 3, 2],
  2028: [2, 2, 3, 1, 2, 3, 3, 2, 2, 2, 3, 1],
};
const NAMA_EVENT = ["Gathering Tahunan", "Wedding Expo", "Seminar Nasional", "Launching Produk", "Pameran UMKM", "Konser Amal", "Wisuda Kampus", "Festival Kuliner", "Family Day", "Dies Natalis", "Ulang Tahun Kota", "Pentas Seni"];
const KLIEN = ["PT Sinar Abadi", "Hotel Tugu Malang", "Universitas Brawijaya", "Bank Jatim", "Pemkot Malang", "PT Kalbe Farma", "SMA Negeri 3 Malang", "Komunitas Kuliner Malang"];
/** Potongan dan bonus manual: [bulan, indeks karyawan inhouse, jenis, nominal, keterangan] */
const PENYESUAIAN: [string, number, "POTONGAN" | "BONUS", number, string][] = [
  ["2023-07", 2, "BONUS", 500_000, "Bonus operator event wisuda"],
  ["2023-12", 0, "BONUS", 1_000_000, "Bonus akhir tahun"],
  ["2024-04", 3, "POTONGAN", 100_000, "Denda terlambat mengembalikan HT"],
  // Agustus 2024: nominal bonus salah ketik, Owner menolak, HRD membetulkan (lihat gajiBulan).
  ["2024-08", 5, "BONUS", 7_500_000, "Bonus pameran Agustus"],
  ["2024-12", 0, "BONUS", 1_200_000, "Bonus akhir tahun"],
  ["2025-06", 6, "BONUS", 600_000, "Bonus pameran Juni"],
  ["2025-10", 7, "POTONGAN", 150_000, "Denda merusak kabel XLR saat loading out"],
  ["2026-03", 7, "POTONGAN", 150_000, "Denda merusak kabel XLR saat loading out"],
  ["2026-06", 0, "BONUS", 1_000_000, "Bonus target event Juni"],
  ["2026-08", 5, "BONUS", 750_000, "Bonus pameran Agustus"],
  ["2026-10", 4, "POTONGAN", 100_000, "Denda terlambat mengembalikan HT"],
  ["2026-11", 2, "BONUS", 500_000, "Bonus lembur persiapan akhir tahun"],
  ["2027-05", 9, "BONUS", 500_000, "Bonus lembur musim wisuda"],
  ["2027-09", 4, "POTONGAN", 125_000, "Denda kehilangan ID card crew"],
  ["2027-12", 0, "BONUS", 1_500_000, "Bonus akhir tahun"],
  ["2028-03", 6, "BONUS", 750_000, "Bonus target sponsor Maret"],
  ["2028-08", 3, "POTONGAN", 150_000, "Denda terlambat loading in"],
  ["2028-11", 2, "BONUS", 600_000, "Bonus lembur persiapan akhir tahun"],
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
  /** Nominal terakhir yang disetujui per item ("JENIS:kode" -> isi), supaya kenaikan yang sama tidak diajukan. */
  nominal: Map<string, string>;
  log: (s: string) => void;
  hitung: { event: number; laporanDitolak: number; pengajuanDitolak: string[]; menungguOwner: string[] };
};

async function buatPengguna(tx: Tx, p: (typeof PENGGUNA)[number], karyawanKode: string | null): Promise<PenggunaSesi> {
  const u = await tx.pengguna.create({ data: { namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran, karyawanKode, kataSandiHash: await hashKataSandi(sandi(p.peran)) } });
  return { id: u.id, namaPengguna: u.namaPengguna, nama: u.nama, peran: u.peran };
}

async function master(tx: Tx, log: (s: string) => void): Promise<Konteks> {
  await pastikanPeriode(tx, ...BULAN);
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
  for (const nama of GOLONGAN) golongan.push((await tx.golongan.create({ data: { kode: await kode(AWALAN.GOLONGAN), nama } })).kode);
  const tunjangan: string[] = [];
  for (const nama of TUNJANGAN) tunjangan.push((await tx.tunjangan.create({ data: { kode: await kode(AWALAN.TUNJANGAN), nama } })).kode);

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
  const k: Konteks = {
    admin, hrd, owner, kapten, supplier, alat: alatKode, lkp, jabatan, jabatanKapten, jabatanCrew, golongan, tunjangan, inhouse, freelance,
    nominal: new Map(), log, hitung: { event: 0, laporanDitolak: 0, pengajuanDitolak: [], menungguOwner: [] },
  };
  // Nominal awal berlaku di bulan pertama: diajukan HRD, disetujui Owner.
  await nominalTahun(tx, k, TAHUN_AWAL, `Nominal awal tahun ${TAHUN_AWAL}`);
  log(`Master: ${supplier.length} supplier, ${alatKode.length} peralatan, ${lkp.length} perlengkapan, ${jabatan.length + 2} jabatan, ${inhouse.length} karyawan inhouse, ${freelance.length} crew freelance, ${PENGGUNA.length} pengguna.`);
  return k;
}

// ---------------------------------------------------------------- Nominal dan setting gaji (HRD mengajukan, Owner memutuskan)

type IsiNominal = { jenis: JenisNominal; itemKode: string; nominal?: number; tunjJabatan?: number; tunjKeluarga?: number };

/** Ajukan satu versi nominal lalu putuskan. Versi yang isinya sama dengan yang berlaku dilewati (null). */
async function ubahNominal(tx: Tx, k: Konteks, d: IsiNominal, berlaku: string, alasan: string, putusan: "setujui" | "tolak" | "tunggu" = "setujui", alasanTolak = "") {
  const isi = { nominal: d.nominal ?? 0, tunjJabatan: d.tunjJabatan ?? 0, tunjKeluarga: d.tunjKeluarga ?? 0 };
  const kunci = `${d.jenis}:${d.itemKode}`;
  const jejak = `${isi.nominal}/${isi.tunjJabatan}/${isi.tunjKeluarga}`;
  if (k.nominal.get(kunci) === jejak) return null;
  const a = await ajukanNominalDalam(tx, k.hrd.id, { jenis: d.jenis, itemKode: d.itemKode, ...isi, berlaku, alasan });
  if (putusan === "setujui") {
    await setujuiNominalDalam(tx, k.owner.id, a.kode);
    k.nominal.set(kunci, jejak);
  } else if (putusan === "tolak") {
    await tolakNominalDalam(tx, k.owner.id, a.kode, alasanTolak);
    k.hitung.pengajuanDitolak.push(`Nominal ${a.kode}`);
  } else {
    k.hitung.menungguOwner.push(`Nominal ${a.kode} (${a.nama}, berlaku ${labelPeriode(berlaku)})`);
  }
  return a.kode;
}

/** Nominal golongan, tunjangan, dan tunjangan jabatan tahun Y berlaku Januari (yang tidak berubah dilewati). */
async function nominalTahun(tx: Tx, k: Konteks, Y: number, alasan: string) {
  const P = `${Y}-01`;
  for (const [i, n] of NOMINAL_GOLONGAN[Y].entries()) {
    // Januari 2026: kenaikan Golongan IV pertama ditolak Owner karena melebihi anggaran, lalu diajukan ulang.
    if (Y === 2026 && i === 3) {
      await ubahNominal(tx, k, { jenis: "GOLONGAN", itemKode: k.golongan[i], nominal: 8_500_000 }, P, alasan, "tolak", "Kenaikan Golongan IV melebihi rencana anggaran 2026. Ajukan ulang paling banyak Rp8.000.000.");
    }
    await ubahNominal(tx, k, { jenis: "GOLONGAN", itemKode: k.golongan[i], nominal: n }, P, alasan);
  }
  for (const [i, n] of NOMINAL_TUNJANGAN[Y].entries()) await ubahNominal(tx, k, { jenis: "TUNJANGAN", itemKode: k.tunjangan[i], nominal: n }, P, alasan);
  for (const [i, j] of JABATAN.entries()) {
    await ubahNominal(tx, k, { jenis: "JABATAN", itemKode: k.jabatan[i], tunjJabatan: bulat10rb(j[4] * FAKTOR_JABATAN[Y]), tunjKeluarga: bulat10rb(j[5] * FAKTOR_JABATAN[Y]) }, P, alasan);
  }
}

async function tarifEvent(tx: Tx, k: Konteks, P: string) {
  // Bulan pertama memakai tarif terakhir yang sudah berlaku saat itu.
  const daftar = P === AWAL ? TARIF_EVENT.filter((t) => t[0] <= P).slice(-1) : TARIF_EVENT.filter((t) => t[0] === P);
  for (const [, kapten, crew] of daftar) {
    const alasan = P === AWAL ? "Tarif awal jabatan event" : "Penyesuaian tarif event mengikuti harga pasar crew Malang";
    await ubahNominal(tx, k, { jenis: "JABATAN_EVENT", itemKode: k.jabatanKapten, nominal: kapten }, P, alasan);
    await ubahNominal(tx, k, { jenis: "JABATAN_EVENT", itemKode: k.jabatanCrew, nominal: crew }, P, alasan);
  }
}

/** Bulan mulai bekerja di data contoh: karyawan yang sudah bekerja sebelum AWAL disetting di bulan pertama. */
const mulaiKerja = (i: number) => (INHOUSE[i][7] > AWAL ? INHOUSE[i][7] : AWAL);

async function ajukanSetting(tx: Tx, k: Konteks, i: number, jenis: "SETTING_AWAL" | "PROMOSI" | "PENYESUAIAN", jb: number, gl: number, tj: number[], alasan: string, berlaku: string) {
  return ajukanSettingDalam(tx, k.hrd.id, { karyawanKode: k.inhouse[i], jenisPerubahan: jenis, jabatanKode: k.jabatan[jb], golonganKode: k.golongan[gl], tunjanganKodes: tj.map((t) => k.tunjangan[t]), alasan }, berlaku);
}

async function settingKaryawan(tx: Tx, k: Konteks, P: string) {
  for (const [i, x] of INHOUSE.entries()) {
    if (mulaiKerja(i) !== P) continue;
    // Setting awal sudah memuat perubahan yang berlaku sebelum bulan pertama data.
    const lama = UBAH_SETTING.filter((u) => u[1] === i && u[0] < P).at(-1);
    const alasan = P === AWAL ? `Setting awal karyawan tahun ${TAHUN_AWAL}` : "Setting awal karyawan baru";
    const a = await ajukanSetting(tx, k, i, "SETTING_AWAL", lama?.[3] ?? x[4], lama?.[4] ?? x[5], lama?.[5] ?? x[6], alasan, P);
    await setujuiSettingDalam(tx, k.owner.id, a.kode);
  }
  for (const [, i, jenis, jb, gl, tj, alasan] of UBAH_SETTING.filter((u) => u[0] === P && P > mulaiKerja(u[1]))) {
    const a = await ajukanSetting(tx, k, i, jenis, jb, gl, tj, alasan, P);
    await setujuiSettingDalam(tx, k.owner.id, a.kode);
  }
}

/** Pengajuan HRD yang sengaja dibiarkan menunggu Owner: nominal tunjangan Kesehatan dan satu setting gaji. */
async function pengajuanMenunggu(tx: Tx, k: Konteks) {
  const kesehatan = NOMINAL_TUNJANGAN[TAHUN_AKHIR][3] + 25_000;
  await ubahNominal(tx, k, { jenis: "TUNJANGAN", itemKode: k.tunjangan[3], nominal: kesehatan }, BERLAKU_MENUNGGU, "Penyesuaian premi asuransi kesehatan", "tunggu");
  const m = SETTING_MENUNGGU;
  const a = await ajukanSetting(tx, k, m.karyawan, "PENYESUAIAN", m.jabatan, m.golongan, m.tunjangan, m.alasan, BERLAKU_MENUNGGU);
  k.hitung.menungguOwner.push(`Setting gaji ${a.kode} (${a.nama}, berlaku ${labelPeriode(BERLAKU_MENUNGGU)})`);
}

/** Karyawan inhouse yang sudah bekerja di bulan P. */
const sudahBekerja = (k: Konteks, P: string) => k.inhouse.filter((_, i) => mulaiKerja(i) <= P);

// ---------------------------------------------------------------- Langkah per jenis transaksi

async function setoran(tx: Tx, k: Konteks, tanggal: string, jumlah: number, keterangan: string, putusan: "setujui" | "tolak" | "tunggu" = "setujui") {
  const d = validasi(skemaInvestasiKas, { tanggal, jumlah, keterangan });
  const no = await catatInvestasiKasDalam(tx, k.admin, d);
  if (putusan === "setujui") await setujuiInvestasiKasDalam(tx, k.owner, no);
  if (putusan === "tolak") {
    await tolakInvestasiKasDalam(tx, k.owner, no, "Dana belum masuk rekening usaha, catat ulang sesudah transfer diterima.");
    k.hitung.pengajuanDitolak.push(`Investasi Kas ${no}`);
  }
  if (putusan === "tunggu") k.hitung.menungguOwner.push(`Investasi Kas ${no}`);
  return no;
}

/** Setoran awal bulan supaya kas cukup untuk pembelian tunai, gaji, dan fee bulan itu (ditambah cadangan sesudah Desember 2026). */
async function jagaKas(tx: Tx, k: Konteks, P: string) {
  const tunai = BELI_ALAT.filter((b) => b.cara === "TUNAI" && b.tanggal.startsWith(P)).reduce((s, b) => s + b.baris.reduce((t, x) => t + x.qty * x.harga, 0), 0);
  const target = TARGET_KAS[tahunDari(P)] + tunai + (P > DES_COBA ? CADANGAN_DES_COBA : 0);
  const kas = await saldoAkun(tx, AKUN.KAS);
  if (kas >= target) return;
  const jumlah = Math.ceil((target - kas) / 5_000_000) * 5_000_000;
  await setoran(tx, k, tgl(P, 2), jumlah, `${P === AWAL ? "Setoran modal awal pemilik" : "Setoran modal pemilik"} ${labelPeriode(P)}`);
}

async function beliAlat(tx: Tx, k: Konteks, b: RencanaBeli) {
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
  const Y = tahunDari(P);
  const d = validasi(skemaPembelian, {
    jenis: "PERLENGKAPAN",
    tanggal: tgl(P, 4 + Math.floor(r() * 5)),
    caraBayar: "TUNAI",
    supplierKode: k.supplier[2],
    keterangan: `Perlengkapan event ${labelPeriode(P)}`,
    baris: daftar.map((kode) => ({ barangKode: kode, qty: 10 + Math.floor(r() * 30) + (Y - 2023) * 2, harga: hargaTahun(PERLENGKAPAN[k.lkp.indexOf(kode)][2], Y, 1_000) })),
    posting,
  });
  return simpanPembelianDalam(tx, k.admin, d);
}

async function prosesSusut(tx: Tx, k: Konteks, P: string) {
  const ada = await tx.jadwalPenyusutan.count({ where: { periodeId: P, jurnalNo: null, aset: { status: "AKTIF" } } });
  if (ada) await prosesPenyusutanDalam(tx, k.admin.id, P, BATAS_PROSES);
}

async function nilaiSisa(tx: Tx, k: Konteks, P: string, r: () => number) {
  const { saldo } = await bahanNilaiSisa(tx, P);
  if (!saldo.length) return;
  const isi = (f: () => number) => ({ periode: P, nilai: saldo.map((s) => ({ perlengkapanKode: s.kode, nilaiSisa: Math.floor(s.saldoBuku * f()) })) });
  // Maret 2026: hitung fisik pertama terlalu rendah, Owner mengembalikan untuk revisi, Admin mengubah lalu mengajukan ulang.
  if (P === "2026-03") {
    const h = await simpanNilaiSisaDalam(tx, k.admin.id, isi(() => 0.15), BATAS_PROSES);
    await ajukanJurnal(tx, h.jurnalNo!, k.admin.id);
    await tolakJurnal(tx, h.jurnalNo!, k.owner.id, "Gudang belakang belum dihitung, nilai sisanya terlalu rendah. Hitung ulang lalu ajukan lagi.");
  }
  const h = await simpanNilaiSisaDalam(tx, k.admin.id, isi(() => 0.35 + r() * 0.25), BATAS_PROSES);
  if (h.jurnalNo) {
    await ajukanJurnal(tx, h.jurnalNo, k.admin.id);
    await setujuiJurnal(tx, h.jurnalNo, k.owner.id);
  }
  // November 2026: revisi sesudah disetujui (jurnal lama dibalik, jurnal baru dibuat).
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
  for (const karyawanKode of sudahBekerja(k, P)) {
    // Jadwal kerja dari jabatan versi setting yang berlaku bulan itu (promosi mengganti jabatan dan jamnya).
    const versi = await tx.settingGaji.findFirstOrThrow({ where: { karyawanKode, status: "DISETUJUI", berlakuMulai: { lte: P } }, orderBy: [{ berlakuMulai: "desc" }, { diputuskanPada: "desc" }] });
    const jb = JABATAN[k.jabatan.indexOf(versi.jabatanKode)];
    for (const tanggal of hariKerja(P)) {
      const x = r();
      const absensi = x < 0.92 ? "HADIR" : x < 0.95 ? "IZIN" : x < 0.97 ? "SAKIT" : x < 0.985 ? "CUTI" : "ALPA";
      const masuk = keMenit(jb[2]) - 10 + Math.floor(r() * 15) + (r() < 0.1 ? 10 + Math.floor(r() * 25) : 0);
      const keluar = keMenit(jb[3]) + Math.floor(r() * 40);
      // Mei 2026: presensi Fajar 12 Mei salah tercatat alpa (dibetulkan sesudah Owner menolak Gaji Bulanan).
      const salah = P === "2026-05" && tanggal === "2026-05-12" && karyawanKode === k.inhouse[4];
      const d = validasi(skemaPresensi, { karyawanKode, tanggal, absensi: salah ? "ALPA" : absensi, ...(absensi === "HADIR" && !salah ? { jamMasuk: jam(masuk), jamKeluar: jam(keluar) } : {}) });
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

async function eventBulan(tx: Tx, k: Konteks, P: string, r: () => number) {
  const n = JUMLAH_EVENT[tahunDari(P)][Number(P.slice(5)) - 1];
  const bekerja = new Set(sudahBekerja(k, P));
  for (let i = 0; i < n; i++) {
    const urut = k.hitung.event;
    const crewFreelance = k.freelance.slice(6).filter(() => r() < 0.55).slice(0, 4);
    const crew = crewFreelance.length >= 2 ? crewFreelance : k.freelance.slice(6 + (urut % 5), 8 + (urut % 5));
    // Karyawan inhouse ikut sebagai crew sesekali (marketing di pameran, crew produksi di event besar).
    const inhouse = (urut % 3 === 1 ? [k.inhouse[5]] : urut % 4 === 2 ? [k.inhouse[7]] : []).filter((x) => bekerja.has(x));
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
  // Mei 2026: Owner menolak karena satu presensi salah, HRD memperbaiki lalu mengajukan ulang.
  if (P === "2026-05") {
    await tolakPenggajianDalam(tx, k.owner.id, a.no, "Presensi Fajar tanggal 12 Mei tertulis alpa, padahal ada surat sakit. Perbaiki lalu ajukan ulang.");
    k.hitung.pengajuanDitolak.push(`Gaji Bulanan ${a.no}`);
    const p = await tx.presensi.findFirstOrThrow({ where: { karyawanKode: k.inhouse[4], tanggal: new Date("2026-05-12T00:00:00Z") } });
    await simpanPresensiDalam(tx, k.hrd.id, validasi(skemaPresensi, { id: p.id, karyawanKode: k.inhouse[4], tanggal: "2026-05-12", absensi: "SAKIT" }));
    const ulang = await ajukanGajiBulananDalam(tx, k.hrd.id, P);
    await setujuiPenggajianDalam(tx, k.owner.id, ulang.no);
    return;
  }
  // Agustus 2024: bonus Andrew salah ketik Rp7.500.000, Owner menolak, HRD mengganti menjadi Rp750.000 lalu mengajukan ulang.
  if (P === "2024-08") {
    await tolakPenggajianDalam(tx, k.owner.id, a.no, "Bonus pameran Andrew tertulis Rp7.500.000, seharusnya Rp750.000. Betulkan lalu ajukan ulang.");
    k.hitung.pengajuanDitolak.push(`Gaji Bulanan ${a.no}`);
    const salah = await tx.penyesuaianGaji.findFirstOrThrow({ where: { periodeId: P, karyawanKode: k.inhouse[5], nominal: 7_500_000 } });
    await hapusPenyesuaianDalam(tx, k.hrd.id, salah.id);
    await simpanPenyesuaianDalam(tx, k.hrd.id, { periode: P, karyawanKode: k.inhouse[5], jenis: "BONUS", nominal: 750_000, keterangan: "Bonus pameran Agustus" });
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
  // Jurnal urut periode supaya neraca tiap bulan cukup memotong awal daftar (tanpa menyaring ulang semua jurnal).
  const urut = [...buku].sort((a, b) => a.periode.localeCompare(b.periode));
  let n = 0;
  const seimbang = [...BULAN, null].map((P) => {
    if (P) while (n < urut.length && urut[n].periode <= P) n++;
    const ns = neracaSaldo(P ? urut.slice(0, n) : buku, akun, P);
    return { periode: P ?? "semua", debit: ns.debit, kredit: ns.kredit, seimbang: ns.seimbang };
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

/** Ringkasan per tahun: jurnal, slip gaji, event, aset dibeli dan dilepas, kas akhir Desember. */
export async function ringkasanPerTahun(tx: Tx) {
  const hasil = [];
  for (const Y of TAHUN) {
    const awal = new Date(`${Y}-01-01T00:00:00Z`);
    const akhir = new Date(`${Y}-12-31T00:00:00Z`);
    const [jurnal, slip, event, asetBeli, asetLepas, kas] = await Promise.all([
      tx.jurnal.count({ where: { periodeId: { gte: `${Y}-01`, lte: `${Y}-12` } } }),
      tx.slipGaji.count({ where: { periodeId: { gte: `${Y}-01`, lte: `${Y}-12` } } }),
      tx.event.count({ where: { tanggalMulai: { gte: awal, lte: akhir } } }),
      tx.aset.count({ where: { bulanMulai: { gte: `${Y}-01`, lte: `${Y}-12` } } }),
      tx.pelepasan.count({ where: { status: "DISETUJUI", tanggal: { gte: awal, lte: akhir } } }),
      saldoAkun(tx, AKUN.KAS, `${Y}-12`),
    ]);
    hasil.push({ tahun: Y, jurnal, slip, event, asetBeli, asetLepas, kas });
  }
  return hasil;
}

// ---------------------------------------------------------------- Seed utama

export async function seedSetahun(tx: Tx, log: (s: string) => void = console.log) {
  const k = await master(tx, log);
  const r = acak("sia-data-contoh");

  for (const P of BULAN) {
    const Y = tahunDari(P);
    await jagaKas(tx, k, P);
    if (P.endsWith("-01") && Y > TAHUN_AWAL) await nominalTahun(tx, k, Y, `Kenaikan tahunan ${Y}`);
    await tarifEvent(tx, k, P);
    // Kenaikan tunjangan Makan April 2026, diajukan HRD dan disetujui Owner di awal April.
    if (P === "2026-04") await ubahNominal(tx, k, { jenis: "TUNJANGAN", itemKode: k.tunjangan[1], nominal: 450_000 }, P, "Kenaikan uang makan mengikuti harga bahan pokok");
    await settingKaryawan(tx, k, P);
    // Contoh setoran ditolak: dana yang dicatat belum masuk rekening usaha.
    if (P === "2024-06") await setoran(tx, k, "2024-06-07", 20_000_000, "Setoran tambahan dari rekening pribadi pemilik", "tolak");
    if (P === "2026-03") await setoran(tx, k, "2026-03-05", 25_000_000, "Setoran tambahan dari rekening pribadi pemilik", "tolak");
    for (const b of BELI_ALAT.filter((x) => x.tanggal.startsWith(P))) await beliAlat(tx, k, b);
    if (P === DES_COBA) await beliPerlengkapan(tx, k, P, r, false);
    else if (!TANPA_PERLENGKAPAN.has(P)) await beliPerlengkapan(tx, k, P, r);
    for (const p of PELEPASAN.filter((x) => x[0].startsWith(P) && x[2] >= AWAL)) await lepas(tx, k, p);
    await presensiBulan(tx, k, P, r);

    if (P === DES_COBA) {
      // Event 27-28 November diputuskan Owner 2 Desember, jadi upah karyawan inhouse-nya masuk Gaji Bulanan Desember 2026.
      const lapNov = await tx.laporanFee.findFirstOrThrow({ where: { status: "DIAJUKAN", event: { tanggalMulai: new Date("2026-11-27T00:00:00Z") } } });
      const bNov = (await muatBahanEvent(tx, lapNov.eventKode))!;
      await setujuiFeeDalam(tx, k.owner.id, { no: lapNov.no, fee: bNov.orang.map((x) => ({ karyawanKode: x.karyawanKode, feeAkhir: x.usulan.fee })) }, "2026-12-02");
      await event(tx, k, { nama: "Natal Bersama Hotel Tugu", klien: "Hotel Tugu Malang", mulai: "2026-12-05", duaHari: false, kaptenKe: 0, crew: [k.freelance[7], k.freelance[9], k.freelance[10]], inhouse: [], sampai: "dikirim" }, r);
      await event(tx, k, { nama: "Malam Tahun Baru Alun-alun", klien: "Pemkot Malang", mulai: "2026-12-12", duaHari: false, kaptenKe: 1, crew: [k.freelance[6], k.freelance[11]], inhouse: [k.inhouse[7]], sampai: "sebagian" }, r);
      await setoran(tx, k, "2026-12-10", 50_000_000, "Setoran modal untuk event akhir tahun", "tunggu");
    } else {
      await eventBulan(tx, k, P, r);
    }
    if (P === "2026-11") {
      // Event akhir November dengan karyawan inhouse; Owner memutuskan 2 Desember (lihat Desember 2026).
      await event(tx, k, { nama: "Pameran Akhir Tahun Malang Town Square", klien: "Malang Town Square", mulai: "2026-11-27", duaHari: true, kaptenKe: 2, crew: [k.freelance[6], k.freelance[8]], inhouse: [k.inhouse[5], k.inhouse[7]], sampai: "dikirim" }, r);
    }
    // Gaji Bulanan Desember 2026 berhenti di pengajuan HRD (Owner memutuskan lewat UI).
    if (P === DES_COBA) {
      const a = await ajukanGajiBulananDalam(tx, k.hrd.id, P);
      k.hitung.menungguOwner.push(`Gaji Bulanan ${a.no} (${labelPeriode(P)})`);
    } else if (P !== AKHIR) await gajiBulan(tx, k, P);
    if (P !== AKHIR) {
      await prosesSusut(tx, k, P);
      await nilaiSisa(tx, k, P, r);
    } else await pengajuanMenunggu(tx, k);
    if (P.endsWith("-12")) log(`${Y}: selesai, kas ${rupiah(await saldoAkun(tx, AKUN.KAS))}, ${k.hitung.event} event sejak ${TAHUN_AWAL}.`);
  }
  log(`${labelPeriode(DES_COBA)}: setoran menunggu Owner, pembelian perlengkapan draf, event menunggu Owner, event dinilai kapten, Gaji Bulanan menunggu Owner.`);
  log(`${labelPeriode(AKHIR)}: penyusutan dan nilai sisa belum diproses${AKHIR === DES_COBA ? "" : ", Gaji Bulanan belum diajukan"}. Setting gaji dan nominal menunggu Owner berlaku ${labelPeriode(BERLAKU_MENUNGGU)}.`);
  return k.hitung;
}

function cetak(h: HasilPeriksa, r: Awaited<ReturnType<typeof ringkasan>>, tahun: Awaited<ReturnType<typeof ringkasanPerTahun>>, catatan: Awaited<ReturnType<typeof seedSetahun>>) {
  const tidakSeimbang = h.seimbang.filter((s) => !s.seimbang);
  console.log(`\nNeraca saldo: ${h.seimbang.length - 1} bulan (${BULAN[0]} sampai ${BULAN.at(-1)}) dan semua periode, ${tidakSeimbang.length ? `${tidakSeimbang.length} TIDAK SEIMBANG` : "semuanya seimbang"}.`);
  for (const s of h.seimbang.filter((x) => x.periode.endsWith("-12") || x.periode === "semua" || !x.seimbang)) {
    console.log(`  ${s.periode.padEnd(7)} ${rupiah(s.debit).padStart(18)} ${rupiah(s.kredit).padStart(18)} ${s.seimbang ? "seimbang" : "TIDAK SEIMBANG"}`);
  }
  console.log(`Saldo kas terendah: ${rupiah(h.kasTerendah.saldo)} sesudah ${h.kasTerendah.no} (${h.kasTerendah.tanggal}).`);
  const tidakCocok = h.penghitung.filter((p) => p.nilai !== p.data);
  console.log(`Penghitung nomor: ${h.penghitung.length} kunci, ${tidakCocok.length ? `${tidakCocok.length} tidak cocok` : "semua cocok dengan data"}.`);
  console.log("\nPer tahun (jurnal, slip gaji, event, aset dibeli, aset dilepas, kas akhir Desember):");
  for (const t of tahun) console.log(`  ${t.tahun}  ${String(t.jurnal).padStart(4)} jurnal  ${String(t.slip).padStart(4)} slip  ${String(t.event).padStart(3)} event  ${String(t.asetBeli).padStart(3)} aset  ${String(t.asetLepas).padStart(2)} dilepas  kas ${rupiah(t.kas)}`);
  console.log(`Total: ${r.jurnal} jurnal (${Object.entries(r.jurnalPerStatus).map(([s, n]) => `${s} ${n}`).join(", ")}), ${r.aset} aset (${r.asetAktif} aktif, ${r.pelepasan} dilepas), ${r.event} event, ${r.slip} slip gaji, kas akhir ${rupiah(r.kas)}.`);
  console.log(`Contoh pengajuan ditolak: ${catatan.pengajuanDitolak.join(", ")}.`);
  console.log(`Menunggu Owner: ${catatan.menungguOwner.join(", ")}.`);
}

/** Satu transaksi penuh: kosongkan (opsional), seed, periksa. Dipakai skrip ini dan bangun-ulang-setahun.ts. */
export async function jalankanSeedSetahun(opsi: { kosongkan: boolean; coba: boolean }) {
  class Batal extends Error {}
  const OPSI_TX = { timeout: 30 * 60_000, maxWait: 60_000 };
  const mulai = Date.now();
  try {
    await db.$transaction(async (tx) => {
      if (opsi.kosongkan) {
        const tabel = await kosongkanSemua(tx);
        console.log(`Dikosongkan ${tabel.length} tabel: ${tabel.join(", ")}.`);
      }
      const catatan = await seedSetahun(tx);
      const h = await periksaAkhir(tx);
      cetak(h, await ringkasan(tx), await ringkasanPerTahun(tx), catatan);
      wajibLolos(h);
      console.log(`Waktu di dalam transaksi: ${Math.round((Date.now() - mulai) / 1000)} detik.`);
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
