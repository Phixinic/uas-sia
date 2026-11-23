/*
 * Kueri baca siklus gaji: bahan hitung gaji (dipakai halaman dan server action supaya angkanya sama),
 * daftar slip, dan bentuk seragam DataSlip untuk tampilan rincian dan cetak.
 * Rumus ada di src/lib/inti/penggajian.ts; berkas ini hanya menyusun masukannya dari database.
 */
import { db, type DbAtauTx } from "@/lib/server/db";
import { keDate, hariTerakhir } from "@/lib/inti/tanggal";
import { hitungGaji, type HasilGaji, type InputGaji, type KodePtkp } from "@/lib/inti/penggajian";
import type { StatusPersetujuan } from "@/generated/prisma/enums";

/** Bentuk seragam slip untuk tampilan: dari hasil hitung (pratinjau) maupun dari slip tersimpan. */
export type DataSlip = {
  no: string | null;
  periode: string;
  karyawanKode: string;
  karyawan: string;
  bank: string;
  noRek: string;
  jabatan: string;
  golongan: string;
  statusPtkp: string;
  status: StatusPersetujuan | null;
  penggajianNo: string | null;
  alasanTolak: string | null;
  hariKerja: number;
  hadir: number;
  izin: number;
  sakit: number;
  cuti: number;
  alpa: number;
  jamKerja: number;
  terlambatMenit: number;
  gajiPokok: number;
  tunjJabatan: number;
  tunjKeluarga: number;
  tunjLain: { nama: string; nominal: number }[];
  potonganAbsen: number;
  bruto: number;
  brutoSetahun: number;
  biayaJabatan: number;
  netoSetahun: number;
  ptkp: number;
  pkp: number;
  pphSetahun: number;
  pph21: number;
  thp: number;
};

export type BahanGaji = {
  karyawanKode: string;
  nama: string;
  bank: string;
  noRek: string;
  jabatan: string;
  golongan: string;
  jumlahPresensi: number;
  input: InputGaji;
};

/** Karyawan inhouse dengan setting gaji aktif beserta masukan rumusnya untuk satu periode. Crew event dibayar lewat fee event. */
export async function muatBahanGaji(klien: DbAtauTx, periode: string, karyawanKode?: string): Promise<BahanGaji[]> {
  const setting = await klien.settingGaji.findMany({
    where: { aktif: true, karyawan: { aktif: true, jenis: "INHOUSE" }, jabatan: { kelompok: "INHOUSE" }, ...(karyawanKode ? { karyawanKode } : {}) },
    orderBy: { karyawanKode: "asc" },
    include: {
      karyawan: true,
      jabatan: { include: { jadwalKerja: true } },
      golongan: true,
      tunjangan: { include: { tunjangan: true } },
    },
  });
  const presensi = await klien.presensi.findMany({
    where: { karyawanKode: { in: setting.map((s) => s.karyawanKode) }, tanggal: { gte: keDate(`${periode}-01`), lte: keDate(hariTerakhir(periode)) } },
    select: { karyawanKode: true, absensi: true, jamMasuk: true, jamKeluar: true, terlambat: true },
  });
  return setting.map((s) => {
    const milik = presensi.filter((p) => p.karyawanKode === s.karyawanKode);
    const jadwal = s.jabatan.jadwalKerja;
    return {
      karyawanKode: s.karyawanKode,
      nama: s.karyawan.nama,
      bank: s.karyawan.bank,
      noRek: s.karyawan.noRek,
      jabatan: s.jabatan.nama,
      golongan: s.golongan.nama,
      jumlahPresensi: milik.length,
      input: {
        statusPtkp: s.karyawan.statusPtkp as KodePtkp,
        jabatan: { kode: s.jabatan.kode, tunjJabatan: s.jabatan.tunjJabatan, tunjKeluarga: s.jabatan.tunjKeluarga, akunBebanKode: s.jabatan.akunBebanKode },
        golongan: { kode: s.golongan.kode, jumlah: s.golongan.jumlah },
        jadwal: jadwal ? { kode: jadwal.kode, hariKerja: jadwal.hariKerja } : null,
        tunjangan: s.tunjangan.filter((t) => t.tunjangan.aktif).map((t) => ({ kode: t.tunjangan.kode, nama: t.tunjangan.nama, nominal: t.tunjangan.nominal })),
        presensi: milik,
      },
    };
  });
}

