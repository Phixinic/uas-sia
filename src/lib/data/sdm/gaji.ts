/*
 * Kueri baca siklus gaji: bahan hitung gaji (dipakai halaman dan server action supaya angkanya sama),
 * daftar slip, dan bentuk seragam DataSlip untuk tampilan rincian dan cetak.
 * Rumus ada di src/lib/inti/penggajian.ts; berkas ini hanya menyusun masukannya dari database.
 */
import { db, type DbAtauTx } from "@/lib/server/db";
import { keDate, hariTerakhir, labelPeriode } from "@/lib/inti/tanggal";
import { hitungGaji, type HasilGaji, type InputGaji, type KodePtkp } from "@/lib/inti/penggajian";
import { LABEL_JENIS_PERUBAHAN, pilihVersiBerlaku } from "@/lib/inti/setting-gaji";
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
  /** Versi setting gaji yang berlaku di periode ini (disimpan di slip). */
  settingKode: string;
  nama: string;
  bank: string;
  noRek: string;
  jabatan: string;
  golongan: string;
  jumlahPresensi: number;
  input: InputGaji;
};

const sertaiVersi = {
  karyawan: true,
  jabatan: { include: { jadwalKerja: true } },
  golongan: true,
  tunjangan: { include: { tunjangan: true } },
} as const;

/**
 * Versi setting gaji yang berlaku di periode untuk tiap karyawan (DISETUJUI, berlaku mulai <= periode, paling akhir;
 * lihat pilihVersiBerlaku). Karyawan tanpa versi berlaku tidak ada di hasil.
 */
export async function versiBerlakuPeriode(klien: DbAtauTx, periode: string, karyawanKode?: string) {
  const semua = await klien.settingGaji.findMany({
    where: { status: "DISETUJUI", berlakuMulai: { lte: periode }, ...(karyawanKode ? { karyawanKode } : {}) },
    orderBy: { karyawanKode: "asc" },
    include: sertaiVersi,
  });
  const perKaryawan = new Map<string, typeof semua>();
  for (const v of semua) perKaryawan.set(v.karyawanKode, [...(perKaryawan.get(v.karyawanKode) ?? []), v]);
  const hasil: typeof semua = [];
  for (const daftar of perKaryawan.values()) {
    const v = pilihVersiBerlaku(daftar, periode);
    if (v) hasil.push(v);
  }
  return hasil.sort((a, b) => a.karyawanKode.localeCompare(b.karyawanKode));
}

/**
 * Karyawan inhouse aktif yang punya setting gaji berlaku di periode ini, beserta masukan rumusnya.
 * Crew event dibayar lewat fee event. Versi setting dipilih per periode, jadi slip bulan lama tetap memakai gaji lama
 * walau promosi berlaku sesudahnya sudah disetujui.
 */
