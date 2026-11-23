/*
 * Menambah data dummy sampai Desember 2026 ke database yang sudah berisi (produksi), supaya semua alur bisa dicoba
 * sampai Desember. Dijalankan SESUDAH migrasi 20261124090000_nominal_riwayat (riwayat nominal master).
 *
 * Isi (urut kejadian):
 *  1. Proses ulang penyusutan November untuk aset yang jurnalnya ditolak Owner (JP-2026-0006): Admin memproses (jurnal
 *     penyesuaian DRAFT baru), Admin mengajukan, Owner menyetujui. Owner bukan pembuat jurnalnya.
 *  2. Investasi Kas Desember: setoran 1 Desember dicatat dan disetujui Owner (jurnal Dr Kas, Kr Modal Pemilik), setoran
 *     15 Desember dicatat Admin dan dibiarkan menunggu Owner.
 *  3. Contoh riwayat berlaku Desember 2026: promosi KRY-17 (Crew Produksi, Golongan Kontrak menjadi Operator Sound &
 *     Lighting, Golongan I) diajukan HRD dan disetujui Owner; kenaikan nominal tunjangan Makan (TNJ-02) diajukan HRD dan
 *     disetujui Owner. Slip Desember menunjukkan versi barunya.
 *  4. Presensi Desember semua karyawan inhouse aktif (hari kerja Senin sampai Jumat, 25 Desember libur), dengan izin,
 *     sakit, cuti, alpa, dan terlambat yang beragam.
 *  5. Hitung gaji Desember: slip DRAFT (belum diajukan), supaya alur Distribusi bisa dicoba lewat UI.
 *  6. Fee event Desember: EVT-2026-0011 kehadiran dicatat HRD, semua crew dinilai kapten (satu KURANG), kapten dinilai
 *     Owner, laporan dikirim kapten dan menunggu Owner. EVT-2026-0012 kehadiran dicatat HRD dan baru sebagian dinilai.
 *  Pembelian Desember yang masih draf dibiarkan. Penyusutan dan nilai sisa Desember TIDAK diproses: aplikasi menolak
 *  periode yang belum berjalan, dan skrip ini mengikuti aturan yang sama.
 *
 * Semua langkah memakai layanan yang sama dengan server action: simpanSlip, ajukanSettingDalam, setujuiSettingDalam,
 * ajukanNominalDalam, setujuiNominalDalam, muatBahanGaji, muatBahanEvent, buatJurnal, ajukanJurnal, setujuiJurnal,
 * barisPenyusutan, barisInvestasiKas, nomorDokumen, dan skema zod aplikasi. Langkah yang hanya ada di server action
 * (presensi, kehadiran, penilaian, kirim laporan, investasi kas) ditiru dengan urutan cek, klaim status, dan log yang sama.
 *
 * Tanggal dokumen = Desember 2026 (atau 30 November untuk penyusutan). Waktu dibuat, diajukan, dan diputuskan = saat skrip
 * dijalankan, karena datanya memang dimasukkan sekarang; jadi jejak waktunya tetap urut dengan aksi yang nanti dicoba
 * lewat UI.
 *
 * Semuanya dalam satu transaksi. Sebelum commit skrip memeriksa neraca saldo seimbang, saldo kas tidak pernah negatif
 * (urut tanggal lalu nomor jurnal), dan penghitung nomor tidak tertinggal. Skrip menolak jalan kedua kali (penanda di log
 * aktivitas, presensi atau slip Desember yang sudah ada, kehadiran EVT-2026-0011 dan EVT-2026-0012).
 *
 * Jalankan: npx tsx prisma/tambah-dummy-desember.ts
 * Coba tanpa menyimpan (semua langkah dijalankan lalu dibatalkan): npx tsx prisma/tambah-dummy-desember.ts --coba
 */
import "dotenv/config";
import { db, type Tx } from "../src/lib/server/db";
import { GalatAksi, validasi } from "../src/lib/server/aksi";
import { AWALAN, nomorDokumen } from "../src/lib/server/nomor";
import { pastikanTerbuka } from "../src/lib/server/periode";
import { ajukanJurnal, buatJurnal, muatJurnalBuku, saldoAkun, setujuiJurnal } from "../src/lib/server/jurnal";
import { catatLog } from "../src/lib/server/log";
import { ajukanSettingDalam, setujuiSettingDalam, tahanKunciSetting } from "../src/lib/server/setting-gaji";
import { ajukanNominalDalam, setujuiNominalDalam } from "../src/lib/server/nominal";
import { simpanSlip } from "../src/lib/server/gaji";
import { AKUN } from "../src/lib/inti/akun";
import { barisPenyusutan } from "../src/lib/inti/jurnal";
import { barisInvestasiKas } from "../src/lib/inti/modal";
import { neracaLajur, neracaSaldo } from "../src/lib/inti/buku-besar";
import { hitungTerlambat, type JenisAbsensi } from "../src/lib/inti/penggajian";
import { durasiKeMenit, menitTercatat } from "../src/lib/inti/fee-event";
import { dariDate, hariTerakhir, keDate, keMenit, labelPeriode, labelTanggal, periodeDari, periodeIni } from "../src/lib/inti/tanggal";
import { rupiah } from "../src/lib/format";
import { muatBahanGaji, versiBerlakuPeriode } from "../src/lib/data/sdm/gaji";
import { kunciEvent, muatBahanEvent, pastikanKaptenEvent } from "../src/lib/data/fee-event/bahan";
import { skemaPresensi } from "../src/lib/skema/sdm";
import { skemaKehadiran, skemaKirimLaporan, skemaPenilaian } from "../src/lib/skema/fee-event";
import { skemaInvestasiKas } from "../src/lib/skema/modal";
import { skemaProsesPenyusutan } from "../src/lib/skema/konversi";
import { skemaAjukanSetting } from "../src/lib/skema/setting-gaji";
import { skemaAjukanNominal } from "../src/lib/skema/nominal";

