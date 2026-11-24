/*
 * Logika siklus SDM: rekap presensi, PPh 21 metode disetahunkan, dan hitung gaji.
 * Sama dengan versi-statis/assets/js/core/penggajian.js. PPh 21 ini simulasi untuk tugas (belum tarif efektif/TER).
 */
import { keMenit } from "./tanggal";

export type KodePtkp = "TK0" | "TK1" | "TK2" | "TK3" | "K0" | "K1" | "K2" | "K3";
export type JenisAbsensi = "HADIR" | "IZIN" | "SAKIT" | "CUTI" | "ALPA";

export const PTKP: Record<KodePtkp, number> = {
  TK0: 54_000_000, TK1: 58_500_000, TK2: 63_000_000, TK3: 67_500_000,
  K0: 58_500_000, K1: 63_000_000, K2: 67_500_000, K3: 72_000_000,
};

/** Label tampilan: "TK0" -> "TK/0". */
export const labelPtkp = (k: KodePtkp | string) => String(k).replace(/^(TK|K)(\d)$/, "$1/$2");

/** Jam istirahat yang tidak dihitung sebagai jam kerja. */
export const JAM_ISTIRAHAT = 1;
export const HARI_KERJA_BAWAAN = 22;

/** Lapisan tarif progresif PPh 21 (UU HPP): batas lapisan dan tarifnya. */
const LAPISAN: [number, number][] = [[60e6, 0.05], [190e6, 0.15], [250e6, 0.25], [4500e6, 0.3], [Infinity, 0.35]];

export type RincianPph = {
  brutoSetahun: number;
  biayaJabatan: number;
  netoSetahun: number;
  ptkp: number;
  pkp: number;
  pphSetahun: number;
  pph21: number;
};

export function hitungPph21(bruto: number, status: KodePtkp): RincianPph {
  const brutoSetahun = bruto * 12;
  const biayaJabatan = Math.min(Math.round(brutoSetahun * 0.05), 6_000_000);
  const netoSetahun = brutoSetahun - biayaJabatan;
  const ptkp = PTKP[status] ?? PTKP.TK0;
  const pkp = Math.max(0, Math.floor((netoSetahun - ptkp) / 1000) * 1000);
  let sisa = pkp;
  let pajak = 0;
  for (const [batas, tarif] of LAPISAN) {
    const kena = Math.min(sisa, batas);
    pajak += kena * tarif;
    sisa -= kena;
    if (sisa <= 0) break;
  }
  return { brutoSetahun, biayaJabatan, netoSetahun, ptkp, pkp, pphSetahun: Math.round(pajak), pph21: Math.round(pajak / 12) };
}

export type PresensiRingkas = {
  absensi: JenisAbsensi;
  jamMasuk?: string | null;
  jamKeluar?: string | null;
  /** Menit terlambat. */
  terlambat?: number | null;
};

/** Jam kerja satu hari: hanya untuk Hadir dengan jam masuk dan keluar, dikurangi istirahat. */
export function jamKerjaHarian(p: PresensiRingkas): number {
  if (p.absensi !== "HADIR" || !p.jamMasuk || !p.jamKeluar) return 0;
  return Math.max(0, (keMenit(p.jamKeluar) - keMenit(p.jamMasuk)) / 60 - JAM_ISTIRAHAT);
}

/** Menit terlambat dibanding jam masuk jadwal (0 bila tidak Hadir atau datang lebih awal). */
export function hitungTerlambat(absensi: JenisAbsensi, jamMasuk: string | null | undefined, jamMasukJadwal: string): number {
  if (absensi !== "HADIR" || !jamMasuk) return 0;
  return Math.max(0, keMenit(jamMasuk) - keMenit(jamMasukJadwal));
}

export type RekapPresensi = {
  jumlah: number;
  hadir: number;
  izin: number;
  sakit: number;
  cuti: number;
  alpa: number;
  terlambatKali: number;
  terlambatMenit: number;
  /** Jam kerja, dibulatkan 2 desimal. */
  jamKerja: number;
};

