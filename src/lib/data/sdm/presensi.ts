/*
 * Kueri baca halaman Presensi. Hanya untuk komponen server; hasilnya objek biasa (tanggal sudah berupa string).
 */
import { db } from "@/lib/server/db";
import { dariDate, keDate, hariTerakhir } from "@/lib/inti/tanggal";
import { jamKerjaHarian, rekapPresensi, type RekapPresensi } from "@/lib/inti/penggajian";
import type { Absensi } from "@/generated/prisma/enums";
import { versiBerlakuPeriode } from "@/lib/data/sdm/gaji";

export type BarisRekap = {
  kode: string;
  nama: string;
  jabatan: string | null;
  hariKerja: number | null;
  rekap: RekapPresensi;
  /** Slip periode ini sudah diajukan atau dibayar, jadi presensinya terkunci. */
  terkunci: boolean;
};

const awalBulan = (periode: string) => keDate(`${periode}-01`);
const akhirBulan = (periode: string) => keDate(hariTerakhir(periode));

/**
 * Karyawan inhouse aktif beserta jabatan dan jadwal kerjanya dari versi setting gaji yang berlaku di periode itu.
 * Crew event tidak memakai presensi bulanan.
 */
async function karyawanAktif(periode: string) {
  const [daftar, versi] = await Promise.all([
    db.karyawan.findMany({ where: { aktif: true, jenis: "INHOUSE" }, orderBy: { kode: "asc" }, select: { kode: true, nama: true } }),
    versiBerlakuPeriode(db, periode),
  ]);
  const peta = new Map(versi.map((v) => [v.karyawanKode, v.jabatan]));
  return daftar.map((k) => ({ ...k, jabatan: peta.get(k.kode) ?? null }));
}

/** Kode karyawan yang slipnya di periode ini bukan DRAFT (presensinya terkunci). */
export async function karyawanTerkunci(periode: string): Promise<Set<string>> {
  const slip = await db.slipGaji.findMany({ where: { periodeId: periode, status: { not: "DRAFT" } }, select: { karyawanKode: true } });
  return new Set(slip.map((s) => s.karyawanKode));
}

export async function rekapBulanan(periode: string): Promise<BarisRekap[]> {
  const [karyawan, presensi, kunci] = await Promise.all([
    karyawanAktif(periode),
    db.presensi.findMany({ where: { tanggal: { gte: awalBulan(periode), lte: akhirBulan(periode) } }, select: { karyawanKode: true, absensi: true, jamMasuk: true, jamKeluar: true, terlambat: true } }),
    karyawanTerkunci(periode),
  ]);
  return karyawan.map((k) => {
    const jabatan = k.jabatan;
    return {
      kode: k.kode,
      nama: k.nama,
      jabatan: jabatan?.nama ?? null,
      hariKerja: jabatan?.hariKerja ?? null,
      rekap: rekapPresensi(presensi.filter((p) => p.karyawanKode === k.kode)),
      terkunci: kunci.has(k.kode),
    };
  });
}

export type BarisHarian = {
  id: number;
  tanggal: string;
  karyawanKode: string;
  karyawan: string;
  absensi: Absensi;
  jamMasuk: string | null;
  jamKeluar: string | null;
  terlambat: number;
  jamKerja: number;
  /** Jabatan yang jadwal kerjanya dipakai menghitung terlambat. */
  jabatanKode: string;
  terkunci: boolean;
};

export async function presensiHarian(periode: string, karyawanKode?: string): Promise<BarisHarian[]> {
  const [daftar, kunci] = await Promise.all([
    db.presensi.findMany({
      where: { tanggal: { gte: awalBulan(periode), lte: akhirBulan(periode) }, ...(karyawanKode ? { karyawanKode } : {}) },
      orderBy: [{ tanggal: "asc" }, { karyawanKode: "asc" }],
      include: { karyawan: { select: { nama: true } } },
    }),
    karyawanTerkunci(periode),
  ]);
  return daftar.map((p) => ({
    id: p.id,
    tanggal: dariDate(p.tanggal),
    karyawanKode: p.karyawanKode,
    karyawan: p.karyawan.nama,
    absensi: p.absensi,
    jamMasuk: p.jamMasuk,
    jamKeluar: p.jamKeluar,
    terlambat: p.terlambat,
    jamKerja: jamKerjaHarian(p),
    jabatanKode: p.jabatanKode,
    terkunci: kunci.has(p.karyawanKode),
  }));
}

/** Pilihan karyawan untuk form dan filter. `siapInput` = punya setting gaji berlaku di periode ini dan jadwal kerja. */
export async function opsiKaryawanPresensi(periode: string) {
  const daftar = await karyawanAktif(periode);
  return daftar.map((k) => ({
    kode: k.kode,
    nama: k.nama,
    siapInput: !!k.jabatan?.jamMasuk,
    jamMasuk: k.jabatan?.jamMasuk ?? "",
    jamKeluar: k.jabatan?.jamKeluar ?? "",
  }));
}

export async function ambilPresensi(id: number) {
  const p = await db.presensi.findUnique({ where: { id } });
  if (!p) return null;
  return {
    id: p.id,
    karyawanKode: p.karyawanKode,
    tanggal: dariDate(p.tanggal),
    absensi: p.absensi,
    jamMasuk: p.jamMasuk ?? "",
    jamKeluar: p.jamKeluar ?? "",
  };
}