const PENANDA = "data-dummy.desember";
const NOV = "2026-11";
const DES = "2026-12";
const JURNAL_DITOLAK = "JP-2026-0006";
const COBA = process.argv.includes("--coba");
const LIBUR = new Set(["2026-12-25"]);

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
function kocok<T>(daftar: T[], r: () => number): T[] {
  const a = [...daftar];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ====================================================================== Rencana data

type Profil = { izin?: number; sakit?: number; cuti?: number; alpa?: number; telat?: number };
/** Variasi presensi Desember per karyawan inhouse. Karyawan yang tidak disebut: hadir semua, satu kali terlambat. */
const PROFIL: Record<string, Profil> = {
  "KRY-01": { telat: 1 },
  "KRY-02": { izin: 1, telat: 2 },
  "KRY-03": { sakit: 2 },
  "KRY-04": { cuti: 2, telat: 1 },
  "KRY-05": { alpa: 1, telat: 3 },
  "KRY-13": { izin: 1 },
  "KRY-14": { cuti: 3 },
  "KRY-15": { telat: 2 },
  "KRY-16": { sakit: 1, alpa: 1 },
  "KRY-17": { telat: 1 },
};

const PROMOSI = {
  karyawanKode: "KRY-17",
  jenisPerubahan: "PROMOSI" as const,
  jabatanKode: "JBT-03",
  golonganKode: "GP-01",
  alasan: "Lulus masa kontrak dan diangkat menjadi operator sound & lighting mulai Desember 2026.",
};
const NOMINAL = {
  jenis: "TUNJANGAN" as const,
  itemKode: "TNJ-02",
  nominal: 450_000,
  alasan: "Penyesuaian uang makan akhir tahun mengikuti kenaikan harga bahan pokok.",
};
const SETORAN = [
  { kunci: "disetujui", tanggal: "2026-12-01", jumlah: 75_000_000, keterangan: "Setoran modal pemilik untuk gaji dan fee event Desember 2026", oleh: "owner" as const, setujui: true },
  { kunci: "menunggu", tanggal: "2026-12-15", jumlah: 25_000_000, keterangan: "Tambahan kas operasional akhir tahun (tutup buku Desember)", oleh: "admin" as const, setujui: false },
];

type Nilai = { kurang?: string; catatan?: string };
/** [karyawan, masuk, pulang, catatan progres, penilaian (kosong = belum dinilai)] */
type Hadir = [string, string, string, string, Nilai?];
const S: Nilai = {};

/** EVT-2026-0011 Gathering Akhir Tahun PT Mitra Logistik Nusantara: dinilai lengkap lalu laporan dikirim ke Owner. */
const HADIR_0011: Record<string, Hadir[]> = {
  "Meeting": [
    ["KRY-21", "18:50", "21:00", "Memimpin briefing rundown dan pembagian zona", S],
    ["KRY-22", "18:55", "21:00", "Mencatat kebutuhan sound outdoor pantai", S],
    ["KRY-23", "19:05", "21:00", "Mencatat titik lighting dan genset", S],
  ],
  "Loading in": [
    ["KRY-21", "12:45", "20:00", "Koordinasi loading dengan vendor tenda", S],
    ["KRY-22", "13:00", "20:00", "Pasang sound system dan line check", S],
    ["KRY-23", "13:00", "20:00", "Pasang truss dan lighting panggung utama", S],
    ["KRY-27", "14:10", "20:00", "Datang terlambat karena macet, bantu kabel power", S],
    ["KRY-32", "13:00", "20:00", "Set panggung dan backdrop", S],
  ],
  "Hari H": [
    ["KRY-21", "06:45", "16:00", "Memimpin acara dan koordinasi klien", S],
    ["KRY-22", "07:00", "16:00", "Operator sound utama", S],
    ["KRY-23", "07:00", "16:00", "Operator lighting", S],
    ["KRY-27", "07:00", "16:00", "Standby genset dan distribusi listrik", S],
    ["KRY-32", "07:00", "13:30", "Stage crew, izin pulang lebih awal", { kurang: "5:30", catatan: "Pulang 13.30 tanpa pengganti, sesi games sore kekurangan stage crew." }],
    ["KRY-33", "06:30", "15:00", "Registrasi tamu dan pembagian doorprize", S],
  ],
  "Loading out": [
    ["KRY-21", "16:00", "20:00", "Cek inventaris barang kembali", S],
    ["KRY-22", "16:00", "20:00", "Bongkar sound dan packing", S],
    ["KRY-23", "16:00", "19:30", "Bongkar lighting dan truss", S],
    ["KRY-27", "16:00", "20:00", "Gulung kabel dan muat truk", S],
  ],
};

/** EVT-2026-0012 Malam Pergantian Tahun 2027: kehadiran lengkap, kapten baru menilai sesi Loading in. */
const HADIR_0012: Record<string, Hadir[]> = {
  "Loading in": [
    ["KRY-06", "07:45", "18:00", "Koordinasi loading panggung alun-alun", undefined],
    ["KRY-18", "08:00", "18:00", "Koordinasi vendor LED dan genset", undefined],
    ["KRY-12", "08:00", "18:00", "Rakit panggung modular", S],
    ["KRY-24", "08:00", "18:00", "Pasang sound line array", S],
    ["KRY-25", "08:30", "18:00", "Pasang LED screen", { kurang: "8:00", catatan: "Istirahat terlalu lama, pemasangan LED molor satu jam." }],
    ["KRY-29", "08:00", "17:00", "Pasang barikade penonton", S],
    ["KRY-30", "08:00", "18:00", "Pasang lighting dan follow spot", S],
    ["KRY-31", "08:00", "18:00", "Tarik kabel power dari genset", S],
    ["KRY-34", "08:00", "18:00", "Set area backstage dan ruang artis", S],
  ],
  "Gladi": [
    ["KRY-06", "19:00", "23:00", "Memimpin gladi bersih", undefined],
    ["KRY-18", "19:00", "23:00", "Cek cue lighting dan LED", undefined],
    ["KRY-12", "19:00", "23:00", "Stage manager gladi", undefined],
    ["KRY-24", "19:00", "23:00", "Soundcheck band pembuka", undefined],
    ["KRY-30", "19:00", "23:00", "Program cue lighting", undefined],
    ["KRY-34", "19:00", "22:30", "Atur alur keluar masuk artis", undefined],
  ],
  "Hari H": [
    ["KRY-06", "14:30", "23:59", "Memimpin acara malam pergantian tahun", undefined],
    ["KRY-18", "14:30", "23:59", "Koordinasi teknis dan keamanan panggung", undefined],
    ["KRY-12", "15:00", "23:59", "Stage manager", undefined],
    ["KRY-24", "15:00", "23:59", "Operator sound FOH", undefined],
    ["KRY-25", "15:00", "23:59", "Operator LED screen", undefined],
    ["KRY-26", "15:00", "21:00", "Registrasi tamu VIP", undefined],
    ["KRY-29", "15:00", "23:59", "Crowd control barikade", undefined],
    ["KRY-30", "15:00", "23:59", "Operator lighting", undefined],
    ["KRY-31", "15:00", "23:59", "Standby genset", undefined],
    ["KRY-34", "15:00", "23:59", "Backstage dan konsumsi artis", undefined],
  ],
};

type Konteks = {
  admin: number;
  hrd: number;
  owner: number;
  jurnalBaru: string[];
  catatan: string[];
  hasil: {
    penyusutan?: { jurnal: string; aset: number; beban: number } | null;
    setoran: string[];
    setting?: string;
    nominal?: string;
    presensi: number;
    slip: string[];
    laporan?: string;
    event: string[];
  };
};

// ====================================================================== Langkah (meniru server action)

/** prosesPenyusutan (Admin) untuk baris jadwal periode yang belum dijurnal, lalu ajukan (Admin) dan setujui (Owner). */
async function prosesUlangPenyusutan(tx: Tx, k: Konteks, periode: string) {
  const { periode: P } = validasi(skemaProsesPenyusutan, { periode });
  if (P > periodeIni()) throw new GalatAksi("Periode ini belum berjalan, jadi belum bisa diproses.");
  await pastikanTerbuka(tx, P);
  const lebihAwal = await tx.jadwalPenyusutan.findFirst({ where: { periodeId: { lt: P }, jurnalNo: null, aset: { status: "AKTIF" } }, orderBy: { periodeId: "asc" }, select: { periodeId: true } });
  if (lebihAwal) throw new GalatAksi(`Periode ${labelPeriode(lebihAwal.periodeId)} belum diproses.`);
  const baris = await tx.jadwalPenyusutan.findMany({
    where: { periodeId: P, jurnalNo: null, aset: { status: "AKTIF" } },
    orderBy: { asetKode: "asc" },
    include: { aset: { select: { akunBebanKode: true, akunAkumulasiKode: true } } },
  });
  if (!baris.length) {
    k.catatan.push(`Penyusutan ${labelPeriode(P)} tidak punya baris yang belum dijurnal (sudah diproses ulang lewat UI), langkah ini dilewati.`);
    k.hasil.penyusutan = null;
    return;
  }
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
  // ajukanJurnalPenyesuaian (Admin) dan setujuiJurnalPenyesuaian (Owner): kunci baris jurnal seperti aksi halaman.
  await tx.$queryRaw`SELECT no_jurnal FROM jurnal WHERE no_jurnal = ${jurnalNo} FOR UPDATE`;
  await ajukanJurnal(tx, jurnalNo, k.admin);
  await setujuiJurnal(tx, jurnalNo, k.owner);
  k.hasil.penyusutan = { jurnal: jurnalNo, aset: baris.length, beban: baris.reduce((s, r) => s + r.beban, 0) };
}

/** catatInvestasiKas lalu (bila diminta) setujuiInvestasiKas. */
async function setoranModal(tx: Tx, k: Konteks, s: (typeof SETORAN)[number]) {
  const d = validasi(skemaInvestasiKas, { tanggal: s.tanggal, jumlah: s.jumlah, keterangan: s.keterangan });
  const oleh = s.oleh === "owner" ? k.owner : k.admin;
  await pastikanTerbuka(tx, periodeDari(d.tanggal), { tanggal: "Periode tanggal ini sudah tertutup." });
  const no = await nomorDokumen(tx, AWALAN.INVESTASI_KAS, d.tanggal);
  await tx.investasiKas.create({ data: { no, tanggal: keDate(d.tanggal), jumlah: d.jumlah, keterangan: d.keterangan, status: "DIAJUKAN", dibuatOlehId: oleh } });
  await catatLog(tx, oleh, "investasi-kas.catat", "investasi_kas", no, `${rupiah(d.jumlah)}, ${d.keterangan}`);
  k.hasil.setoran.push(no);
  if (!s.setujui) return;
  const jurnal = await buatJurnal(tx, {
    tanggal: d.tanggal,
    jenis: "UMUM",
    status: "DISETUJUI",
    keterangan: `Setoran modal pemilik ${no}: ${d.keterangan}`,
    baris: barisInvestasiKas(d.jumlah),
    sumberTipe: "INVESTASI_KAS",
    sumberId: no,
    dibuatOlehId: oleh,
    disetujuiOlehId: k.owner,
  });
  k.jurnalBaru.push(jurnal);
  const klaim = await tx.investasiKas.updateMany({ where: { no, status: "DIAJUKAN" }, data: { status: "DISETUJUI", jurnalNo: jurnal, diputuskanOlehId: k.owner, diputuskanPada: new Date() } });
  if (klaim.count !== 1) throw new GalatAksi(`Setoran ${no} sudah diputuskan.`);
  await catatLog(tx, k.owner, "investasi-kas.setujui", "investasi_kas", no, `Jurnal ${jurnal}`);
}

/** ajukanSettingGaji (HRD) lalu setujuiSettingGaji (Owner), lewat layanan yang sama dengan server action. */
async function promosi(tx: Tx, k: Konteks) {
  const tunjangan = await tx.settingTunjangan.findMany({ where: { setting: { karyawanKode: PROMOSI.karyawanKode, status: "DISETUJUI" } }, select: { tunjanganKode: true, settingKode: true } });
  const [berlaku] = await versiBerlakuPeriode(tx, NOV, PROMOSI.karyawanKode);
  if (!berlaku) throw new GalatAksi(`${PROMOSI.karyawanKode} belum punya setting gaji berlaku di November 2026.`);
  const d = validasi(skemaAjukanSetting, { ...PROMOSI, tunjanganKodes: tunjangan.filter((t) => t.settingKode === berlaku.kode).map((t) => t.tunjanganKode), bulan: 12, tahun: 2026 });
  const h = await ajukanSettingDalam(tx, k.hrd, d, DES);
  await setujuiSettingDalam(tx, k.owner, h.kode);
  k.hasil.setting = h.kode;
}

/** ajukanNominal (HRD) lalu setujuiNominal (Owner). */
async function kenaikanNominal(tx: Tx, k: Konteks) {
  const d = validasi(skemaAjukanNominal, { ...NOMINAL, bulan: 12, tahun: 2026 });
  const h = await ajukanNominalDalam(tx, k.hrd, { ...d, berlaku: DES });
  await setujuiNominalDalam(tx, k.owner, h.kode);
  k.hasil.nominal = h.kode;
}

/** simpanPresensi (baris baru). */
async function tambahPresensi(tx: Tx, k: Konteks, input: { karyawanKode: string; tanggal: string; absensi: JenisAbsensi; jamMasuk?: string; jamKeluar?: string }) {
  const d = validasi(skemaPresensi, input);
  const hadir = d.absensi === "HADIR";
  const periode = periodeDari(d.tanggal);
  const karyawan = await tx.karyawan.findUnique({ where: { kode: d.karyawanKode }, select: { aktif: true, jenis: true } });
  if (!karyawan || !karyawan.aktif || karyawan.jenis !== "INHOUSE") throw new GalatAksi(`${d.karyawanKode} bukan karyawan inhouse aktif.`);
  const [versi] = await versiBerlakuPeriode(tx, periode, d.karyawanKode);
  const jadwal = versi?.jabatan.jadwalKerja ?? null;
  if (!versi || !jadwal) throw new GalatAksi(`${d.karyawanKode} belum punya setting gaji berlaku atau jadwal kerja di ${labelPeriode(periode)}.`);
  const slip = await tx.slipGaji.findUnique({ where: { periodeId_karyawanKode: { periodeId: periode, karyawanKode: d.karyawanKode } }, select: { status: true } });
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
  k.hasil.presensi++;
}

/** Presensi Desember satu karyawan: hari kerja Senin sampai Jumat (25 Desember libur), Sabtu bila hari kerja jadwal belum cukup. */
async function presensiSebulan(tx: Tx, k: Konteks, karyawanKode: string) {
  const [s] = await versiBerlakuPeriode(tx, DES, karyawanKode);
  const jadwal = s?.jabatan.jadwalKerja;
  if (!jadwal) throw new GalatAksi(`${karyawanKode} belum punya jadwal kerja di Desember 2026.`);
  const akhir = Number(hariTerakhir(DES).slice(8));
  const semua = Array.from({ length: akhir }, (_, i) => `${DES}-${String(i + 1).padStart(2, "0")}`).filter((t) => !LIBUR.has(t));
  const hariKe = (t: string) => new Date(`${t}T00:00:00Z`).getUTCDay();
  const kerja = semua.filter((t) => hariKe(t) >= 1 && hariKe(t) <= 5);
  for (const sabtu of semua.filter((t) => hariKe(t) === 6)) if (kerja.length < jadwal.hariKerja) kerja.push(sabtu);
  kerja.sort();
  const profil = PROFIL[karyawanKode] ?? { telat: 1 };
  const r = acak(`${karyawanKode}-${DES}`);
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
    const masuk = telat.has(tanggal) ? masukJadwal + 5 + Math.floor(r() * 40) : masukJadwal - Math.floor(r() * 16);
    const keluar = keluarJadwal + Math.floor(r() * 41);
    await tambahPresensi(tx, k, { karyawanKode, tanggal, absensi: "HADIR", jamMasuk: jam(masuk), jamKeluar: jam(keluar) });
  }
}