export function dataSlipDariHasil(b: BahanGaji, h: HasilGaji, periode: string): DataSlip {
  return {
    no: null,
    periode,
    karyawanKode: b.karyawanKode,
    karyawan: b.nama,
    bank: b.bank,
    noRek: b.noRek,
    jabatan: b.jabatan,
    golongan: b.golongan,
    statusPtkp: h.statusPtkp,
    status: null,
    penggajianNo: null,
    alasanTolak: null,
    hariKerja: h.hariKerja,
    hadir: h.rekap.hadir,
    izin: h.rekap.izin,
    sakit: h.rekap.sakit,
    cuti: h.rekap.cuti,
    alpa: h.rekap.alpa,
    jamKerja: h.rekap.jamKerja,
    terlambatMenit: h.rekap.terlambatMenit,
    gajiPokok: h.gajiPokok,
    tunjJabatan: h.tunjJabatan,
    tunjKeluarga: h.tunjKeluarga,
    tunjLain: h.tunjLain.map((t) => ({ nama: t.nama, nominal: t.nominal })),
    potonganAbsen: h.potonganAbsen,
    bruto: h.bruto,
    brutoSetahun: h.brutoSetahun,
    biayaJabatan: h.biayaJabatan,
    netoSetahun: h.netoSetahun,
    ptkp: h.ptkp,
    pkp: h.pkp,
    pphSetahun: h.pphSetahun,
    pph21: h.pph21,
    thp: h.thp,
  };
}

const sertaiSlip = { karyawan: true, jabatan: true, golongan: true, tunjangan: true } as const;

export async function ambilSlip(no: string): Promise<DataSlip | null> {
  const s = await db.slipGaji.findUnique({ where: { no }, include: sertaiSlip });
  return s ? dataSlipDariDb(s) : null;
}

export async function daftarSlipPeriode(periode: string): Promise<DataSlip[]> {
  const daftar = await db.slipGaji.findMany({ where: { periodeId: periode }, orderBy: { karyawanKode: "asc" }, include: sertaiSlip });
  return daftar.map(dataSlipDariDb);
}

type SlipDb = Awaited<ReturnType<typeof db.slipGaji.findMany<{ include: typeof sertaiSlip }>>>[number];

function dataSlipDariDb(s: SlipDb): DataSlip {
  return {
    no: s.no,
    periode: s.periodeId,
    karyawanKode: s.karyawanKode,
    karyawan: s.karyawan.nama,
    bank: s.karyawan.bank,
    noRek: s.karyawan.noRek,
    jabatan: s.jabatan.nama,
    golongan: s.golongan.nama,
    statusPtkp: s.statusPtkp,
    status: s.status,
    penggajianNo: s.penggajianNo,
    alasanTolak: s.alasanTolak,
    hariKerja: s.hariKerja,
    hadir: s.hadir,
    izin: s.izin,
    sakit: s.sakit,
    cuti: s.cuti,
    alpa: s.alpa,
    jamKerja: s.jamKerja,
    terlambatMenit: s.terlambatMenit,
    gajiPokok: s.gajiPokok,
    tunjJabatan: s.tunjJabatan,
    tunjKeluarga: s.tunjKeluarga,
    tunjLain: s.tunjangan.map((t) => ({ nama: t.nama, nominal: t.nominal })),
    potonganAbsen: s.potonganAbsen,
    bruto: s.bruto,
    brutoSetahun: s.brutoSetahun,
    biayaJabatan: s.biayaJabatan,
    netoSetahun: s.netoSetahun,
    ptkp: s.ptkp,
    pkp: s.pkp,
    pphSetahun: s.pphSetahun,
    pph21: s.pph21,
    thp: s.thp,
  };
}

