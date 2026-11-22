/*
 * Menambah data dummy yang banyak dan beragam ke database yang sudah berisi (produksi), terutama modul penggajian:
 * - master: 2 jabatan inhouse baru (+ jadwal kerja), 1 golongan, 1 tunjangan, 2 jabatan event baru, 5 karyawan inhouse,
 *   17 karyawan event (4 di antaranya kapten dengan akun kapten3 sampai kapten6, kata sandi kapten123);
 * - gaji inhouse November 2026: presensi lengkap semua karyawan inhouse, slip dihitung, penggajian diajukan, disetujui,
 *   dijurnal, dan dibayar;
 * - fee event: 10 event Oktober sampai Desember 2026 di semua tahap (belum ada kehadiran, belum dinilai, sebagian dinilai,
 *   laporan menunggu Owner, laporan ditolak lalu dinilai ulang, disetujui dan dibayar, termasuk fee akhir yang diubah Owner);
 * - satu jurnal setoran modal pemilik (Dr Kas, Kr Modal) supaya kas cukup membayar gaji November.
 *
 * Data lama tidak diubah. EVT-2026-0001 dan EVT-2026-0002 dibiarkan apa adanya sebagai contoh "menunggu".
 * Semua langkah meniru server action aplikasi (urutan cek, klaim status, log) dan memakai rumus serta layanan yang sama:
 * hitungGaji, muatBahanGaji, muatBahanEvent (hitungFeeOrang), pph21BukanPegawai, barisGaji, barisFeeEvent, buatJurnal,
 * saldoAkun, nomorDokumen, kodeBerikutnya, nomorSlip, nomorSlipFee. Server action tidak bisa dipanggil langsung dari skrip
 * karena butuh cookie sesi Next dan masing-masing membuka transaksi sendiri.
 *
 * Semuanya dalam satu transaksi. Sebelum commit skrip memeriksa neraca saldo seimbang dan saldo kas tidak pernah negatif
 * (urut tanggal lalu nomor jurnal); bila gagal, semua dibatalkan. Skrip menolak jalan kedua kali (penanda di log aktivitas
 * dan nama pengguna kapten3 sampai kapten6).
 *
 * Jalankan: npx tsx prisma/tambah-dummy.ts
 * Coba tanpa menyimpan (semua langkah dijalankan lalu dibatalkan): npx tsx prisma/tambah-dummy.ts --coba
 */
import "dotenv/config";
import { db, type Tx } from "../src/lib/server/db";
import { GalatAksi, validasi } from "../src/lib/server/aksi";
import { AWALAN, kodeBerikutnya, nomorDokumen, nomorSlip, nomorSlipFee } from "../src/lib/server/nomor";
import { pastikanTerbuka } from "../src/lib/server/periode";
import { buatJurnal, muatJurnalBuku, saldoAkun } from "../src/lib/server/jurnal";
import { catatLog } from "../src/lib/server/log";
import { hashKataSandi } from "../src/lib/server/kata-sandi";
import { AKUN } from "../src/lib/inti/akun";
import { barisFeeEvent, barisGaji } from "../src/lib/inti/jurnal";
import { neracaSaldo } from "../src/lib/inti/buku-besar";
import { hitungGaji, hitungTerlambat, type JenisAbsensi } from "../src/lib/inti/penggajian";
import { durasiKeMenit, menitTercatat, pph21BukanPegawai } from "../src/lib/inti/fee-event";
import { hariTerakhir, keDate, keMenit, labelPeriode, labelTanggal } from "../src/lib/inti/tanggal";
import { muatBahanGaji, type BahanGaji } from "../src/lib/data/sdm/gaji";
import { kunciEvent, muatBahanEvent, pastikanKaptenEvent } from "../src/lib/data/fee-event/bahan";
import { skemaPresensi } from "../src/lib/skema/sdm";
import { skemaEvent, skemaKehadiran, skemaKirimLaporan, skemaPenilaian, skemaSesi, skemaSetujuiFee, skemaTolakFee } from "../src/lib/skema/fee-event";
import type { StatusPtkp } from "../src/generated/prisma/enums";

const PENANDA = "data-dummy.tambah";
const SANDI_KAPTEN = "kapten123";
const PERIODE_GAJI = "2026-11";
const SETORAN_MODAL = 75_000_000;
const COBA = process.argv.includes("--coba");

/** Waktu WIB: waktu("2026-10-05 10:00") -> Date. */
const waktu = (t: string) => new Date(`${t.replace(" ", "T")}:00+07:00`);
const jam = (menit: number) => `${String(Math.floor(menit / 60)).padStart(2, "0")}:${String(menit % 60).padStart(2, "0")}`;

/** PRNG kecil berbiji supaya presensi dummy selalu sama tiap dijalankan. */
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