/** Rekap presensi satu karyawan dalam satu periode (daftar sudah difilter pemanggil). */
export function rekapPresensi(daftar: PresensiRingkas[]): RekapPresensi {
  const hitung = (s: JenisAbsensi) => daftar.filter((p) => p.absensi === s).length;
  return {
    jumlah: daftar.length,
    hadir: hitung("HADIR"),
    izin: hitung("IZIN"),
    sakit: hitung("SAKIT"),
    cuti: hitung("CUTI"),
    alpa: hitung("ALPA"),
    terlambatKali: daftar.filter((p) => (p.terlambat ?? 0) > 0).length,
    terlambatMenit: daftar.reduce((s, p) => s + (p.terlambat ?? 0), 0),
    jamKerja: Math.round(daftar.reduce((s, p) => s + jamKerjaHarian(p), 0) * 100) / 100,
  };
}

export type InputGaji = {
  statusPtkp: KodePtkp;
  jabatan: { kode: string; tunjJabatan: number; tunjKeluarga: number; akunBebanKode: string };
  golongan: { kode: string; jumlah: number };
  /** Jadwal kerja jabatan (kode = kode jabatan); null = memakai 22 hari kerja. */
  jadwal: { kode: string; hariKerja: number } | null;
  /** Tunjangan lain yang aktif di setting gaji karyawan. */
  tunjangan: { kode: string; nama: string; nominal: number }[];
  /** Presensi karyawan pada periode itu. */
  presensi: PresensiRingkas[];
};

export type HasilGaji = RincianPph & {
  jabatanKode: string;
  golonganKode: string;
  jadwalKode: string | null;
  akunBebanKode: string;
  statusPtkp: KodePtkp;
  hariKerja: number;
  rekap: RekapPresensi;
  gajiPokok: number;
  tunjJabatan: number;
  tunjKeluarga: number;
  tunjLain: { kode: string; nama: string; nominal: number }[];
  totalTunjLain: number;
  potonganAbsen: number;
  bruto: number;
  thp: number;
};

/**
 * Potongan absen = gaji pokok / hari kerja x jumlah alpa (dibulatkan).
 * Bruto = gaji pokok + tunjangan jabatan + tunjangan keluarga (status K) + tunjangan lain - potongan absen.
 * THP = bruto - PPh 21.
 */
export function hitungGaji(input: InputGaji): HasilGaji {
  const hariKerja = input.jadwal ? Number(input.jadwal.hariKerja) || HARI_KERJA_BAWAAN : HARI_KERJA_BAWAAN;
  const rekap = rekapPresensi(input.presensi);
  const tunjLain = input.tunjangan.map((t) => ({ kode: t.kode, nama: t.nama, nominal: Number(t.nominal) || 0 }));
  const totalTunjLain = tunjLain.reduce((s, t) => s + t.nominal, 0);
  const tunjJabatan = Number(input.jabatan.tunjJabatan) || 0;
  const tunjKeluarga = input.statusPtkp.startsWith("K") ? Number(input.jabatan.tunjKeluarga) || 0 : 0;
  const gajiPokok = input.golongan.jumlah;
  const potonganAbsen = Math.round((gajiPokok / hariKerja) * rekap.alpa);
  const bruto = gajiPokok + tunjJabatan + tunjKeluarga + totalTunjLain - potonganAbsen;
  const pph = hitungPph21(bruto, input.statusPtkp);
  return {
    jabatanKode: input.jabatan.kode,
    golonganKode: input.golongan.kode,
    jadwalKode: input.jadwal?.kode ?? null,
    akunBebanKode: input.jabatan.akunBebanKode,
    statusPtkp: input.statusPtkp,
    hariKerja,
    rekap,
    gajiPokok,
    tunjJabatan,
    tunjKeluarga,
    tunjLain,
    totalTunjLain,
    potonganAbsen,
    bruto,
    ...pph,
    thp: bruto - pph.pph21,
  };
}