export type BarisGaji = {
  karyawanKode: string;
  nama: string;
  jabatan: string;
  jumlahPresensi: number;
  /** Rincian yang ditampilkan: slip tersimpan bila sudah diajukan/dibayar, selain itu hasil hitung terbaru. */
  tampil: DataSlip;
  slipNo: string | null;
  slipStatus: StatusPersetujuan | null;
  alasanTolak: string | null;
  /** Slip draf yang angkanya sudah tidak sama dengan hasil hitung terbaru (presensi atau master berubah). */
  perluHitungUlang: boolean;
};

export async function barisHitungGaji(periode: string): Promise<BarisGaji[]> {
  const [bahan, slip] = await Promise.all([muatBahanGaji(db, periode), db.slipGaji.findMany({ where: { periodeId: periode }, select: { no: true, karyawanKode: true, status: true, bruto: true, pph21: true, thp: true, alasanTolak: true } })]);
  const lengkap = await daftarSlipPeriode(periode);
  return bahan.map((b) => {
    const hasil = dataSlipDariHasil(b, hitungGaji(b.input), periode);
    const sl = slip.find((x) => x.karyawanKode === b.karyawanKode) ?? null;
    const tersimpan = lengkap.find((x) => x.karyawanKode === b.karyawanKode) ?? null;
    const beku = sl && sl.status !== "DRAFT" && tersimpan;
    return {
      karyawanKode: b.karyawanKode,
      nama: b.nama,
      jabatan: b.jabatan,
      jumlahPresensi: b.jumlahPresensi,
      tampil: beku ? tersimpan : hasil,
      slipNo: sl?.no ?? null,
      slipStatus: sl?.status ?? null,
      alasanTolak: sl?.alasanTolak ?? null,
      perluHitungUlang: !!sl && sl.status === "DRAFT" && (sl.bruto !== hasil.bruto || sl.pph21 !== hasil.pph21 || sl.thp !== hasil.thp),
    };
  });
}

/** Kesiapan hitung gaji satu karyawan inhouse untuk satu periode. */
export type KesiapanGaji = {
  karyawanKode: string;
  nama: string;
  jabatan: string | null;
  /** Setting gaji aktif (komponen tetap) ada. */
  adaSetting: boolean;
  hariKerja: number | null;
  /** Jumlah hari presensi yang sudah diisi di periode ini. */
  presensi: number;
  slipNo: string | null;
  slipStatus: StatusPersetujuan | null;
  perluHitungUlang: boolean;
};

/**
 * Semua karyawan inhouse aktif beserta kesiapan gajinya: setting gaji ada atau tidak, presensi sudah diisi berapa hari,
 * slip sudah dihitung atau belum. `baris` = hasil barisHitungGaji periode yang sama (karyawan yang punya setting gaji).
 */
export async function kesiapanGaji(periode: string, baris: BarisGaji[]): Promise<KesiapanGaji[]> {
  const tanpaSetting = await db.karyawan.findMany({
    where: { aktif: true, jenis: "INHOUSE", kode: { notIn: baris.map((b) => b.karyawanKode) } },
    orderBy: { kode: "asc" },
    select: { kode: true, nama: true, _count: { select: { presensi: { where: { tanggal: { gte: keDate(`${periode}-01`), lte: keDate(hariTerakhir(periode)) } } } } } },
  });
  const hasil: KesiapanGaji[] = baris.map((b) => ({
    karyawanKode: b.karyawanKode,
    nama: b.nama,
    jabatan: b.jabatan,
    adaSetting: true,
    hariKerja: b.tampil.hariKerja,
    presensi: b.jumlahPresensi,
    slipNo: b.slipNo,
    slipStatus: b.slipStatus,
    perluHitungUlang: b.perluHitungUlang,
  }));
  for (const k of tanpaSetting) {
    hasil.push({ karyawanKode: k.kode, nama: k.nama, jabatan: null, adaSetting: false, hariKerja: null, presensi: k._count.presensi, slipNo: null, slipStatus: null, perluHitungUlang: false });
  }
  return hasil.sort((a, b) => a.karyawanKode.localeCompare(b.karyawanKode));
}