/** hitungSlipSemua: slip DRAFT untuk semua karyawan inhouse yang punya presensi (layanan simpanSlip yang sama). */
async function hitungGaji(tx: Tx, k: Konteks, periode: string) {
  await pastikanTerbuka(tx, periode);
  await tahanKunciSetting(tx);
  for (const b of await muatBahanGaji(tx, periode)) {
    if (!b.jumlahPresensi) continue;
    if (!(await simpanSlip(tx, b, periode, k.hrd))) throw new GalatAksi(`Slip ${b.nama} ${labelPeriode(periode)} sudah diajukan atau dibayar.`);
    k.hasil.slip.push(`SLP-${periode}-${b.karyawanKode}`);
  }
}

/** simpanKehadiran (baru) oleh HRD untuk satu sesi. Mengembalikan id kehadiran per karyawan. */
async function catatKehadiran(tx: Tx, k: Konteks, eventKode: string, namaSesi: string, hadir: Hadir[]): Promise<Map<string, number>> {
  const sesi = await tx.sesiEvent.findFirst({ where: { eventKode, nama: namaSesi }, select: { id: true, nama: true } });
  if (!sesi) throw new GalatAksi(`Sesi ${namaSesi} di ${eventKode} tidak ditemukan.`);
  const e = await kunciEvent(tx, eventKode);
  if (e.status !== "PENILAIAN") throw new GalatAksi(`${eventKode} tidak dalam tahap penilaian.`);
  const id = new Map<string, number>();
  for (const [karyawanKode, masuk, pulang, progres] of hadir) {
    const d = validasi(skemaKehadiran, { sesiId: sesi.id, karyawanKode, jamMasuk: masuk, jamPulang: pulang, catatanProgres: progres });
    const tugas = await tx.penugasanEvent.findUnique({ where: { eventKode_karyawanKode: { eventKode, karyawanKode } }, select: { id: true } });
    if (!tugas) throw new GalatAksi(`${karyawanKode} belum ditugaskan di ${eventKode}.`);
    const bentrok = await tx.kehadiranEvent.findUnique({ where: { sesiId_karyawanKode: { sesiId: d.sesiId, karyawanKode } }, select: { id: true } });
    if (bentrok) throw new GalatAksi(`Kehadiran ${karyawanKode} di ${eventKode} ${namaSesi} sudah ada.`);
    const baris = await tx.kehadiranEvent.create({ data: { sesiId: d.sesiId, karyawanKode, jamMasuk: d.jamMasuk, jamPulang: d.jamPulang, catatanProgres: d.catatanProgres, dibuatOlehId: k.hrd } });
    await catatLog(tx, k.hrd, "kehadiran-event.buat", "kehadiran_event", String(baris.id), `${eventKode} ${sesi.nama} ${karyawanKode}`);
    id.set(karyawanKode, baris.id);
  }
  return id;
}