/** Fisher-Yates dengan PRNG berbiji. */
function kocok<T>(daftar: T[], r: () => number): T[] {
  const a = [...daftar];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ====================================================================== Rencana data

type Ptkp = StatusPtkp;

const JABATAN_INHOUSE = [
  { kunci: "desainer", nama: "Desainer Grafis & Multimedia", tunjJabatan: 450_000, tunjKeluarga: 250_000, akunBebanKode: AKUN.BIAYA_GAJI_PRODUKSI, jamMasuk: "09:00", jamKeluar: "18:00" },
  { kunci: "marketing", nama: "Staf Marketing & Sales", tunjJabatan: 350_000, tunjKeluarga: 200_000, akunBebanKode: AKUN.BIAYA_GAJI_ADMINISTRASI, jamMasuk: "08:30", jamKeluar: "17:30" },
];
const GOLONGAN_BARU = { nama: "Golongan Kontrak", jumlah: 3_500_000 };
const TUNJANGAN_BARU = { nama: "Insentif Penjualan", nominal: 500_000 };
const JABATAN_EVENT = [
  { kunci: "teknisi", nama: "Teknisi Sound & Lighting Event", peranEvent: "CREW" as const, satuanTarif: "JAM" as const, tarif: 30_000 },
  { kunci: "usher", nama: "Usher & Registrasi Event", peranEvent: "CREW" as const, satuanTarif: "HARI" as const, tarif: 150_000 },
];

/** Profil presensi November: banyaknya izin, sakit, cuti, alpa, dan hari terlambat. */
type Profil = { izin?: number; sakit?: number; cuti?: number; alpa?: number; telat?: number };

/** Karyawan inhouse baru. jabatan = kunci jabatan baru atau kode jabatan lama; golongan "baru" = golongan baru. */
const INHOUSE: { nama: string; ptkp: Ptkp; bank: string; noRek: string; jabatan: string; golongan: string; tunjangan: string[]; profil: Profil }[] = [
  { nama: "Sinta Maharani", ptkp: "TK1", bank: "BCA", noRek: "7720345678", jabatan: "desainer", golongan: "GP-03", tunjangan: ["TNJ-01", "TNJ-02", "TNJ-03"], profil: { cuti: 1, telat: 2 } },
  { nama: "Teguh Santoso", ptkp: "K3", bank: "Mandiri", noRek: "1440012233445", jabatan: "JBT-01", golongan: "GP-03", tunjangan: ["TNJ-01", "TNJ-02", "TNJ-03", "TNJ-04"], profil: { cuti: 3 } },
  { nama: "Putri Rahmawati", ptkp: "TK0", bank: "BRI", noRek: "005801234567", jabatan: "marketing", golongan: "GP-02", tunjangan: ["TNJ-01", "TNJ-03", "baru"], profil: { sakit: 1, alpa: 1, telat: 5 } },
  { nama: "Adi Nugraha", ptkp: "K1", bank: "BNI", noRek: "0567891234", jabatan: "JBT-03", golongan: "GP-01", tunjangan: ["TNJ-01", "TNJ-02"], profil: { sakit: 2, izin: 1 } },
  { nama: "Yusuf Habibi", ptkp: "TK0", bank: "BSI", noRek: "7134567890", jabatan: "JBT-02", golongan: "baru", tunjangan: ["TNJ-02"], profil: { telat: 1 } },
];
/** Profil presensi November untuk karyawan inhouse lama (presensinya ditambah, datanya tidak diubah). */
const PROFIL_LAMA: Record<string, Profil> = {
  "KRY-01": { telat: 2 },
  "KRY-02": { sakit: 1, izin: 1, telat: 3 },
  "KRY-03": { cuti: 2, alpa: 1 },
  "KRY-04": { sakit: 1, alpa: 2, telat: 4 },
  "KRY-05": { izin: 1 },
};

/** Karyawan event baru. akun = nama pengguna kapten bila orang ini kapten. */
const CREW: { kunci: string; nama: string; ptkp: Ptkp; bank: string; noRek: string; akun?: string }[] = [
  { kunci: "hendra", nama: "Hendra Gunawan", ptkp: "K2", bank: "BCA", noRek: "7731122334", akun: "kapten3" },
  { kunci: "lestari", nama: "Lestari Ayuningtyas", ptkp: "TK0", bank: "BRI", noRek: "005611223344", akun: "kapten4" },
  { kunci: "wahyu", nama: "Wahyu Kurniawan", ptkp: "K1", bank: "Mandiri", noRek: "1440023344556", akun: "kapten5" },
  { kunci: "rina", nama: "Rina Marlina", ptkp: "TK1", bank: "BNI", noRek: "0478912345", akun: "kapten6" },
  { kunci: "bayu", nama: "Bayu Saputra", ptkp: "TK0", bank: "BCA", noRek: "7741234567" },
  { kunci: "citra", nama: "Citra Kirana", ptkp: "TK0", bank: "BRI", noRek: "005621234567" },
  { kunci: "dani", nama: "Dani Ramadhan", ptkp: "TK0", bank: "Mandiri", noRek: "1440034455667" },
  { kunci: "eko", nama: "Eko Prasetyo", ptkp: "K1", bank: "BNI", noRek: "0489123456" },
  { kunci: "fitri", nama: "Fitri Handayani", ptkp: "TK0", bank: "BSI", noRek: "7145678901" },
  { kunci: "galih", nama: "Galih Permana", ptkp: "TK0", bank: "BCA", noRek: "7752345678" },
  { kunci: "hana", nama: "Hana Safitri", ptkp: "TK0", bank: "BRI", noRek: "005631234567" },
  { kunci: "ilham", nama: "Ilham Maulana", ptkp: "TK0", bank: "Mandiri", noRek: "1440045566778" },
  { kunci: "joko", nama: "Joko Susilo", ptkp: "K2", bank: "BRI", noRek: "005641234567" },
  { kunci: "kevin", nama: "Kevin Wijaya", ptkp: "TK0", bank: "BCA", noRek: "7763456789" },
  { kunci: "lukman", nama: "Lukman Hakim", ptkp: "K0", bank: "BNI", noRek: "0491234567" },
  { kunci: "maya", nama: "Maya Anggraini", ptkp: "TK0", bank: "BSI", noRek: "7156789012" },
  { kunci: "nanda", nama: "Nanda Pratiwi", ptkp: "TK0", bank: "Mandiri", noRek: "1440056677889" },
];
/** Crew event lama yang ikut ditugaskan di event baru (datanya tidak diubah). */
const CREW_LAMA: Record<string, string> = { bima: "KRY-06", rizky: "KRY-08", yoga: "KRY-09", dewi: "KRY-10", arif: "KRY-11", fajar: "KRY-12" };

/** Penilaian: kurang = jam diakui "H:MM" (wajib catatan); tanpa kurang = Sesuai. */
type Nilai = { kurang?: string; catatan?: string };
type Hadir = [orang: string, masuk: string, pulang: string, progres: string, nilai?: Nilai];
type RencanaEvent = {
  nama: string;
  klien: string;
  mulai: string;
  selesai: string;
  /** [orang, jabatan]: jabatan "kapten", "crew", "teknisi", "usher". */
  tugas: [string, string][];
  sesi: { nama: string; tanggal: string; mulai: string; selesai: string; hadir: Hadir[] }[];
};

const S: Nilai = {};

const E3: RencanaEvent = {
  nama: "Launching Produk Kopi Nusantara, Ballroom Hotel Pelangi Malang", klien: "PT Kopi Nusantara Jaya", mulai: "2026-10-03", selesai: "2026-10-04",
  tugas: [["bima", "kapten"], ["rizky", "crew"], ["bayu", "crew"], ["citra", "crew"], ["dani", "teknisi"]],
  sesi: [
    { nama: "Loading in", tanggal: "2026-10-03", mulai: "13:00", selesai: "21:00", hadir: [
      ["bima", "12:45", "21:00", "Briefing crew dan atur denah panggung"],
      ["rizky", "13:00", "21:00", "Pasang rigging dan backdrop LED", S],
      ["bayu", "13:00", "21:00", "Angkut dan rakit panggung modular", S],
      ["citra", "13:20", "21:00", "Tata meja tamu dan dekorasi area kopi", { catatan: "Datang telat 20 menit, jamnya terpotong otomatis." }],
      ["dani", "13:00", "21:30", "Tarik kabel dan pasang speaker line array", S],
    ] },
    { nama: "Hari H", tanggal: "2026-10-04", mulai: "07:00", selesai: "17:00", hadir: [
      ["bima", "06:30", "17:00", "Koordinasi rundown dengan MC dan klien", { catatan: "Rundown tepat waktu, klien puas." }],
      ["rizky", "07:00", "17:00", "Stage manager, ganti properti tiap segmen", { catatan: "Sigap, segmen demo kopi berjalan tanpa jeda." }],
      ["bayu", "07:00", "17:00", "Runner dan bantu demo barista", S],
      ["citra", "07:00", "15:00", "Registrasi media dan tamu undangan", S],
      ["dani", "07:00", "17:00", "Operator sound FOH", S],
    ] },
  ],
};

const E4: RencanaEvent = {
  nama: "Konser Amal Peduli Pendidikan, GOR Ken Arok Malang", klien: "Yayasan Cahaya Ilmu", mulai: "2026-10-16", selesai: "2026-10-19",
  tugas: [["hendra", "kapten"], ["eko", "crew"], ["fitri", "usher"], ["galih", "crew"], ["hana", "usher"], ["ilham", "crew"], ["joko", "teknisi"], ["arif", "crew"], ["fajar", "crew"]],
  sesi: [
    { nama: "Meeting", tanggal: "2026-10-16", mulai: "19:00", selesai: "21:00", hadir: [
      ["hendra", "19:00", "21:00", "Rapat teknis dengan panitia yayasan dan vendor sound"],
      ["joko", "19:00", "21:00", "Mencatat kebutuhan channel dan daya listrik", S],
      ["galih", "19:10", "21:00", "Mencatat daftar properti panggung", S],
    ] },
    { nama: "Loading in", tanggal: "2026-10-17", mulai: "08:00", selesai: "20:00", hadir: [
      ["hendra", "07:45", "20:00", "Atur urutan bongkar muat dan pembagian tugas"],
      ["eko", "08:00", "20:00", "Rakit truss dan atap panggung", S],
      ["galih", "09:30", "20:00", "Rakit panggung, datang telat karena motor mogok", { catatan: "Telat 1,5 jam, jamnya terpotong otomatis." }],
      ["ilham", "08:00", "20:00", "Tarik kabel power dari genset", S],
      ["joko", "08:00", "20:00", "Pasang line array dan monitor panggung", S],
      ["arif", "08:00", "20:00", "Pasang moving head dan setting DMX", S],
      ["fajar", "08:00", "19:00", "Angkut barang dan bantu rigging", S],
    ] },
    { nama: "Gladi", tanggal: "2026-10-17", mulai: "20:00", selesai: "23:00", hadir: [
      ["hendra", "20:00", "23:00", "Pimpin gladi bersih pengisi acara"],
      ["joko", "20:00", "23:00", "Sound check tiap band", S],
      ["arif", "20:00", "23:00", "Programming lighting per lagu", S],
      ["fitri", "20:00", "22:00", "Gladi alur registrasi dan tiket", S],
      ["hana", "20:00", "22:00", "Gladi alur tribun VIP", S],
    ] },
    { nama: "Hari H", tanggal: "2026-10-18", mulai: "12:00", selesai: "23:30", hadir: [
      ["hendra", "11:30", "23:30", "Koordinasi panggung dan keamanan", { catatan: "Koordinasi dengan keamanan sangat baik." }],
      ["eko", "12:00", "23:30", "Stage crew", S],
      ["fitri", "12:00", "22:00", "Registrasi penonton dan donasi", S],
      ["galih", "12:00", "23:30", "Stage crew dan ganti set band", S],
      ["hana", "12:00", "22:00", "Usher tribun VIP", S],
      ["ilham", "12:00", "23:30", "Jaga genset dan distribusi listrik", S],
      ["joko", "12:00", "23:30", "Operator FOH", S],
      ["arif", "12:00", "23:30", "Operator lighting", S],
      ["fajar", "12:00", "23:30", "Runner backstage", S],
    ] },
    { nama: "Loading out", tanggal: "2026-10-19", mulai: "00:00", selesai: "04:00", hadir: [
      ["hendra", "00:00", "04:00", "Cek kelengkapan alat sebelum dimuat"],
      ["eko", "00:00", "04:00", "Bongkar truss", S],
      ["galih", "00:00", "04:00", "Bongkar panggung", S],
      ["ilham", "00:00", "04:00", "Gulung kabel", { kurang: "2:00", catatan: "Tertidur di truk sekitar 2 jam, kabel digulung crew lain." }],
      ["joko", "00:00", "03:30", "Packing speaker", S],
      ["arif", "00:00", "04:00", "Packing lighting", S],
      ["fajar", "00:00", "04:00", "Muat barang ke truk", S],
    ] },
  ],
};

const E5: RencanaEvent = {
  nama: "Wisuda Periode Oktober, Dome Universitas Tribuana", klien: "Universitas Tribuana Malang", mulai: "2026-10-24", selesai: "2026-10-25",
  tugas: [["lestari", "kapten"], ["yoga", "crew"], ["dewi", "crew"], ["kevin", "crew"], ["lukman", "crew"], ["maya", "usher"]],
  sesi: [
    { nama: "Loading in", tanggal: "2026-10-24", mulai: "10:00", selesai: "17:00", hadir: [
      ["lestari", "10:00", "17:00", "Briefing dan bagi area kerja"],
      ["yoga", "10:00", "17:00", "Pasang panggung rektorat", S],
      ["dewi", "10:00", "17:00", "Tata kursi wisudawan", S],
      ["kevin", "10:00", "17:00", "Pasang kabel dan layar LED", S],
      ["lukman", "10:00", "17:00", "Pasang dekorasi bunga panggung", { kurang: "4:00", catatan: "Baru bekerja penuh sekitar pukul 13.00, dekorasi panggung terlambat siap." }],
    ] },
    { nama: "Gladi", tanggal: "2026-10-24", mulai: "18:00", selesai: "21:00", hadir: [
      ["lestari", "18:00", "21:00", "Gladi prosesi dengan panitia", { kurang: "2:00", catatan: "Gladi mundur sekitar satu jam karena briefing terlambat." }],
      ["yoga", "18:00", "21:00", "Stage crew gladi", S],
      ["dewi", "18:00", "20:30", "Gladi alur registrasi", S],
      ["maya", "18:00", "21:00", "Gladi alur wisudawan", S],
    ] },
    { nama: "Hari H", tanggal: "2026-10-25", mulai: "06:00", selesai: "14:00", hadir: [
      ["lestari", "05:45", "14:00", "Koordinasi prosesi wisuda"],
      ["yoga", "06:00", "14:00", "Stage crew", S],
      ["dewi", "06:00", "14:00", "Usher keluarga wisudawan", S],
      ["kevin", "06:30", "14:00", "Operator layar LED", { catatan: "Telat 30 menit." }],
      ["lukman", "06:00", "14:00", "Jaga dekorasi dan bunga", S],
      ["maya", "06:00", "13:00", "Registrasi wisudawan", S],
    ] },
    { nama: "Loading out", tanggal: "2026-10-25", mulai: "14:00", selesai: "18:00", hadir: [
      ["lestari", "14:00", "18:00", "Cek alat kembali lengkap"],
      ["yoga", "14:00", "18:00", "Bongkar panggung", S],
      ["kevin", "14:00", "18:00", "Bongkar LED", S],
      ["lukman", "14:00", "17:00", "Bongkar dekorasi", S],
    ] },
  ],
};

const E6: RencanaEvent = {
  nama: "Seminar Nasional Ekonomi Digital, Hotel Grand Ijen Malang", klien: "Ikatan Pengusaha Muda Malang", mulai: "2026-11-01", selesai: "2026-11-01",
  tugas: [["wahyu", "kapten"], ["bayu", "crew"], ["citra", "crew"], ["nanda", "crew"], ["joko", "teknisi"]],
  sesi: [
    { nama: "Loading in", tanggal: "2026-11-01", mulai: "05:00", selesai: "07:30", hadir: [
      ["wahyu", "04:45", "07:30", "Briefing dan cek ruang ballroom"],
      ["bayu", "05:00", "07:30", "Pasang backdrop dan podium", S],
      ["citra", "05:00", "07:30", "Tata meja registrasi", S],
      ["joko", "05:00", "07:30", "Pasang sound dan mic meja", S],
      ["nanda", "05:15", "07:30", "Pasang banner sponsor", S],
    ] },
    { nama: "Hari H", tanggal: "2026-11-01", mulai: "07:30", selesai: "15:30", hadir: [
      ["wahyu", "07:30", "15:30", "Koordinasi rundown dan pembicara", { catatan: "Seminar selesai tepat waktu." }],
      ["bayu", "07:30", "15:30", "Runner pembicara", S],
      ["citra", "07:30", "15:30", "Registrasi peserta", S],
      ["joko", "07:30", "15:30", "Operator sound", S],
      ["nanda", "08:15", "15:30", "Operator presentasi", { catatan: "Datang telat 45 menit, jamnya terpotong otomatis." }],
    ] },
    { nama: "Loading out", tanggal: "2026-11-01", mulai: "15:30", selesai: "18:00", hadir: [
      ["wahyu", "15:30", "18:00", "Cek alat kembali"],
      ["bayu", "15:30", "18:00", "Bongkar backdrop", S],
      ["joko", "15:30", "18:00", "Packing sound", S],
      ["nanda", "15:30", "17:30", "Lepas banner sponsor", S],
    ] },
  ],
};

const E7: RencanaEvent = {
  nama: "Festival Kuliner Kayutangan Heritage, Jalan Basuki Rahmat Malang", klien: "Komunitas Kayutangan Heritage", mulai: "2026-11-06", selesai: "2026-11-08",
  tugas: [["hendra", "kapten"], ["dani", "teknisi"], ["eko", "crew"], ["galih", "crew"], ["ilham", "crew"], ["rizky", "crew"], ["fitri", "usher"], ["maya", "usher"]],
  sesi: [
    { nama: "Loading in", tanggal: "2026-11-06", mulai: "15:00", selesai: "23:00", hadir: [
      ["hendra", "14:45", "23:00", "Atur posisi 40 booth tenant"],
      ["dani", "15:00", "23:00", "Pasang sound panggung utama", S],
      ["eko", "15:40", "23:00", "Rakit tenda booth", { catatan: "Telat 40 menit." }],
      ["galih", "15:00", "23:00", "Rakit panggung", S],
      ["ilham", "15:00", "23:00", "Tarik kabel listrik ke booth", S],
      ["rizky", "15:00", "23:00", "Pasang lampu hias sepanjang jalan", S],
    ] },
    { nama: "Hari H 1", tanggal: "2026-11-07", mulai: "09:00", selesai: "22:00", hadir: [
      ["hendra", "08:30", "22:00", "Koordinasi tenant dan pengisi acara"],
      ["dani", "09:00", "22:00", "Operator sound panggung", S],
      ["eko", "09:00", "22:00", "Jaga listrik booth", S],
      ["galih", "09:00", "22:00", "Stage crew", S],
      ["ilham", "09:00", "22:00", "Teknisi genset", S],
      ["rizky", "09:00", "22:00", "Stage manager panggung", S],
      ["fitri", "09:00", "21:00", "Info center dan registrasi tenant", S],
      ["maya", "09:00", "21:00", "Usher area VIP", S],
    ] },
    { nama: "Hari H 2", tanggal: "2026-11-08", mulai: "09:00", selesai: "21:00", hadir: [
      ["hendra", "08:45", "21:00", "Koordinasi tenant dan pengisi acara"],
      ["dani", "09:00", "21:00", "Operator sound panggung", S],
      ["eko", "09:00", "21:00", "Jaga listrik booth", S],
      ["galih", "09:00", "21:00", "Stage crew", S],
      ["ilham", "09:00", "21:00", "Teknisi genset", { kurang: "6:00", catatan: "Meninggalkan area genset sekitar 3 jam tanpa izin, genset sempat mati 10 menit." }],
      ["rizky", "09:00", "21:00", "Stage manager panggung", S],
      ["fitri", "09:00", "21:00", "Info center", S],
      ["maya", "10:00", "21:00", "Usher area VIP", { catatan: "Telat 1 jam, sudah izin ke kapten." }],
    ] },
    { nama: "Loading out", tanggal: "2026-11-08", mulai: "21:00", selesai: "23:59", hadir: [
      ["hendra", "21:00", "23:00", "Cek pengembalian alat", { kurang: "1:30", catatan: "Pulang sebelum truk terakhir berangkat, cek alat diserahkan ke Rizky." }],
      ["dani", "21:00", "23:59", "Packing sound", S],
      ["eko", "21:00", "23:59", "Bongkar tenda booth", S],
      ["galih", "21:00", "23:59", "Bongkar panggung", S],
      ["ilham", "21:00", "23:59", "Gulung kabel listrik", S],
      ["rizky", "21:00", "23:59", "Cek alat sampai truk terakhir", S],
    ] },
  ],
};

const E8: RencanaEvent = {
  nama: "Malang Auto Expo 2026, Atrium Dinoyo City Mall", klien: "PT Arjuna Motor Indonesia", mulai: "2026-11-12", selesai: "2026-11-13",
  tugas: [["rina", "kapten"], ["kevin", "crew"], ["lukman", "crew"], ["nanda", "crew"], ["hana", "usher"], ["joko", "teknisi"]],
  sesi: [
    { nama: "Loading in", tanggal: "2026-11-12", mulai: "18:00", selesai: "23:59", hadir: [
      ["rina", "18:00", "23:59", "Koordinasi dengan pengelola mall"],
      ["kevin", "18:00", "23:59", "Pasang layar LED", S],
      ["lukman", "18:00", "23:59", "Rakit booth pameran", S],
      ["nanda", "18:30", "23:59", "Pasang banner dan karpet", { catatan: "Telat 30 menit." }],
      ["joko", "18:00", "23:59", "Pasang sound system", S],
    ] },
    { nama: "Hari H", tanggal: "2026-11-13", mulai: "10:00", selesai: "21:00", hadir: [
      ["rina", "09:45", "21:00", "Koordinasi booth dan jadwal test drive"],
      ["kevin", "10:00", "21:00", "Operator LED", S],
      ["lukman", "10:00", "21:00", "Jaga booth pameran", S],
      ["nanda", "10:00", "21:00", "Bantu MC dan games pengunjung", S],
      ["hana", "10:00", "21:00", "Usher dan registrasi test drive", S],
      ["joko", "10:00", "21:00", "Operator sound", S],
    ] },
    { nama: "Loading out", tanggal: "2026-11-13", mulai: "21:00", selesai: "23:59", hadir: [
      ["rina", "21:00", "23:59", "Cek alat kembali"],
      ["kevin", "21:00", "23:59", "Bongkar LED", S],
      ["lukman", "21:00", "23:59", "Bongkar booth", { catatan: "Ikut sampai truk terakhir berangkat." }],
      ["joko", "21:00", "23:59", "Packing sound", S],
    ] },
  ],
};

const E9: RencanaEvent = {
  nama: "Resepsi Pernikahan Andini dan Reza, Gedung Graha Kencana", klien: "Keluarga Bapak Suryadi", mulai: "2026-11-15", selesai: "2026-11-15",
  tugas: [["lestari", "kapten"], ["bayu", "crew"], ["citra", "crew"], ["dani", "teknisi"], ["fitri", "usher"], ["galih", "crew"]],
  sesi: [
    { nama: "Loading in", tanggal: "2026-11-15", mulai: "05:00", selesai: "09:00", hadir: [
      ["lestari", "04:45", "09:00", "Briefing dan cek denah gedung"],
      ["bayu", "05:00", "09:00", "Pasang dekorasi pelaminan", S],
      ["citra", "05:00", "09:00", "Tata meja prasmanan", S],
      ["dani", "05:00", "09:00", "Pasang sound akustik", S],
      ["galih", "05:30", "09:00", "Rakit panggung musik", { catatan: "Telat 30 menit." }],
    ] },
    { nama: "Hari H", tanggal: "2026-11-15", mulai: "09:00", selesai: "15:00", hadir: [
      ["lestari", "09:00", "15:00", "Koordinasi acara dengan keluarga"],
      ["bayu", "09:00", "15:00", "Runner keluarga pengantin", S],
      ["citra", "09:00", "15:00", "Jaga meja prasmanan", S],
      ["dani", "09:00", "15:00", "Operator sound", S],
      ["fitri", "09:00", "14:00", "Registrasi buku tamu dan angpau", S],
      ["galih", "09:00", "15:00", "Stage crew band", S],
    ] },
    { nama: "Loading out", tanggal: "2026-11-15", mulai: "15:00", selesai: "18:00", hadir: [
      ["lestari", "15:00", "18:00", "Cek alat kembali"],
      ["bayu", "15:00", "18:00", "Bongkar dekorasi"],
      ["dani", "15:00", "18:00", "Packing sound"],
      ["galih", "15:00", "17:30", "Bongkar panggung"],
    ] },
  ],
};

const E10: RencanaEvent = {
  nama: "Turnamen E-Sport Pelajar Jawa Timur, Malang Creative Center", klien: "Asosiasi E-Sport Malang Raya", mulai: "2026-11-18", selesai: "2026-11-19",
  tugas: [["wahyu", "kapten"], ["eko", "crew"], ["ilham", "crew"], ["kevin", "crew"], ["hana", "usher"], ["joko", "teknisi"], ["nanda", "crew"]],
  sesi: [
    { nama: "Loading in", tanggal: "2026-11-18", mulai: "13:00", selesai: "22:00", hadir: [
      ["wahyu", "13:00", "22:00", "Briefing dan atur layout arena"],
      ["eko", "13:00", "22:00", "Pasang meja dan kursi pemain"],
      ["ilham", "13:00", "22:00", "Tarik kabel jaringan dan listrik"],
      ["kevin", "13:00", "22:00", "Pasang layar LED utama"],
      ["joko", "13:00", "22:00", "Pasang sound dan intercom caster"],
      ["nanda", "13:00", "22:00", "Pasang branding sponsor"],
    ] },
    { nama: "Hari H", tanggal: "2026-11-19", mulai: "08:00", selesai: "20:00", hadir: [
      ["wahyu", "07:30", "20:00", "Koordinasi jadwal pertandingan"],
      ["eko", "08:00", "20:00", "Stage crew arena"],
      ["ilham", "08:00", "20:00", "Jaga jaringan dan listrik"],
      ["kevin", "08:20", "20:00", "Operator layar LED"],
      ["hana", "08:00", "20:00", "Registrasi tim peserta"],
      ["joko", "08:00", "20:00", "Operator sound caster"],
      ["nanda", "08:00", "18:00", "Bantu panitia lomba"],
    ] },
  ],
};

const E11: RencanaEvent = {
  nama: "Gathering Akhir Tahun PT Mitra Logistik Nusantara, Pantai Balekambang", klien: "PT Mitra Logistik Nusantara", mulai: "2026-12-04", selesai: "2026-12-06",
  tugas: [["rina", "kapten"], ["bayu", "crew"], ["citra", "crew"], ["galih", "crew"], ["lukman", "crew"], ["maya", "usher"]],
  sesi: [
    { nama: "Meeting", tanggal: "2026-12-04", mulai: "19:00", selesai: "21:00", hadir: [] },
    { nama: "Loading in", tanggal: "2026-12-05", mulai: "13:00", selesai: "20:00", hadir: [] },
    { nama: "Hari H", tanggal: "2026-12-06", mulai: "07:00", selesai: "16:00", hadir: [] },
    { nama: "Loading out", tanggal: "2026-12-06", mulai: "16:00", selesai: "20:00", hadir: [] },
  ],
};

const E12: RencanaEvent = {
  nama: "Malam Pergantian Tahun 2027, Alun-alun Kota Batu", klien: "Panitia Malam Tahun Baru Kota Batu", mulai: "2026-12-30", selesai: "2026-12-31",
  tugas: [["hendra", "kapten"], ["bima", "kapten"], ["dani", "teknisi"], ["eko", "crew"], ["fitri", "usher"], ["ilham", "crew"], ["joko", "teknisi"], ["kevin", "crew"], ["nanda", "crew"], ["fajar", "crew"]],
  sesi: [
    { nama: "Loading in", tanggal: "2026-12-30", mulai: "08:00", selesai: "18:00", hadir: [] },
    { nama: "Gladi", tanggal: "2026-12-30", mulai: "19:00", selesai: "23:00", hadir: [] },
    { nama: "Hari H", tanggal: "2026-12-31", mulai: "15:00", selesai: "23:59", hadir: [] },
  ],
};

// ====================================================================== Konteks

type Konteks = {
  hrd: number;
  owner: number;
  /** kunci orang -> kode karyawan */
  orang: Record<string, string>;
  /** kunci jabatan event -> kode jabatan */
  jabatan: Record<string, string>;
  /** kode karyawan kapten -> id pengguna kapten */
  akunKapten: Record<string, number>;
  jurnalBaru: string[];
};

type EventDibuat = {
  kode: string;
  rencana: RencanaEvent;
  sesiId: number[];
  /** `${indeks sesi}|${kunci orang}` -> id kehadiran */
  hadir: Map<string, number>;
  kapten: string[];
};

const kunciHadir = (i: number, orang: string) => `${i}|${orang}`;

// ====================================================================== Langkah (meniru server action)

/** simpanPresensi (baris baru). */
async function tambahPresensi(tx: Tx, k: Konteks, input: { karyawanKode: string; tanggal: string; absensi: JenisAbsensi; jamMasuk?: string; jamKeluar?: string }) {
  const d = validasi(skemaPresensi, input);
  const hadir = d.absensi === "HADIR";
  const karyawan = await tx.karyawan.findUnique({
    where: { kode: d.karyawanKode },
    select: { aktif: true, jenis: true, settingGaji: { select: { aktif: true, jabatan: { select: { jadwalKerja: { select: { kode: true, jamMasuk: true } } } } } } },
  });
  if (!karyawan || !karyawan.aktif || karyawan.jenis !== "INHOUSE") throw new GalatAksi(`${d.karyawanKode} bukan karyawan inhouse aktif.`);
  const jadwal = karyawan.settingGaji?.aktif ? karyawan.settingGaji.jabatan.jadwalKerja : null;
  if (!jadwal) throw new GalatAksi(`${d.karyawanKode} belum punya setting gaji atau jadwal kerja.`);
  const slip = await tx.slipGaji.findUnique({ where: { periodeId_karyawanKode: { periodeId: d.tanggal.slice(0, 7), karyawanKode: d.karyawanKode } }, select: { status: true } });
  if (slip && slip.status !== "DRAFT") throw new GalatAksi(`Presensi ${d.karyawanKode} ${d.tanggal} terkunci.`);
  const bentrok = await tx.presensi.findUnique({ where: { karyawanKode_tanggal: { karyawanKode: d.karyawanKode, tanggal: keDate(d.tanggal) } }, select: { id: true } });
  if (bentrok) throw new GalatAksi(`Presensi ${d.karyawanKode} ${d.tanggal} sudah ada.`);
  const baru = await tx.presensi.create({
    data: {
      karyawanKode: d.karyawanKode, tanggal: keDate(d.tanggal), jadwalKode: jadwal.kode, absensi: d.absensi,
      jamMasuk: hadir ? d.jamMasuk : null, jamKeluar: hadir ? d.jamKeluar : null,
      terlambat: hitungTerlambat(d.absensi, hadir ? d.jamMasuk : null, jadwal.jamMasuk), dibuatOlehId: k.hrd,
    },
    select: { id: true },
  });
  await catatLog(tx, k.hrd, "presensi.buat", "presensi", String(baru.id), `${d.karyawanKode} ${d.tanggal}`);
}

/** Presensi satu bulan penuh: hari kerja Senin sampai Jumat, ditambah Sabtu awal bulan bila kurang dari hari kerja jadwal. */
async function presensiSebulan(tx: Tx, k: Konteks, karyawanKode: string, profil: Profil) {
  const s = await tx.settingGaji.findUnique({ where: { karyawanKode }, select: { jabatan: { select: { jadwalKerja: true } } } });
  const jadwal = s?.jabatan.jadwalKerja;
  if (!jadwal) throw new GalatAksi(`${karyawanKode} belum punya jadwal kerja.`);
  const akhir = Number(hariTerakhir(PERIODE_GAJI).slice(8));
  const semua = Array.from({ length: akhir }, (_, i) => `${PERIODE_GAJI}-${String(i + 1).padStart(2, "0")}`);
  const hariKe = (t: string) => new Date(`${t}T00:00:00Z`).getUTCDay();
  const kerja = semua.filter((t) => hariKe(t) >= 1 && hariKe(t) <= 5);
  for (const sabtu of semua.filter((t) => hariKe(t) === 6)) if (kerja.length < jadwal.hariKerja) kerja.push(sabtu);
  kerja.sort();

  const r = acak(`${karyawanKode}-${PERIODE_GAJI}`);
  const urutAcak = kocok(kerja, r);
  const absen = new Map<string, JenisAbsensi>();
  for (const [jenis, n] of [["CUTI", profil.cuti], ["SAKIT", profil.sakit], ["IZIN", profil.izin], ["ALPA", profil.alpa]] as const) {
    for (let i = 0; i < (n ?? 0); i++) absen.set(urutAcak[absen.size], jenis);
  }
  const hadirSaja = kerja.filter((t) => !absen.has(t));
  const telat = new Set(kocok(hadirSaja, r).slice(0, profil.telat ?? 0));
  const masukJadwal = keMenit(jadwal.jamMasuk);
  const keluarJadwal = keMenit(jadwal.jamKeluar);
  for (const tanggal of kerja) {
    const jenis = absen.get(tanggal);
    if (jenis) {
      await tambahPresensi(tx, k, { karyawanKode, tanggal, absensi: jenis });
      continue;
    }
    const masuk = telat.has(tanggal) ? masukJadwal + 5 + Math.floor(r() * 46) : masukJadwal - Math.floor(r() * 16);
    const keluar = keluarJadwal + Math.floor(r() * 41);
    await tambahPresensi(tx, k, { karyawanKode, tanggal, absensi: "HADIR", jamMasuk: jam(masuk), jamKeluar: jam(keluar) });
  }
}

/** simpanEvent (baru), simpanPenugasan, simpanSesi, simpanKehadiran (baru). */
async function buatEvent(tx: Tx, k: Konteks, r: RencanaEvent): Promise<EventDibuat> {
  const d = validasi(skemaEvent, { nama: r.nama, klien: r.klien, tanggalMulai: r.mulai, tanggalSelesai: r.selesai });
  const kode = await nomorDokumen(tx, AWALAN.EVENT, d.tanggalMulai);
  await tx.event.create({
    data: { kode, nama: d.nama, klien: d.klien, tanggalMulai: keDate(d.tanggalMulai), tanggalSelesai: keDate(d.tanggalSelesai), dibuatOlehId: k.hrd, dibuatPada: waktu(`${tambahHariTeks(r.mulai, -7)} 10:00`) },
  });
  await catatLog(tx, k.hrd, "event.buat", "event", kode, d.nama);

  const kapten: string[] = [];
  for (const [orang, jab] of r.tugas) {
    const karyawanKode = k.orang[orang];
    const jabatanKode = k.jabatan[jab];
    const karyawan = await tx.karyawan.findUnique({ where: { kode: karyawanKode }, select: { aktif: true, jenis: true } });
    const jabatan = await tx.jabatan.findUnique({ where: { kode: jabatanKode }, select: { aktif: true, kelompok: true, peranEvent: true } });
    if (!karyawan || karyawan.jenis !== "EVENT" || !karyawan.aktif) throw new GalatAksi(`${orang} bukan karyawan event aktif.`);
    if (!jabatan || jabatan.kelompok !== "EVENT" || !jabatan.peranEvent || !jabatan.aktif) throw new GalatAksi(`Jabatan ${jab} bukan jabatan event aktif.`);
    const p = await tx.penugasanEvent.create({ data: { eventKode: kode, karyawanKode, jabatanKode } });
    await catatLog(tx, k.hrd, "penugasan-event.buat", "penugasan_event", String(p.id), `${kode} ${karyawanKode} ${jabatanKode}`);
    if (jabatan.peranEvent === "KAPTEN") kapten.push(orang);
  }

  const sesiId: number[] = [];
  const hadir = new Map<string, number>();
  for (const [i, s] of r.sesi.entries()) {
    const ds = validasi(skemaSesi, { eventKode: kode, nama: s.nama, tanggal: s.tanggal, jamMulai: s.mulai, jamSelesai: s.selesai });
    if (ds.tanggal < d.tanggalMulai || ds.tanggal > d.tanggalSelesai) throw new GalatAksi(`Sesi ${s.nama} di luar tanggal event ${kode}.`);
    const sesi = await tx.sesiEvent.create({ data: { eventKode: kode, nama: ds.nama, tanggal: keDate(ds.tanggal), jamMulai: ds.jamMulai, jamSelesai: ds.jamSelesai } });
    await catatLog(tx, k.hrd, "sesi-event.buat", "sesi_event", String(sesi.id), `${kode} ${ds.nama}`);
    sesiId.push(sesi.id);
    for (const [orang, masuk, pulang, progres] of s.hadir) {
      const dk = validasi(skemaKehadiran, { sesiId: sesi.id, karyawanKode: k.orang[orang], jamMasuk: masuk, jamPulang: pulang, catatanProgres: progres });
      if (!r.tugas.some(([o]) => o === orang)) throw new GalatAksi(`${orang} belum ditugaskan di ${kode}.`);
      const baris = await tx.kehadiranEvent.create({
        data: { sesiId: dk.sesiId, karyawanKode: dk.karyawanKode, jamMasuk: dk.jamMasuk, jamPulang: dk.jamPulang, catatanProgres: dk.catatanProgres, dibuatOlehId: k.hrd, dibuatPada: waktu(`${s.tanggal} 23:30`) },
      });
      await catatLog(tx, k.hrd, "kehadiran-event.buat", "kehadiran_event", String(baris.id), `${kode} ${ds.nama} ${dk.karyawanKode}`);
      hadir.set(kunciHadir(i, orang), baris.id);
    }
  }
  return { kode, rencana: r, sesiId, hadir, kapten };
}

function tambahHariTeks(tanggal: string, n: number) {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** nilaiKehadiran: penilai KAPTEN (crew di event miliknya) atau OWNER (kehadiran kapten). */
async function nilaiSatu(tx: Tx, penilai: { id: number; peran: "KAPTEN" | "OWNER" }, id: number, n: Nilai, pada: Date) {
  const d = validasi(skemaPenilaian, { id, penilaian: n.kurang ? "KURANG" : "SESUAI", jamDiakui: n.kurang ?? "", catatan: n.catatan ?? "" });
  const kh = await tx.kehadiranEvent.findUnique({ where: { id: d.id }, include: { sesi: true } });
  if (!kh) throw new GalatAksi("Kehadiran tidak ditemukan.");
  const e = await kunciEvent(tx, kh.sesi.eventKode);
  const tugas = await tx.penugasanEvent.findUnique({
    where: { eventKode_karyawanKode: { eventKode: kh.sesi.eventKode, karyawanKode: kh.karyawanKode } },
    select: { jabatan: { select: { peranEvent: true } } },
  });
  const peranTarget = tugas?.jabatan.peranEvent ?? null;
  if (penilai.peran === "KAPTEN") {
    const saya = await pastikanKaptenEvent(tx, penilai.id, kh.sesi.eventKode);
    if (kh.karyawanKode === saya || peranTarget !== "CREW") throw new GalatAksi("Kapten hanya menilai crew di event miliknya.");
    if (e.status !== "PENILAIAN") throw new GalatAksi(`Penilaian ${kh.sesi.eventKode} terkunci.`);
  } else {
    if (peranTarget !== "KAPTEN") throw new GalatAksi("Owner hanya menilai kehadiran kapten.");
    if (e.status === "SELESAI") throw new GalatAksi(`Fee ${kh.sesi.eventKode} sudah dibayar.`);
  }
  const batas = menitTercatat(kh.sesi, kh);
  let menitDiakui: number | null = null;
  if (d.penilaian === "KURANG") {
    menitDiakui = durasiKeMenit(d.jamDiakui);
    if (menitDiakui === null || menitDiakui > batas) throw new GalatAksi(`Jam diakui ${d.jamDiakui} melebihi ${batas} menit tercatat (kehadiran ${id}).`);
  }
  await tx.kehadiranEvent.update({ where: { id: kh.id }, data: { penilaian: d.penilaian, menitDiakui, catatanNilai: d.catatan || null, dinilaiOlehId: penilai.id, dinilaiPada: pada } });
  await catatLog(tx, penilai.id, "kehadiran-event.nilai", "kehadiran_event", String(kh.id), `${kh.sesi.eventKode} ${kh.sesi.nama} ${kh.karyawanKode}: ${d.penilaian}${menitDiakui !== null ? ` ${menitDiakui} menit` : ""}`);
}

/** Kapten event menilai crew. sesi = indeks sesi yang dinilai (bawaan semua); ganti = penilaian lain dari rencana. */
async function nilaiCrew(tx: Tx, k: Konteks, ev: EventDibuat, pada: string, opsi: { sesi?: number[]; orang?: string[]; ganti?: Record<string, Nilai> } = {}) {
  const penilai = k.akunKapten[k.orang[ev.kapten[0]]];
  for (const [i, s] of ev.rencana.sesi.entries()) {
    if (opsi.sesi && !opsi.sesi.includes(i)) continue;
    for (const [orang, , , , nilai] of s.hadir) {
      if (ev.kapten.includes(orang) || (opsi.orang && !opsi.orang.includes(orang))) continue;
      const n = opsi.ganti?.[kunciHadir(i, orang)] ?? nilai;
      if (!n) continue;
      await nilaiSatu(tx, { id: penilai, peran: "KAPTEN" }, ev.hadir.get(kunciHadir(i, orang))!, n, waktu(pada));
    }
  }
}

/** Owner menilai kehadiran kapten yang punya penilaian di rencana. */
async function nilaiKapten(tx: Tx, k: Konteks, ev: EventDibuat, pada: string) {
  for (const [i, s] of ev.rencana.sesi.entries()) {
    for (const [orang, , , , nilai] of s.hadir) {
      if (!ev.kapten.includes(orang) || !nilai) continue;
      await nilaiSatu(tx, { id: k.owner, peran: "OWNER" }, ev.hadir.get(kunciHadir(i, orang))!, nilai, waktu(pada));
    }
  }
}

/** kirimLaporan oleh kapten pertama event. */
async function kirimLaporan(tx: Tx, k: Konteks, ev: EventDibuat, catatanKapten: string, pada: string): Promise<string> {
  const { eventKode, catatan } = validasi(skemaKirimLaporan, { eventKode: ev.kode, catatan: catatanKapten });
  const penggunaId = k.akunKapten[k.orang[ev.kapten[0]]];
  await pastikanKaptenEvent(tx, penggunaId, eventKode);
  const e = await kunciEvent(tx, eventKode);
  if (e.status !== "PENILAIAN") throw new GalatAksi(`Laporan ${eventKode} sudah dikirim.`);
  const b = await muatBahanEvent(tx, eventKode);
  if (!b || !b.orang.some((o) => o.peranEvent === "KAPTEN") || !b.orang.some((o) => o.kehadiran.length)) throw new GalatAksi(`${eventKode} belum siap dilaporkan.`);
  if (b.crewBelumDinilai) throw new GalatAksi(`${eventKode}: masih ada ${b.crewBelumDinilai} kehadiran crew yang belum dinilai.`);
  const no = await nomorDokumen(tx, AWALAN.LAPORAN_FEE, e.tanggalSelesai);
  const klaim = await tx.event.updateMany({ where: { kode: eventKode, status: "PENILAIAN" }, data: { status: "DIAJUKAN", alasanTolak: null } });
  if (klaim.count !== 1) throw new GalatAksi(`Status ${eventKode} berubah.`);
  await tx.laporanFee.create({ data: { no, eventKode, status: "DIAJUKAN", catatanKapten: catatan, totalUsulan: b.totalUsulan, diajukanOlehId: penggunaId, diajukanPada: waktu(pada) } });
  const kurang = b.orang.reduce((s, o) => s + o.usulan.jumlahKurang, 0);
  await catatLog(tx, penggunaId, "laporan-fee.ajukan", "laporan_fee", no, `${eventKode}, ${kurang} penilaian kurang`);
  return no;
}

/** tolakFee oleh Owner. */
async function tolakLaporan(tx: Tx, k: Konteks, noLaporan: string, alasanTolak: string, pada: string) {
  const { no, alasan } = validasi(skemaTolakFee, { no: noLaporan, alasan: alasanTolak });
  const lap = await tx.laporanFee.findUnique({ where: { no }, select: { eventKode: true } });
  if (!lap) throw new GalatAksi(`Laporan ${no} tidak ditemukan.`);
  await kunciEvent(tx, lap.eventKode);
  const klaim = await tx.laporanFee.updateMany({ where: { no, status: "DIAJUKAN" }, data: { status: "DITOLAK", alasanTolak: alasan, diputuskanOlehId: k.owner, diputuskanPada: waktu(pada) } });
  if (klaim.count !== 1) throw new GalatAksi(`Laporan ${no} sudah diputuskan.`);
  const balik = await tx.event.updateMany({ where: { kode: lap.eventKode, status: "DIAJUKAN" }, data: { status: "PENILAIAN", alasanTolak: alasan } });
  if (balik.count !== 1) throw new GalatAksi(`Status ${lap.eventKode} berubah.`);
  await catatLog(tx, k.owner, "laporan-fee.tolak", "laporan_fee", no, alasan);
}

/** setujuiFee oleh Owner. ubah = selisih fee akhir dari usulan per kunci orang beserta alasannya. */
async function setujuiLaporan(tx: Tx, k: Konteks, noLaporan: string, pada: string, ubah: Record<string, { selisih: number; alasan: string }> = {}) {
  const lap = await tx.laporanFee.findUnique({ where: { no: noLaporan }, select: { eventKode: true, status: true } });
  if (!lap) throw new GalatAksi(`Laporan ${noLaporan} tidak ditemukan.`);
  const awal = await muatBahanEvent(tx, lap.eventKode);
  if (!awal) throw new GalatAksi(`Event ${lap.eventKode} tidak ditemukan.`);
  // Isian form Owner: fee usulan, kecuali yang diubah (alasan wajib).
  const kodeKeKunci = new Map(Object.entries(k.orang).map(([kunci, kode]) => [kode, kunci]));
  const d = validasi(skemaSetujuiFee, {
    no: noLaporan,
    fee: awal.orang.map((o) => {
      const u = ubah[kodeKeKunci.get(o.karyawanKode) ?? ""];
      return { karyawanKode: o.karyawanKode, feeAkhir: o.usulan.fee + (u?.selisih ?? 0), alasan: u?.alasan ?? "" };
    }),
  });

  const e = await kunciEvent(tx, lap.eventKode);
  if (lap.status !== "DIAJUKAN" || e.status !== "DIAJUKAN") throw new GalatAksi(`Laporan ${noLaporan} sudah diputuskan.`);
  const klaim = await tx.laporanFee.updateMany({ where: { no: d.no, status: "DIAJUKAN" }, data: { status: "DISETUJUI", diputuskanOlehId: k.owner, diputuskanPada: waktu(pada) } });
  if (klaim.count !== 1) throw new GalatAksi(`Laporan ${noLaporan} baru saja diputuskan.`);

  const b = await muatBahanEvent(tx, lap.eventKode);
  if (!b || !b.orang.length) throw new GalatAksi("Event ini tidak punya penugasan.");
  const kiriman = new Map(d.fee.map((f) => [f.karyawanKode, f]));
  if (kiriman.size !== d.fee.length || kiriman.size !== b.orang.length || b.orang.some((o) => !kiriman.has(o.karyawanKode))) throw new GalatAksi("Daftar orang tidak sama dengan data event.");
  const slip = b.orang.map((o) => {
    const f = kiriman.get(o.karyawanKode)!;
    const berubah = f.feeAkhir !== o.usulan.fee;
    if (berubah && !f.alasan) throw new GalatAksi("Fee yang diubah dari usulan wajib diberi alasan.");
    return { o, alasan: berubah ? f.alasan : null, pajak: pph21BukanPegawai(f.feeAkhir) };
  });
  const totalFee = slip.reduce((s, x) => s + x.pajak.bruto, 0);
  const totalPph = slip.reduce((s, x) => s + x.pajak.pph21, 0);
  const totalDibayar = slip.reduce((s, x) => s + x.pajak.dibayar, 0);
  if (totalFee <= 0) throw new GalatAksi("Total fee akhir Rp0.");
  const kas = await saldoAkun(tx, AKUN.KAS);
  if (kas < totalDibayar) throw new GalatAksi(`Saldo kas ${kas} tidak cukup untuk membayar fee ${totalDibayar} (${noLaporan}).`);

  const jurnalNo = await buatJurnal(tx, {
    tanggal: e.tanggalSelesai,
    jenis: "UMUM",
    status: "DISETUJUI",
    keterangan: `Fee event ${b.nama} (${slip.length} orang), ${d.no}`,
    baris: barisFeeEvent(slip.map((x) => ({ akunBeban: x.o.akunBebanKode, bruto: x.pajak.bruto, pph21: x.pajak.pph21, dibayar: x.pajak.dibayar }))),
    sumberTipe: "FEE_EVENT",
    sumberId: d.no,
    dibuatOlehId: k.owner,
    disetujuiOlehId: k.owner,
  });
  k.jurnalBaru.push(jurnalNo);
  await tx.slipFee.createMany({
    data: slip.map((x) => ({
      no: nomorSlipFee(b.kode, x.o.karyawanKode),
      laporanNo: d.no,
      eventKode: b.kode,
      karyawanKode: x.o.karyawanKode,
      jabatanKode: x.o.jabatanKode,
      akunBebanKode: x.o.akunBebanKode,
      peranEvent: x.o.peranEvent,
      satuanTarif: x.o.satuanTarif,
      tarif: x.o.usulan.tarif,
      jumlahSesi: x.o.usulan.jumlahSesi,
      menitTercatat: x.o.usulan.menitTercatat,
      menitDiakui: x.o.usulan.menitDiakui,
      jumlahHari: x.o.usulan.jumlahHari,
      feeUsulan: x.o.usulan.fee,
      feeAkhir: x.pajak.bruto,
      alasanUbah: x.alasan,
      dpp: x.pajak.dpp,
      pph21: x.pajak.pph21,
      dibayar: x.pajak.dibayar,
    })),
  });
  await tx.laporanFee.update({ where: { no: d.no }, data: { totalFee, totalPph, totalDibayar, jurnalNo } });
  const selesai = await tx.event.updateMany({ where: { kode: b.kode, status: "DIAJUKAN" }, data: { status: "SELESAI", alasanTolak: null } });
  if (selesai.count !== 1) throw new GalatAksi(`Status ${b.kode} berubah.`);
  const diubah = slip.filter((x) => x.alasan).length;
  await catatLog(tx, k.owner, "laporan-fee.setujui", "laporan_fee", d.no, `Jurnal ${jurnalNo}, fee ${totalFee}, dibayar ${totalDibayar}${diubah ? `, ${diubah} fee diubah` : ""}`);
}

/** simpanKehadiran (ubah oleh HRD): jam berubah, penilaian yang sudah ada dihapus supaya kapten menilai ulang. */
async function ubahJamPulang(tx: Tx, k: Konteks, ev: EventDibuat, i: number, orang: string, jamPulang: string) {
  const id = ev.hadir.get(kunciHadir(i, orang))!;
  const lama = await tx.kehadiranEvent.findUniqueOrThrow({ where: { id }, include: { sesi: { select: { eventKode: true, nama: true } } } });
  const e = await kunciEvent(tx, lama.sesi.eventKode);
  if (e.status !== "PENILAIAN") throw new GalatAksi(`${lama.sesi.eventKode} terkunci.`);
  const d = validasi(skemaKehadiran, { id, sesiId: lama.sesiId, karyawanKode: lama.karyawanKode, jamMasuk: lama.jamMasuk, jamPulang, catatanProgres: lama.catatanProgres });
  await tx.kehadiranEvent.update({ where: { id }, data: { jamPulang: d.jamPulang, penilaian: null, menitDiakui: null, catatanNilai: null, dinilaiOlehId: null, dinilaiPada: null } });
  await catatLog(tx, k.hrd, "kehadiran-event.ubah", "kehadiran_event", String(id), `${lama.sesi.eventKode} ${lama.sesi.nama} ${lama.karyawanKode}${lama.penilaian ? " (penilaian dihapus)" : ""}`);
}

/** Setoran modal pemilik (pola jurnal saldo awal di data contoh): Dr Kas, Kr Modal. */
async function setoranModal(tx: Tx, k: Konteks, tanggal: string, nilai: number) {
  const no = await buatJurnal(tx, {
    tanggal,
    jenis: "UMUM",
    status: "DISETUJUI",
    keterangan: `Setoran modal pemilik untuk kas operasional, gaji, dan fee event ${labelPeriode(tanggal.slice(0, 7))} (data dummy)`,
    baris: [{ akun: AKUN.KAS, debit: nilai, kredit: 0 }, { akun: AKUN.MODAL, debit: 0, kredit: nilai }],
    sumberTipe: "SALDO_AWAL",
    dibuatOlehId: k.owner,
    disetujuiOlehId: k.owner,
  });
  k.jurnalBaru.push(no);
}

/** hitungSlipSemua (simpanSlip untuk slip baru), ajukanPenggajian, setujuiPenggajian. */
async function gajiSebulan(tx: Tx, k: Konteks, periode: string) {
  await pastikanTerbuka(tx, periode);
  const bahan: BahanGaji[] = await muatBahanGaji(tx, periode);
  for (const b of bahan) {
    if (!b.jumlahPresensi) continue;
    const h = hitungGaji(b.input);
    const no = nomorSlip(periode, b.karyawanKode);
    if (await tx.slipGaji.findUnique({ where: { no }, select: { no: true } })) throw new GalatAksi(`Slip ${no} sudah ada.`);
    await tx.slipGaji.create({
      data: {
        no, periodeId: periode, karyawanKode: b.karyawanKode, status: "DRAFT",
        jabatanKode: h.jabatanKode, golonganKode: h.golonganKode, jadwalKode: h.jadwalKode, akunBebanKode: h.akunBebanKode, statusPtkp: h.statusPtkp,
        hariKerja: h.hariKerja, jumlahPresensi: h.rekap.jumlah, hadir: h.rekap.hadir, izin: h.rekap.izin, sakit: h.rekap.sakit, cuti: h.rekap.cuti, alpa: h.rekap.alpa,
        jamKerja: h.rekap.jamKerja, terlambatMenit: h.rekap.terlambatMenit, gajiPokok: h.gajiPokok, tunjJabatan: h.tunjJabatan, tunjKeluarga: h.tunjKeluarga,
        tunjLain: h.totalTunjLain, potonganAbsen: h.potonganAbsen, bruto: h.bruto, brutoSetahun: h.brutoSetahun, biayaJabatan: h.biayaJabatan, netoSetahun: h.netoSetahun,
        ptkp: h.ptkp, pkp: h.pkp, pphSetahun: h.pphSetahun, pph21: h.pph21, thp: h.thp, alasanTolak: null, dibuatOlehId: k.hrd, dihitungPada: new Date(),
      },
    });
    if (h.tunjLain.length) await tx.slipTunjangan.createMany({ data: h.tunjLain.map((t) => ({ slipNo: no, tunjanganKode: t.kode, nama: t.nama, nominal: t.nominal })) });
    await catatLog(tx, k.hrd, "slip.hitung", "slip", no, `bruto ${h.bruto}, PPh 21 ${h.pph21}, THP ${h.thp}`);
  }

  // Ajukan (HRD).
  const draf = await tx.slipGaji.findMany({ where: { periodeId: periode, status: "DRAFT" }, select: { no: true, bruto: true, pph21: true, thp: true } });
  if (!draf.length) throw new GalatAksi(`Tidak ada slip draf di ${labelPeriode(periode)}.`);
  const no = await nomorDokumen(tx, AWALAN.PENGGAJIAN, hariTerakhir(periode));
  const klaimSlip = await tx.slipGaji.updateMany({ where: { no: { in: draf.map((s) => s.no) }, status: "DRAFT" }, data: { status: "DIAJUKAN", penggajianNo: null, alasanTolak: null } });
  if (klaimSlip.count !== draf.length) throw new GalatAksi("Slip draf berubah.");
  await tx.penggajian.create({
    data: {
      no, periodeId: periode, jumlahSlip: draf.length, status: "DIAJUKAN", dibuatOlehId: k.hrd,
      totalBruto: draf.reduce((s, x) => s + x.bruto, 0), totalPph: draf.reduce((s, x) => s + x.pph21, 0), totalThp: draf.reduce((s, x) => s + x.thp, 0),
    },
  });
  await tx.slipGaji.updateMany({ where: { no: { in: draf.map((s) => s.no) } }, data: { penggajianNo: no } });
  await catatLog(tx, k.hrd, "penggajian.ajukan", "penggajian", no, `${draf.length} slip ${periode}`);

  // Setujui (Owner).
  const g = await tx.penggajian.findUniqueOrThrow({ where: { no }, select: { periodeId: true, dibuatOlehId: true } });
  const klaim = await tx.penggajian.updateMany({ where: { no, status: "DIAJUKAN" }, data: { status: "DISETUJUI", disetujuiOlehId: k.owner, disetujuiPada: new Date() } });
  if (klaim.count !== 1) throw new GalatAksi(`${no} sudah diputuskan.`);
  const slip = await tx.slipGaji.findMany({ where: { penggajianNo: no, status: "DIAJUKAN" }, orderBy: { karyawanKode: "asc" } });
  const thp = slip.reduce((s, x) => s + x.thp, 0);
  const kas = await saldoAkun(tx, AKUN.KAS);
  if (kas < thp) throw new GalatAksi(`Saldo kas ${kas} tidak cukup untuk membayar gaji ${thp}.`);
  const jurnal = await buatJurnal(tx, {
    tanggal: hariTerakhir(g.periodeId),
    jenis: "UMUM",
    status: "DISETUJUI",
    keterangan: `Penggajian ${labelPeriode(g.periodeId)} (${slip.length} karyawan), ${no}`,
    baris: barisGaji(slip.map((s) => ({ akunBeban: s.akunBebanKode, bruto: s.bruto, pph21: s.pph21, thp: s.thp }))),
    sumberTipe: "PENGGAJIAN",
    sumberId: no,
    dibuatOlehId: g.dibuatOlehId,
    disetujuiOlehId: k.owner,
  });
  k.jurnalBaru.push(jurnal);
  await tx.slipGaji.updateMany({ where: { no: { in: slip.map((s) => s.no) }, status: "DIAJUKAN" }, data: { status: "DISETUJUI", disetujuiOlehId: k.owner, disetujuiPada: new Date() } });
  await tx.penggajian.update({ where: { no }, data: { jurnalNo: jurnal } });
  await catatLog(tx, k.owner, "penggajian.setujui", "penggajian", no, `Jurnal ${jurnal}, THP ${thp}`);
  return { no, jumlah: slip.length, thp };
}

// ====================================================================== Master

async function tambahMaster(tx: Tx, k: Konteks, hashKapten: Record<string, string>) {
  const log = (jenis: string, kode: string, aktor = k.owner) => catatLog(tx, aktor, "master.tambah", jenis, kode);

  const jabatanBaru: Record<string, string> = {};
  for (const j of JABATAN_INHOUSE) {
    const kode = await kodeBerikutnya(tx, AWALAN.JABATAN);
    await tx.jabatan.create({ data: { kode, nama: j.nama, tunjJabatan: j.tunjJabatan, tunjKeluarga: j.tunjKeluarga, akunBebanKode: j.akunBebanKode, kelompok: "INHOUSE" } });
    await log("jabatan", kode);
    const tm = await kodeBerikutnya(tx, AWALAN.JADWAL_KERJA);
    await tx.jadwalKerja.create({ data: { kode: tm, jabatanKode: kode, jamMasuk: j.jamMasuk, jamKeluar: j.jamKeluar, hariKerja: 22 } });
    await log("jadwal", tm);
    jabatanBaru[j.kunci] = kode;
  }
  const gp = await kodeBerikutnya(tx, AWALAN.GOLONGAN);
  await tx.golongan.create({ data: { kode: gp, ...GOLONGAN_BARU } });
  await log("golongan", gp);
  const tnj = await kodeBerikutnya(tx, AWALAN.TUNJANGAN);
  await tx.tunjangan.create({ data: { kode: tnj, ...TUNJANGAN_BARU } });
  await log("tunjangan", tnj);

  const inhouseBaru: { kode: string; profil: Profil }[] = [];
  for (const p of INHOUSE) {
    const kode = await kodeBerikutnya(tx, AWALAN.KARYAWAN);
    await tx.karyawan.create({ data: { kode, nama: p.nama, statusPtkp: p.ptkp, bank: p.bank, noRek: p.noRek, jenis: "INHOUSE" } });
    await log("karyawan", kode, k.hrd);
    const jabatanKode = jabatanBaru[p.jabatan] ?? p.jabatan;
    const golonganKode = p.golongan === "baru" ? gp : p.golongan;
    const tunjangan = p.tunjangan.map((t) => (t === "baru" ? tnj : t));
    const ada = await tx.jabatan.count({ where: { kode: jabatanKode, kelompok: "INHOUSE", aktif: true } });
    const adaGp = await tx.golongan.count({ where: { kode: golonganKode, aktif: true } });
    const adaTnj = await tx.tunjangan.count({ where: { kode: { in: tunjangan }, aktif: true } });
    if (!ada || !adaGp || adaTnj !== tunjangan.length) throw new GalatAksi(`Master untuk ${p.nama} tidak lengkap (jabatan ${jabatanKode}, golongan ${golonganKode}, tunjangan ${tunjangan.join(",")}).`);
    const set = await kodeBerikutnya(tx, AWALAN.SETTING_GAJI);
    await tx.settingGaji.create({ data: { kode: set, karyawanKode: kode, jabatanKode, golonganKode, tunjangan: { create: tunjangan.map((tunjanganKode) => ({ tunjanganKode })) } } });
    await log("setgaji", set, k.hrd);
    inhouseBaru.push({ kode, profil: p.profil });
  }

  for (const j of JABATAN_EVENT) {
    const kode = await kodeBerikutnya(tx, AWALAN.JABATAN);
    await tx.jabatan.create({ data: { kode, nama: j.nama, peranEvent: j.peranEvent, satuanTarif: j.satuanTarif, tarif: j.tarif, akunBebanKode: AKUN.BIAYA_FEE_EVENT, tunjJabatan: 0, tunjKeluarga: 0, kelompok: "EVENT" } });
    await log("jabatanEvent", kode);
    k.jabatan[j.kunci] = kode;
  }

  for (const c of CREW) {
    const kode = await kodeBerikutnya(tx, AWALAN.KARYAWAN);
    await tx.karyawan.create({ data: { kode, nama: c.nama, statusPtkp: c.ptkp, bank: c.bank, noRek: c.noRek, jenis: "EVENT" } });
    await log("karyawan", kode, k.hrd);
    k.orang[c.kunci] = kode;
    if (c.akun) {
      const u = await tx.pengguna.create({ data: { namaPengguna: c.akun, nama: c.nama, peran: "KAPTEN", karyawanKode: kode, kataSandiHash: hashKapten[c.akun] } });
      await catatLog(tx, k.owner, "pengguna.buat", "pengguna", String(u.id), `${c.akun} (KAPTEN)`);
      k.akunKapten[kode] = u.id;
    }
  }
  return inhouseBaru;
}

// ====================================================================== Alur utama

async function prasyarat(tx: Tx) {
  // Kunci advisory supaya dua proses skrip ini tidak berjalan bersamaan; penanda diperiksa sesudahnya.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(7410777)`;
  const akunKapten = CREW.filter((c) => c.akun).map((c) => c.akun!);
  const penanda = await tx.logAktivitas.count({ where: { aksi: PENANDA } });
  const namaDipakai = await tx.pengguna.findMany({ where: { namaPengguna: { in: akunKapten } }, select: { namaPengguna: true } });
  if (penanda || namaDipakai.length) {
    throw new GalatAksi(`Dibatalkan: data dummy sudah pernah ditambahkan (penanda log ${penanda}, akun ${namaDipakai.map((p) => p.namaPengguna).join(", ") || "-"}).`);
  }
  const hrd = await tx.pengguna.findFirst({ where: { peran: "HRD", aktif: true }, orderBy: { id: "asc" }, select: { id: true } });
  const owner = await tx.pengguna.findFirst({ where: { peran: "OWNER", aktif: true }, orderBy: { id: "asc" }, select: { id: true } });
  if (!hrd || !owner) throw new GalatAksi("Dibatalkan: butuh minimal satu pengguna HRD dan satu Owner yang aktif.");

  const jabatan = await tx.jabatan.findMany({ where: { kode: { in: ["JBT-05", "JBT-06"] }, kelompok: "EVENT", aktif: true }, select: { kode: true, peranEvent: true } });
  if (!jabatan.some((j) => j.kode === "JBT-05" && j.peranEvent === "KAPTEN") || !jabatan.some((j) => j.kode === "JBT-06" && j.peranEvent === "CREW")) {
    throw new GalatAksi("Dibatalkan: jabatan event JBT-05 (Kapten) dan JBT-06 (Crew) harus ada dan aktif.");
  }
  const akun = await tx.akun.count({ where: { kode: { in: Object.values(AKUN) } } });
  if (akun !== Object.values(AKUN).length) throw new GalatAksi("Dibatalkan: bagan akun bawaan tidak lengkap.");

  const lama = await tx.karyawan.findMany({ where: { kode: { in: Object.values(CREW_LAMA) }, jenis: "EVENT", aktif: true }, select: { kode: true } });
  if (lama.length !== Object.values(CREW_LAMA).length) throw new GalatAksi("Dibatalkan: crew event contoh KRY-06 dan KRY-08 sampai KRY-12 harus ada dan aktif.");
  const bima = await tx.pengguna.findFirst({ where: { karyawanKode: CREW_LAMA.bima, peran: "KAPTEN", aktif: true }, select: { id: true } });
  if (!bima) throw new GalatAksi(`Dibatalkan: akun kapten untuk ${CREW_LAMA.bima} tidak ditemukan.`);
  const setting = await tx.settingGaji.count({ where: { karyawanKode: { in: Object.keys(PROFIL_LAMA) }, aktif: true, karyawan: { aktif: true, jenis: "INHOUSE" } } });
  if (setting !== Object.keys(PROFIL_LAMA).length) throw new GalatAksi("Dibatalkan: karyawan inhouse KRY-01 sampai KRY-05 harus punya setting gaji aktif.");
  const tunjangan = await tx.tunjangan.count({ where: { kode: { in: ["TNJ-01", "TNJ-02", "TNJ-03", "TNJ-04"] }, aktif: true } });
  if (tunjangan !== 4) throw new GalatAksi("Dibatalkan: tunjangan TNJ-01 sampai TNJ-04 harus ada dan aktif.");

  const awal = keDate(`${PERIODE_GAJI}-01`);
  const akhir = keDate(hariTerakhir(PERIODE_GAJI));
  const slipNov = await tx.slipGaji.count({ where: { periodeId: PERIODE_GAJI } });
  const payNov = await tx.penggajian.count({ where: { periodeId: PERIODE_GAJI } });
  const presensiNov = await tx.presensi.count({ where: { tanggal: { gte: awal, lte: akhir } } });
  if (slipNov || payNov || presensiNov) throw new GalatAksi(`Dibatalkan: ${labelPeriode(PERIODE_GAJI)} sudah punya ${presensiNov} presensi, ${slipNov} slip, dan ${payNov} penggajian.`);
  return { hrd: hrd.id, owner: owner.id, bima: bima.id };
}

/** Periksa sebelum commit: neraca saldo seimbang dan saldo kas tidak pernah negatif (urut tanggal, lalu nomor jurnal). */
async function periksaAkhir(tx: Tx) {
  const jurnal = await muatJurnalBuku(tx);
  const akun = await tx.akun.findMany({ select: { kode: true } });
  const neraca = neracaSaldo(jurnal, akun.map((a) => a.kode), null);
  if (!neraca.seimbang) throw new GalatAksi(`Neraca saldo tidak seimbang: debit ${neraca.debit}, kredit ${neraca.kredit}.`);
  let kas = 0;
  let terendah = { saldo: Infinity, no: "", tanggal: "" };
  for (const j of [...jurnal].sort((a, b) => (a.tanggal + a.no).localeCompare(b.tanggal + b.no))) {
    for (const b of j.baris) if (b.akun === AKUN.KAS) kas += b.debit - b.kredit;
    if (kas < terendah.saldo) terendah = { saldo: kas, no: j.no, tanggal: j.tanggal };
  }
  if (terendah.saldo < 0) throw new GalatAksi(`Saldo kas negatif ${terendah.saldo} sesudah ${terendah.no} (${terendah.tanggal}).`);
  return { neraca, kasAkhir: kas, terendah };
}

async function main() {
  const hashKapten: Record<string, string> = {};
  for (const c of CREW) if (c.akun) hashKapten[c.akun] = await hashKataSandi(SANDI_KAPTEN);

  const hasil = await db.$transaction(
    async (tx) => {
      const p = await prasyarat(tx);
      const k: Konteks = {
        hrd: p.hrd,
        owner: p.owner,
        orang: { ...CREW_LAMA },
        jabatan: { kapten: "JBT-05", crew: "JBT-06" },
        akunKapten: { [CREW_LAMA.bima]: p.bima },
        jurnalBaru: [],
      };
      await catatLog(tx, k.owner, PENANDA, "data-dummy", null, "Data dummy gaji inhouse November 2026 dan fee event Oktober sampai Desember 2026 (prisma/tambah-dummy.ts)");

      const inhouseBaru = await tambahMaster(tx, k, hashKapten);

      // ---- Fee event, urut waktu kejadian supaya nomor event, laporan, dan jurnal mengikuti urutan tanggal.
      // EVT 1: disetujui tanpa perubahan.
      const e3 = await buatEvent(tx, k, E3);
      await nilaiCrew(tx, k, e3, "2026-10-05 08:00");
      await nilaiKapten(tx, k, e3, "2026-10-05 09:00");
      const f3 = await kirimLaporan(tx, k, e3, "Acara lancar, klien puas. Citra telat 20 menit saat loading in.", "2026-10-05 10:00");
      await setujuiLaporan(tx, k, f3, "2026-10-06 09:00");

      // EVT 2: 5 sesi lewat tengah malam, lembur, satu Kurang, fee akhir Joko dinaikkan Owner.
      const e4 = await buatEvent(tx, k, E4);
      await nilaiCrew(tx, k, e4, "2026-10-19 09:00");
      await nilaiKapten(tx, k, e4, "2026-10-19 11:00");
      const f4 = await kirimLaporan(tx, k, e4, "Konser selesai lewat tengah malam, loading out sampai jam 4 pagi. Ilham tertidur di truk saat loading out, sudah saya nilai kurang. Joko membetulkan mixer yang rusak saat gladi.", "2026-10-19 10:00");
      await setujuiLaporan(tx, k, f4, "2026-10-20 10:00", {
        joko: { selisih: 100_000, alasan: "Bonus perbaikan mixer yang rusak saat gladi, diminta yayasan." },
        fajar: { selisih: -20_000, alasan: "Potongan satu kabel XLR hilang saat loading out." },
      });

      // EVT 3: laporan ditolak Owner, kapten menilai ulang (Lukman jadi Kurang), kirim ulang, disetujui.
      const e5 = await buatEvent(tx, k, E5);
      await nilaiCrew(tx, k, e5, "2026-10-26 08:00", { ganti: { [kunciHadir(0, "lukman")]: S } });
      const f5a = await kirimLaporan(tx, k, e5, "Wisuda berjalan lancar.", "2026-10-26 09:00");
      await tolakLaporan(tx, k, f5a, "Panitia melaporkan dekorasi panggung baru siap pukul 13.00 saat loading in. Tolong periksa ulang penilaian crew dekorasi.", "2026-10-26 15:00");
      await nilaiCrew(tx, k, e5, "2026-10-27 08:00", { sesi: [0], orang: ["lukman"] });
      const f5b = await kirimLaporan(tx, k, e5, "Sudah dinilai ulang: Lukman kurang di loading in, jam diakui 4 jam.", "2026-10-27 09:00");
      await nilaiKapten(tx, k, e5, "2026-10-27 11:00");
      await setujuiLaporan(tx, k, f5b, "2026-10-27 13:00");

      // EVT 4: satu hari, crew telat, disetujui.
      const e6 = await buatEvent(tx, k, E6);
      await nilaiCrew(tx, k, e6, "2026-11-02 07:00");
      await nilaiKapten(tx, k, e6, "2026-11-02 09:00");
      const f6 = await kirimLaporan(tx, k, e6, "Seminar selesai tepat waktu. Nanda telat 45 menit.", "2026-11-02 08:00");
      await setujuiLaporan(tx, k, f6, "2026-11-02 10:00");

      // Kas tambahan untuk gaji November (pola setoran modal di data contoh).
      await setoranModal(tx, k, "2026-11-02", SETORAN_MODAL);

      // EVT 5: laporan menunggu Owner, ada Kurang crew dan kapten dinilai Kurang oleh Owner.
      const e7 = await buatEvent(tx, k, E7);
      await nilaiCrew(tx, k, e7, "2026-11-09 08:00");
      await kirimLaporan(tx, k, e7, "Festival dua hari ramai. Ilham meninggalkan genset di hari kedua, sudah saya nilai kurang. Maya telat satu jam dengan izin.", "2026-11-09 10:00");
      await nilaiKapten(tx, k, e7, "2026-11-09 14:00");

      // EVT 6: laporan ditolak, HRD membetulkan jam pulang Kevin (penilaiannya terhapus), kapten sedang menilai ulang.
      const e8 = await buatEvent(tx, k, E8);
      await nilaiCrew(tx, k, e8, "2026-11-14 08:00", { ganti: { [kunciHadir(2, "lukman")]: S } });
      const f8 = await kirimLaporan(tx, k, e8, "Pameran ramai, semua crew hadir sampai loading out.", "2026-11-14 09:00");
      await tolakLaporan(tx, k, f8, "Pengelola mall mencatat Kevin keluar pukul 22.30 saat loading out. Minta HRD membetulkan jam pulangnya lalu nilai ulang.", "2026-11-15 10:00");
      await ubahJamPulang(tx, k, e8, 2, "kevin", "22:30");
      await nilaiCrew(tx, k, e8, "2026-11-15 13:00", { sesi: [2], orang: ["lukman"] });

      // EVT 7: sebagian dinilai (loading out belum).
      const e9 = await buatEvent(tx, k, E9);
      await nilaiCrew(tx, k, e9, "2026-11-16 08:00", { sesi: [0, 1] });

      // EVT 8: kehadiran dicatat, belum dinilai.
      const e10 = await buatEvent(tx, k, E10);

      // EVT 9 dan 10: Desember, sesi dan penugasan saja (belum ada kehadiran).
      const e11 = await buatEvent(tx, k, E11);
      const e12 = await buatEvent(tx, k, E12);

      // ---- Gaji inhouse November: presensi lengkap, hitung slip, ajukan, setujui (jurnal dan dibayar).
      for (const [kode, profil] of Object.entries(PROFIL_LAMA)) await presensiSebulan(tx, k, kode, profil);
      for (const x of inhouseBaru) await presensiSebulan(tx, k, x.kode, x.profil);
      const gaji = await gajiSebulan(tx, k, PERIODE_GAJI);

      const periksa = await periksaAkhir(tx);
      const event = [e3, e4, e5, e6, e7, e8, e9, e10, e11, e12].map((e) => e.kode);
      const ringkas = { k, event, gaji, periksa };
      if (COBA) throw Object.assign(new Error("COBA"), { ringkas });
      return ringkas;
    },
    { timeout: 600_000, maxWait: 30_000 },
  ).catch((e) => {
    if (e instanceof Error && e.message === "COBA") return (e as Error & { ringkas: unknown }).ringkas as never;
    throw e;
  });

  await cetakRingkasan(hasil);
}

async function cetakRingkasan(h: { k: Konteks; event: string[]; gaji: { no: string; jumlah: number; thp: number }; periksa: Awaited<ReturnType<typeof periksaAkhir>> }) {
  const rp = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
  console.log(COBA ? "MODE COBA: semua langkah berhasil lalu DIBATALKAN, tidak ada yang tersimpan.\n" : "Data dummy tersimpan.\n");
  console.log(`Karyawan inhouse baru: ${INHOUSE.length}, karyawan event baru: ${CREW.length}, jabatan baru: ${JABATAN_INHOUSE.length} inhouse + ${JABATAN_EVENT.length} event, golongan 1, tunjangan 1.`);
  console.log(`Event baru (${h.event.length}): ${h.event[0]} sampai ${h.event[h.event.length - 1]}`);
  if (!COBA) {
    const [evStatus, lapStatus, nilai, presensi, slipFee, kehadiran] = await Promise.all([
      db.event.groupBy({ by: ["status"], where: { kode: { in: h.event } }, _count: true }),
      db.laporanFee.groupBy({ by: ["status"], where: { eventKode: { in: h.event } }, _count: true }),
      db.kehadiranEvent.groupBy({ by: ["penilaian"], where: { sesi: { eventKode: { in: h.event } } }, _count: true }),
      db.presensi.groupBy({ by: ["absensi"], where: { tanggal: { gte: keDate(`${PERIODE_GAJI}-01`), lte: keDate(hariTerakhir(PERIODE_GAJI)) } }, _count: true }),
      db.slipFee.count({ where: { eventKode: { in: h.event } } }),
      db.kehadiranEvent.count({ where: { sesi: { eventKode: { in: h.event } } } }),
    ]);
    console.log(`  status event: ${evStatus.map((x) => `${x.status} ${x._count}`).join(", ")}`);
    console.log(`  laporan fee: ${lapStatus.map((x) => `${x.status} ${x._count}`).join(", ")}`);
    console.log(`  kehadiran: ${kehadiran} (${nilai.map((x) => `${x.penilaian ?? "belum dinilai"} ${x._count}`).join(", ")}), slip fee: ${slipFee}`);
    console.log(`Presensi ${labelPeriode(PERIODE_GAJI)}: ${presensi.map((x) => `${x.absensi} ${x._count}`).join(", ")}`);
  }
  console.log(`Penggajian ${h.gaji.no}: ${h.gaji.jumlah} slip, THP ${rp(h.gaji.thp)}, status Dibayar.`);
  const jurnal = COBA ? [] : await db.jurnal.findMany({ where: { no: { in: h.k.jurnalBaru } }, orderBy: { no: "asc" }, include: { detail: { select: { debit: true } } } });
  console.log(`Jurnal baru (${h.k.jurnalBaru.length}):`);
  for (const no of h.k.jurnalBaru) {
    const j = jurnal.find((x) => x.no === no);
    console.log(`  ${no}${j ? `  ${labelTanggal(j.tanggal.toISOString().slice(0, 10))}  ${rp(j.detail.reduce((s, d) => s + d.debit, 0)).padStart(16)}  ${j.keterangan}` : ""}`);
  }
  const n = h.periksa.neraca;
  console.log(`Neraca saldo: debit ${rp(n.debit)}, kredit ${rp(n.kredit)}, ${n.seimbang ? "SEIMBANG" : "TIDAK SEIMBANG"}.`);
  console.log(`Saldo kas akhir ${rp(h.periksa.kasAkhir)}, terendah ${rp(h.periksa.terendah.saldo)} sesudah ${h.periksa.terendah.no} (${labelTanggal(h.periksa.terendah.tanggal)}).`);
  console.log("Akun kapten baru (kata sandi kapten123):");
  for (const c of CREW.filter((x) => x.akun)) console.log(`  ${c.akun} = ${c.nama} (${h.k.orang[c.kunci]})`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