export async function muatBahanGaji(klien: DbAtauTx, periode: string, karyawanKode?: string): Promise<BahanGaji[]> {
  const setting = (await versiBerlakuPeriode(klien, periode, karyawanKode)).filter(
    (s) => s.karyawan.aktif && s.karyawan.jenis === "INHOUSE" && s.jabatan.kelompok === "INHOUSE",
  );
  const presensi = await klien.presensi.findMany({
    where: { karyawanKode: { in: setting.map((s) => s.karyawanKode) }, tanggal: { gte: keDate(`${periode}-01`), lte: keDate(hariTerakhir(periode)) } },
    select: { karyawanKode: true, absensi: true, jamMasuk: true, jamKeluar: true, terlambat: true },
  });
  return setting.map((s) => {
    const milik = presensi.filter((p) => p.karyawanKode === s.karyawanKode);
    const jadwal = s.jabatan.jadwalKerja;
    return {
      karyawanKode: s.karyawanKode,
      settingKode: s.kode,
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
  /** Slip draf dihitung dengan versi setting gaji lain dari versi yang sekarang berlaku di periode ini. */
  settingBerubah: boolean;
  /**
   * Versi setting yang dipakai baris ini: versi tersimpan di slip bila slip sudah diajukan atau dibayar (angkanya terkunci),
   * selain itu versi yang berlaku di periode ini. kode null = slip lama sebelum riwayat setting (versinya tidak tercatat).
   */
  versi: { kode: string | null; jabatan: string; golongan: string; berlakuMulai: string | null };
  /** Versi lebih baru yang belum berlaku di periode ini, atau pengajuan yang masih menunggu Owner. */
  catatanVersi: string | null;
};

const versiRingkasSemua = () =>
  db.settingGaji.findMany({
    where: { status: { in: ["DISETUJUI", "DIAJUKAN"] } },
    orderBy: { berlakuMulai: "asc" },
    select: { kode: true, karyawanKode: true, status: true, berlakuMulai: true, jenisPerubahan: true, jabatan: { select: { nama: true } }, golongan: { select: { nama: true } } },
  });

export async function barisHitungGaji(periode: string): Promise<BarisGaji[]> {
  const [bahan, slip, semuaVersi] = await Promise.all([
    muatBahanGaji(db, periode),
    db.slipGaji.findMany({ where: { periodeId: periode }, select: { no: true, karyawanKode: true, status: true, bruto: true, pph21: true, thp: true, alasanTolak: true, settingKode: true } }),
    versiRingkasSemua(),
  ]);
  const petaVersi = new Map(semuaVersi.map((v) => [v.kode, v]));
  const lengkap = await daftarSlipPeriode(periode);
  return bahan.map((b) => {
    const hasil = dataSlipDariHasil(b, hitungGaji(b.input), periode);
    const sl = slip.find((x) => x.karyawanKode === b.karyawanKode) ?? null;
    const tersimpan = lengkap.find((x) => x.karyawanKode === b.karyawanKode) ?? null;
    const beku = sl && sl.status !== "DRAFT" && tersimpan;
    const settingBerubah = !!sl && sl.status === "DRAFT" && sl.settingKode !== b.settingKode;
    // Slip terkunci memakai versi yang tersimpan di slip; selain itu versi yang berlaku di periode ini.
    const kodeVersi = beku ? sl.settingKode : b.settingKode;
    const v = kodeVersi ? petaVersi.get(kodeVersi) : undefined;
    const versi = v
      ? { kode: v.kode, jabatan: v.jabatan.nama, golongan: v.golongan.nama, berlakuMulai: v.berlakuMulai }
      : { kode: null, jabatan: (beku ? tersimpan.jabatan : b.jabatan), golongan: (beku ? tersimpan.golongan : b.golongan), berlakuMulai: null };
    const nanti = semuaVersi.find((x) => x.karyawanKode === b.karyawanKode && x.status === "DISETUJUI" && x.berlakuMulai > periode);
    const tunggu = semuaVersi.find((x) => x.karyawanKode === b.karyawanKode && x.status === "DIAJUKAN");
    const catatanVersi = nanti
      ? `Versi lebih baru ${nanti.kode} (${LABEL_JENIS_PERUBAHAN[nanti.jenisPerubahan].toLowerCase()}: ${nanti.jabatan.nama}, ${nanti.golongan.nama}) baru berlaku ${labelPeriode(nanti.berlakuMulai)}`
      : tunggu
        ? `Pengajuan ${tunggu.kode} berlaku ${labelPeriode(tunggu.berlakuMulai)} menunggu Owner`
        : null;
    return {
      karyawanKode: b.karyawanKode,
      nama: b.nama,
      jabatan: b.jabatan,
      jumlahPresensi: b.jumlahPresensi,
      tampil: beku ? tersimpan : hasil,
      slipNo: sl?.no ?? null,
      slipStatus: sl?.status ?? null,
      alasanTolak: sl?.alasanTolak ?? null,
      perluHitungUlang: !!sl && sl.status === "DRAFT" && (settingBerubah || sl.bruto !== hasil.bruto || sl.pph21 !== hasil.pph21 || sl.thp !== hasil.thp),
      settingBerubah,
      versi,
      catatanVersi,
    };
  });
}

/** Kesiapan hitung gaji satu karyawan inhouse untuk satu periode. */
export type KesiapanGaji = {
  karyawanKode: string;
  nama: string;
  jabatan: string | null;
  /** Ada versi setting gaji (komponen tetap) yang berlaku di periode ini. */
  adaSetting: boolean;
  /** Bila belum ada versi berlaku: pengajuan yang menunggu Owner atau versi yang baru berlaku sesudah periode ini. */
  catatanSetting: string | null;
  hariKerja: number | null;
  /** Jumlah hari presensi yang sudah diisi di periode ini. */
  presensi: number;
  slipNo: string | null;
  slipStatus: StatusPersetujuan | null;
  perluHitungUlang: boolean;
  settingBerubah: boolean;
};

/**
 * Semua karyawan inhouse aktif beserta kesiapan gajinya: setting gaji ada atau tidak, presensi sudah diisi berapa hari,
 * slip sudah dihitung atau belum. `baris` = hasil barisHitungGaji periode yang sama (karyawan yang punya setting gaji).
 */
export async function kesiapanGaji(periode: string, baris: BarisGaji[]): Promise<KesiapanGaji[]> {
  const tanpaSetting = await db.karyawan.findMany({
    where: { aktif: true, jenis: "INHOUSE", kode: { notIn: baris.map((b) => b.karyawanKode) } },
    orderBy: { kode: "asc" },
    select: {
      kode: true,
      nama: true,
      _count: { select: { presensi: { where: { tanggal: { gte: keDate(`${periode}-01`), lte: keDate(hariTerakhir(periode)) } } } } },
      settingGaji: { where: { status: { in: ["DIAJUKAN", "DISETUJUI"] } }, orderBy: { berlakuMulai: "asc" }, select: { status: true, berlakuMulai: true } },
    },
  });
  const hasil: KesiapanGaji[] = baris.map((b) => ({
    karyawanKode: b.karyawanKode,
    nama: b.nama,
    jabatan: b.jabatan,
    adaSetting: true,
    catatanSetting: null,
    hariKerja: b.tampil.hariKerja,
    presensi: b.jumlahPresensi,
    slipNo: b.slipNo,
    slipStatus: b.slipStatus,
    perluHitungUlang: b.perluHitungUlang,
    settingBerubah: b.settingBerubah,
  }));
  for (const k of tanpaSetting) {
    const nanti = k.settingGaji.find((v) => v.status === "DISETUJUI" && v.berlakuMulai > periode);
    const tunggu = k.settingGaji.find((v) => v.status === "DIAJUKAN");
    const catatanSetting = nanti
      ? `Setting disetujui, baru berlaku ${labelPeriode(nanti.berlakuMulai)}`
      : tunggu
        ? `Pengajuan berlaku ${labelPeriode(tunggu.berlakuMulai)} menunggu Owner`
        : null;
    hasil.push({ karyawanKode: k.kode, nama: k.nama, jabatan: null, adaSetting: false, catatanSetting, hariKerja: null, presensi: k._count.presensi, slipNo: null, slipStatus: null, perluHitungUlang: false, settingBerubah: false });
  }
  return hasil.sort((a, b) => a.karyawanKode.localeCompare(b.karyawanKode));
}

/** Ringkasan penggajian satu bulan dalam ringkasan tahunan Hitung Gaji dan Distribusi. */
export type RingkasBulanGaji = {
  periode: string;
  /** Jumlah hari presensi yang tercatat (semua karyawan). */
  presensi: number;
  draf: number;
  diajukan: number;
  dibayar: number;
  /** Total THP semua slip bulan itu (draf, diajukan, dan dibayar). */
  thp: number;
  /** Keadaan yang paling perlu ditindaklanjuti: diajukan, slip draf, dibayar, presensi tanpa slip, atau belum ada presensi. */
  status: "DIAJUKAN" | "DRAF" | "DIBAYAR" | "PRESENSI" | "KOSONG";
};

/** Dua belas bulan satu tahun: presensi, slip per status, dan total THP, supaya riwayat penggajian terbaca per tahun. */
export async function ringkasanTahunGaji(tahun: number): Promise<RingkasBulanGaji[]> {
  const awal = `${tahun}-01`;
  const akhir = `${tahun}-12`;
  const [presensi, slip] = await Promise.all([
    db.$queryRaw<{ p: string; n: bigint }[]>`select to_char(tanggal, 'YYYY-MM') as p, count(*)::bigint as n from presensi where tanggal >= ${keDate(`${awal}-01`)} and tanggal <= ${keDate(hariTerakhir(akhir))} group by 1`,
    db.slipGaji.groupBy({ by: ["periodeId", "status"], where: { periodeId: { gte: awal, lte: akhir } }, _count: true, _sum: { thp: true } }),
  ]);
  return Array.from({ length: 12 }, (_, i) => {
    const periode = `${tahun}-${String(i + 1).padStart(2, "0")}`;
    const milik = slip.filter((s) => s.periodeId === periode);
    const n = (st: string) => milik.find((s) => s.status === st)?._count ?? 0;
    const r = {
      periode,
      presensi: Number(presensi.find((x) => x.p === periode)?.n ?? 0),
      draf: n("DRAFT"),
      diajukan: n("DIAJUKAN"),
      dibayar: n("DISETUJUI"),
      thp: milik.reduce((x, s) => x + (s._sum.thp ?? 0), 0),
    };
    const status: RingkasBulanGaji["status"] = r.diajukan ? "DIAJUKAN" : r.draf ? "DRAF" : r.dibayar ? "DIBAYAR" : r.presensi ? "PRESENSI" : "KOSONG";
    return { ...r, status };
  });
}