/** nilaiKehadiran: penilai KAPTEN (crew di event miliknya) atau OWNER (kehadiran kapten). */
async function nilaiSatu(tx: Tx, penilai: { id: number; peran: "KAPTEN" | "OWNER" }, id: number, n: Nilai) {
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
  await tx.kehadiranEvent.update({ where: { id: kh.id }, data: { penilaian: d.penilaian, menitDiakui, catatanNilai: d.catatan || null, dinilaiOlehId: penilai.id, dinilaiPada: new Date() } });
  await catatLog(tx, penilai.id, "kehadiran-event.nilai", "kehadiran_event", String(kh.id), `${kh.sesi.eventKode} ${kh.sesi.nama} ${kh.karyawanKode}: ${d.penilaian}${menitDiakui !== null ? ` ${menitDiakui} menit` : ""}`);
}

/** Akun pengguna kapten untuk karyawan event (pengguna.id_karyawan). */
async function akunKapten(tx: Tx, karyawanKode: string) {
  const p = await tx.pengguna.findUnique({ where: { karyawanKode }, select: { id: true, peran: true, aktif: true } });
  if (!p || p.peran !== "KAPTEN" || !p.aktif) throw new GalatAksi(`${karyawanKode} belum punya akun kapten aktif.`);
  return p.id;
}

/** Kehadiran satu event dari rencana; penilaian crew oleh kapten (dan kapten oleh Owner) bila diminta. */
async function isiEvent(tx: Tx, k: Konteks, eventKode: string, rencana: Record<string, Hadir[]>, kaptenPenilai: string, opsi: { nilaiKapten: boolean }) {
  const kapten = new Set((await tx.penugasanEvent.findMany({ where: { eventKode, jabatan: { peranEvent: "KAPTEN" } }, select: { karyawanKode: true } })).map((x) => x.karyawanKode));
  const idKapten = await akunKapten(tx, kaptenPenilai);
  for (const [sesi, hadir] of Object.entries(rencana)) {
    const id = await catatKehadiran(tx, k, eventKode, sesi, hadir);
    for (const [karyawanKode, , , , nilai] of hadir) {
      if (!nilai) continue;
      if (kapten.has(karyawanKode)) {
        if (opsi.nilaiKapten) await nilaiSatu(tx, { id: k.owner, peran: "OWNER" }, id.get(karyawanKode)!, nilai);
      } else {
        await nilaiSatu(tx, { id: idKapten, peran: "KAPTEN" }, id.get(karyawanKode)!, nilai);
      }
    }
  }
  k.hasil.event.push(eventKode);
}

/** kirimLaporan oleh kapten (aturan sama dengan aksi: kunci event, kunci bersama nominal, tarif harus berlaku). */
async function kirimLaporan(tx: Tx, k: Konteks, eventKode: string, kaptenKode: string, catatanKapten: string): Promise<string> {
  const { catatan } = validasi(skemaKirimLaporan, { eventKode, catatan: catatanKapten });
  const penggunaId = await akunKapten(tx, kaptenKode);
  await pastikanKaptenEvent(tx, penggunaId, eventKode);
  const e = await kunciEvent(tx, eventKode);
  if (e.status !== "PENILAIAN") throw new GalatAksi(`Laporan ${eventKode} sudah dikirim.`);
  await tahanKunciSetting(tx);
  const b = await muatBahanEvent(tx, eventKode);
  if (!b || !b.orang.some((o) => o.peranEvent === "KAPTEN") || !b.orang.some((o) => o.kehadiran.length)) throw new GalatAksi(`${eventKode} belum siap dilaporkan.`);
  if (b.tarifKurang.length) throw new GalatAksi(`Tarif ${b.tarifKurang.join(", ")} belum berlaku di ${labelPeriode(b.periodeTarif)}.`);
  if (b.crewBelumDinilai) throw new GalatAksi(`${eventKode}: masih ada ${b.crewBelumDinilai} kehadiran crew yang belum dinilai.`);
  const no = await nomorDokumen(tx, AWALAN.LAPORAN_FEE, e.tanggalSelesai);
  const klaim = await tx.event.updateMany({ where: { kode: eventKode, status: "PENILAIAN" }, data: { status: "DIAJUKAN", alasanTolak: null } });
  if (klaim.count !== 1) throw new GalatAksi(`Status ${eventKode} berubah.`);
  await tx.laporanFee.create({ data: { no, eventKode, status: "DIAJUKAN", catatanKapten: catatan, totalUsulan: b.totalUsulan, diajukanOlehId: penggunaId } });
  const kurang = b.orang.reduce((s, o) => s + o.usulan.jumlahKurang, 0);
  await catatLog(tx, penggunaId, "laporan-fee.ajukan", "laporan_fee", no, `${eventKode}, ${kurang} penilaian kurang`);
  k.hasil.laporan = no;
  return no;
}

// ====================================================================== Pemeriksaan

/** Penghitung nomor harus sudah melewati nomor terbesar yang ada, supaya nomor baru tidak bentrok. */
async function cekPenghitung(tx: Tx) {
  const ambil = (kueri: Promise<{ kode: string }[]>) => kueri;
  const daftar: { kunci: string; kueri: Promise<{ kode: string }[]> }[] = [
    { kunci: "JU2026", kueri: ambil(tx.jurnal.findMany({ where: { no: { startsWith: "JU-2026-" } }, select: { no: true } }).then((x) => x.map((y) => ({ kode: y.no })))) },
    { kunci: "JP2026", kueri: tx.jurnal.findMany({ where: { no: { startsWith: "JP-2026-" } }, select: { no: true } }).then((x) => x.map((y) => ({ kode: y.no }))) },
    { kunci: "INV2026", kueri: tx.investasiKas.findMany({ where: { no: { startsWith: "INV-2026-" } }, select: { no: true } }).then((x) => x.map((y) => ({ kode: y.no }))) },
    { kunci: "FEE2026", kueri: tx.laporanFee.findMany({ where: { no: { startsWith: "FEE-2026-" } }, select: { no: true } }).then((x) => x.map((y) => ({ kode: y.no }))) },
    { kunci: "EVT2026", kueri: tx.event.findMany({ where: { kode: { startsWith: "EVT-2026-" } }, select: { kode: true } }) },
    { kunci: "PAY2026", kueri: tx.penggajian.findMany({ where: { no: { startsWith: "PAY-2026-" } }, select: { no: true } }).then((x) => x.map((y) => ({ kode: y.no }))) },
    { kunci: "SET", kueri: tx.settingGaji.findMany({ select: { kode: true } }) },
    { kunci: "NOM", kueri: tx.versiNominal.findMany({ select: { kode: true } }) },
  ];
  const nilai = new Map((await tx.penghitung.findMany()).map((p) => [p.kunci, p.nilai]));
  const hasil: string[] = [];
  for (const x of daftar) {
    const maks = Math.max(0, ...(await x.kueri).map((y) => Number(y.kode.split("-").at(-1))));
    const h = nilai.get(x.kunci) ?? 0;
    if (h < maks) throw new GalatAksi(`Dibatalkan: penghitung ${x.kunci} (${h}) tertinggal dari nomor terbesar yang ada (${maks}).`);
    hasil.push(`${x.kunci} ${h}`);
  }
  return hasil;
}

async function prasyarat(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(7410779)`;
  const penanda = await tx.logAktivitas.count({ where: { aksi: PENANDA } });
  const presensiDes = await tx.presensi.count({ where: { tanggal: { gte: keDate(`${DES}-01`), lte: keDate(hariTerakhir(DES)) } } });
  const slipDes = await tx.slipGaji.count({ where: { periodeId: DES } });
  const hadirDes = await tx.kehadiranEvent.count({ where: { sesi: { eventKode: { in: ["EVT-2026-0011", "EVT-2026-0012"] } } } });
  if (penanda || presensiDes || slipDes || hadirDes) {
    throw new GalatAksi(`Dibatalkan: data dummy Desember sudah pernah ditambahkan atau Desember sudah diisi (penanda log ${penanda}, presensi ${presensiDes}, slip ${slipDes}, kehadiran event ${hadirDes}).`);
  }
  const pakai = async (peran: "ADMIN" | "HRD" | "OWNER") => (await tx.pengguna.findFirst({ where: { peran, aktif: true }, orderBy: { id: "asc" }, select: { id: true } }))?.id;
  const [admin, hrd, owner] = [await pakai("ADMIN"), await pakai("HRD"), await pakai("OWNER")];
  if (!admin || !hrd || !owner) throw new GalatAksi("Dibatalkan: butuh pengguna Admin, HRD, dan Owner yang aktif.");
  const ditolak = await tx.jurnal.findUnique({ where: { no: JURNAL_DITOLAK }, select: { status: true, sumberTipe: true, sumberId: true } });
  if (!ditolak || ditolak.status !== "DITOLAK" || ditolak.sumberTipe !== "PENYUSUTAN" || ditolak.sumberId !== NOV) {
    throw new GalatAksi(`Dibatalkan: ${JURNAL_DITOLAK} harus jurnal penyusutan November 2026 yang ditolak Owner.`);
  }
  const ev = await tx.event.findMany({ where: { kode: { in: ["EVT-2026-0011", "EVT-2026-0012"] } }, select: { kode: true, status: true } });
  if (ev.length !== 2 || ev.some((e) => e.status !== "PENILAIAN")) throw new GalatAksi("Dibatalkan: EVT-2026-0011 dan EVT-2026-0012 harus ada dan masih tahap penilaian.");
  const versi = await tx.versiNominal.count();
  if (!versi) throw new GalatAksi("Dibatalkan: tabel versi_nominal kosong. Jalankan migrasi 20261124090000_nominal_riwayat dulu.");
  const promosiAda = await tx.settingGaji.count({ where: { karyawanKode: PROMOSI.karyawanKode, berlakuMulai: DES, status: { in: ["DIAJUKAN", "DISETUJUI"] } } });
  const nominalAda = await tx.versiNominal.count({ where: { tunjanganKode: NOMINAL.itemKode, berlakuMulai: DES, status: { in: ["DIAJUKAN", "DISETUJUI"] } } });
  if (promosiAda || nominalAda) throw new GalatAksi("Dibatalkan: sudah ada setting gaji KRY-17 atau nominal TNJ-02 berlaku Desember 2026.");
  for (const p of ["2026-11", "2026-12"]) await pastikanTerbuka(tx, p);
  await cekPenghitung(tx);
  return { admin, hrd, owner };
}

/** Periksa sebelum commit: neraca saldo seimbang dan saldo kas tidak pernah negatif (urut tanggal, lalu nomor jurnal). */
async function periksaAkhir(tx: Tx) {
  const jurnal = await muatJurnalBuku(tx);
  const kodeAkun = (await tx.akun.findMany({ select: { kode: true } })).map((a) => a.kode);
  const neraca = neracaSaldo(jurnal, kodeAkun, null);
  if (!neraca.seimbang) throw new GalatAksi(`Neraca saldo tidak seimbang: debit ${neraca.debit}, kredit ${neraca.kredit}.`);
  const lajur = { nov: neracaLajur(jurnal, kodeAkun, NOV), des: neracaLajur(jurnal, kodeAkun, DES) };
  if (!lajur.nov.seimbang || !lajur.des.seimbang) throw new GalatAksi("Neraca lajur November atau Desember tidak seimbang.");
  let kas = 0;
  let terendah = { saldo: Infinity, no: "", tanggal: "" };
  for (const j of [...jurnal].sort((a, b) => (a.tanggal + a.no).localeCompare(b.tanggal + b.no))) {
    for (const b of j.baris) if (b.akun === AKUN.KAS) kas += b.debit - b.kredit;
    if (kas < terendah.saldo) terendah = { saldo: kas, no: j.no, tanggal: j.tanggal };
  }
  if (terendah.saldo < 0) throw new GalatAksi(`Saldo kas negatif ${terendah.saldo} sesudah ${terendah.no} (${terendah.tanggal}).`);
  if (kas !== (await saldoAkun(tx, AKUN.KAS))) throw new GalatAksi("Saldo kas hasil hitung berbeda dengan saldoAkun.");
  return { neraca, lajur, kasAkhir: kas, terendah, penghitung: await cekPenghitung(tx) };
}

/** Ringkasan dibaca berurutan (satu koneksi transaksi), jadi mode coba menampilkan angka yang sama dengan jalan sungguhan. */
async function ringkasan(tx: Tx, k: Konteks) {
  const bacaan = [
    () => tx.slipGaji.findMany({ where: { periodeId: DES }, orderBy: { karyawanKode: "asc" }, select: { no: true, status: true, bruto: true, pph21: true, thp: true, alpa: true, settingKode: true, versiGajiPokokKode: true, tunjangan: { select: { tunjanganKode: true, nominal: true, versiKode: true } }, karyawan: { select: { nama: true } } } }),
    () => tx.jurnal.findMany({ where: { no: { in: k.jurnalBaru } }, orderBy: { no: "asc" }, include: { detail: { select: { debit: true } } } }),
    () => tx.investasiKas.findMany({ where: { no: { in: k.hasil.setoran } }, orderBy: { no: "asc" }, select: { no: true, tanggal: true, jumlah: true, status: true, jurnalNo: true } }),
    () => k.hasil.laporan ? tx.laporanFee.findUnique({ where: { no: k.hasil.laporan }, select: { no: true, status: true, totalUsulan: true } }) : null,
    () => tx.event.findMany({ where: { kode: { in: k.hasil.event } }, orderBy: { kode: "asc" }, select: { kode: true, nama: true, status: true, sesi: { select: { kehadiran: { select: { penilaian: true } } } } } }),
    () => tx.presensi.groupBy({ by: ["absensi"], where: { tanggal: { gte: keDate(`${DES}-01`), lte: keDate(hariTerakhir(DES)) } }, _count: true, orderBy: { absensi: "asc" } }),
    () => tx.versiNominal.findUnique({ where: { kode: k.hasil.nominal ?? "" }, select: { kode: true, nominal: true, berlakuMulai: true, status: true } }),
  ] as const;
  const slip = await bacaan[0]();
  const jurnal = await bacaan[1]();
  const setoran = await bacaan[2]();
  const laporan = await bacaan[3]();
  const event = await bacaan[4]();
  const presensi = await bacaan[5]();
  const nominal = await bacaan[6]();
  return { slip, jurnal, setoran, laporan, event, presensi, nominal };
}

async function main() {
  const hasil = await db.$transaction(
    async (tx) => {
      const p = await prasyarat(tx);
      const k: Konteks = { ...p, jurnalBaru: [], catatan: [], hasil: { setoran: [], presensi: 0, slip: [], event: [] } };
      await catatLog(tx, k.owner, PENANDA, "data-dummy", null, "Data dummy sampai Desember 2026 (prisma/tambah-dummy-desember.ts)");

      // 1. Penyusutan November diproses ulang (jurnal sebelumnya ditolak Owner).
      await prosesUlangPenyusutan(tx, k, NOV);
      // 2. Setoran modal Desember (satu disetujui, satu menunggu Owner).
      for (const s of SETORAN) await setoranModal(tx, k, s);
      // 3. Contoh riwayat yang berlaku Desember: promosi dan kenaikan nominal tunjangan Makan.
      await promosi(tx, k);
      await kenaikanNominal(tx, k);
      // 4. Presensi Desember semua karyawan inhouse aktif.
      const inhouse = await tx.karyawan.findMany({ where: { jenis: "INHOUSE", aktif: true }, orderBy: { kode: "asc" }, select: { kode: true } });
      for (const x of inhouse) {
        if (!(await versiBerlakuPeriode(tx, DES, x.kode)).length) {
          k.catatan.push(`${x.kode} belum punya setting gaji berlaku Desember, presensinya dilewati.`);
          continue;
        }
        await presensiSebulan(tx, k, x.kode);
      }
      // 5. Hitung gaji Desember (slip draf, belum diajukan).
      await hitungGaji(tx, k, DES);
      // 6. Fee event Desember.
      await isiEvent(tx, k, "EVT-2026-0011", HADIR_0011, "KRY-21", { nilaiKapten: true });
      await kirimLaporan(tx, k, "EVT-2026-0011", "KRY-21", "Acara lancar walau hujan sore. Satu stage crew pulang lebih awal di Hari H, sudah dinilai kurang.");
      await isiEvent(tx, k, "EVT-2026-0012", HADIR_0012, "KRY-06", { nilaiKapten: false });

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
  console.log(COBA ? "MODE COBA: semua langkah berhasil lalu DIBATALKAN, tidak ada yang tersimpan.\n" : "Data dummy Desember tersimpan.\n");
  const s = k.hasil.penyusutan;
  console.log(s ? `Penyusutan November diproses ulang: ${s.jurnal} (${s.aset} aset, beban ${rp(s.beban)}), diajukan Admin, disetujui Owner.` : "Penyusutan November: dilewati.");
  for (const x of d.setoran) console.log(`Investasi Kas ${x.no}  ${labelTanggal(dariDate(x.tanggal))}  ${rp(x.jumlah)}  ${x.status}${x.jurnalNo ? `, jurnal ${x.jurnalNo}` : ""}`);
  console.log(`Promosi berlaku Desember: ${k.hasil.setting} (KRY-17), disetujui Owner.`);
  if (d.nominal) console.log(`Nominal berlaku Desember: ${d.nominal.kode} tunjangan Makan ${rp(d.nominal.nominal)}, ${d.nominal.status}.`);
  console.log(`Presensi Desember: ${k.hasil.presensi} baris (${d.presensi.map((x) => `${x.absensi} ${x._count}`).join(", ")}).`);
  console.log(`Slip gaji Desember (${d.slip.length}, semua ${[...new Set(d.slip.map((x) => x.status))].join("/")}):`);
  for (const x of d.slip) {
    const makan = x.tunjangan.find((t) => t.tunjanganKode === "TNJ-02");
    console.log(`  ${x.no}  ${x.karyawan.nama.padEnd(24)} bruto ${rp(x.bruto).padStart(13)}  PPh ${rp(x.pph21).padStart(10)}  THP ${rp(x.thp).padStart(13)}  setting ${x.settingKode}${x.alpa ? `, alpa ${x.alpa}` : ""}${makan ? `, makan ${rp(makan.nominal)} (${makan.versiKode})` : ""}`);
  }
  console.log(`  total THP ${rp(d.slip.reduce((a, x) => a + x.thp, 0))}`);
  for (const e of d.event) {
    const semua = e.sesi.flatMap((x) => x.kehadiran);
    console.log(`Event ${e.kode} ${e.status}: ${semua.length} kehadiran, ${semua.filter((x) => x.penilaian).length} dinilai (${semua.filter((x) => x.penilaian === "KURANG").length} kurang).`);
  }
  if (d.laporan) console.log(`Laporan fee ${d.laporan.no}: ${d.laporan.status}, usulan ${rp(d.laporan.totalUsulan)}.`);
  console.log(`Jurnal baru (${d.jurnal.length}):`);
  for (const j of d.jurnal) console.log(`  ${j.no}  ${labelTanggal(dariDate(j.tanggal)).padEnd(17)} ${j.jenis.padEnd(11)} ${j.status.padEnd(9)} ${rp(j.detail.reduce((a, x) => a + x.debit, 0)).padStart(14)}  ${j.keterangan}`);
  const n = periksa.neraca;
  console.log(`Neraca saldo semua periode: debit ${rp(n.debit)}, kredit ${rp(n.kredit)}, ${n.seimbang ? "SEIMBANG" : "TIDAK SEIMBANG"}.`);
  console.log(`Neraca lajur November dan Desember seimbang. Saldo kas akhir ${rp(periksa.kasAkhir)}, terendah ${rp(periksa.terendah.saldo)} sesudah ${periksa.terendah.no} (${labelTanggal(periksa.terendah.tanggal)}).`);
  console.log(`Penghitung cocok: ${periksa.penghitung.join(", ")}.`);
  for (const c of k.catatan) console.log(`Catatan: ${c}`);
  console.log("\nBaru bisa dicoba lewat UI mulai 1 Desember 2026 (periode Desember sudah berjalan):");
  console.log("  - Proses Penyusutan Desember (Admin), ajukan, lalu Owner setujui.");
  console.log("  - Input Nilai Sisa Perlengkapan Desember (Admin), ajukan, lalu Owner setujui.");
  console.log("Bisa dicoba sekarang: Distribusi Gaji Desember (HRD ajukan, Owner setujui), keputusan fee EVT-2026-0011, penilaian sisa EVT-2026-0012, setoran INV menunggu Owner, posting pembelian draf Desember.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
