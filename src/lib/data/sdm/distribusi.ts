/*
 * Kueri baca halaman Distribusi Gaji. Hanya untuk komponen server.
 */
import { db } from "@/lib/server/db";
import { saldoAkun } from "@/lib/server/jurnal";
import { AKUN } from "@/lib/inti/akun";
import { barisGaji } from "@/lib/inti/jurnal";
import { hariTerakhir } from "@/lib/inti/tanggal";
import type { StatusPersetujuan } from "@/generated/prisma/enums";
import { muatBahanGaji, pilihSidik, sidikBahan, sidikSlip } from "@/lib/data/sdm/gaji";

export type SlipRingkas = {
  no: string;
  karyawanKode: string;
  karyawan: string;
  jabatan: string;
  akunBeban: string;
  bruto: number;
  pph21: number;
  thp: number;
  penggajianNo: string | null;
};

export type PengajuanGaji = {
  no: string;
  jumlahSlip: number;
  totalBruto: number;
  totalPph: number;
  totalThp: number;
  status: StatusPersetujuan;
  alasanTolak: string | null;
  jurnalNo: string | null;
  dibuatOleh: string;
  disetujuiOleh: string | null;
};

export type DataDistribusi = {
  saldoKas: number;
  draf: SlipRingkas[];
  /** Slip draf yang dihitung dengan versi setting atau nominal komponen yang sekarang tidak berlaku (pengajuan ditolak sistem). */
  usang: string[];
  barisJurnalDraf: ReturnType<typeof barisGaji>;
  pengajuan: PengajuanGaji[];
  dibayar: (SlipRingkas & { tanggal: string; jurnalNo: string | null })[];
};

export async function dataDistribusi(periode: string): Promise<DataDistribusi> {
  const [slip, pengajuan, saldoKas] = await Promise.all([
    db.slipGaji.findMany({
      where: { periodeId: periode },
      orderBy: { karyawanKode: "asc" },
      include: { karyawan: { select: { nama: true } }, jabatan: { select: { nama: true } }, penggajian: { select: { jurnalNo: true } }, tunjangan: pilihSidik.tunjangan },
    }),
    db.penggajian.findMany({
      where: { periodeId: periode },
      orderBy: { no: "desc" },
      include: { dibuatOleh: { select: { nama: true } }, disetujuiOleh: { select: { nama: true } } },
    }),
    saldoAkun(db, AKUN.KAS),
  ]);
  const ringkas = (s: (typeof slip)[number]): SlipRingkas => ({
    no: s.no,
    karyawanKode: s.karyawanKode,
    karyawan: s.karyawan.nama,
    jabatan: s.jabatan.nama,
    akunBeban: s.akunBebanKode,
    bruto: s.bruto,
    pph21: s.pph21,
    thp: s.thp,
    penggajianNo: s.penggajianNo,
  });
  const drafDb = slip.filter((s) => s.status === "DRAFT");
  const draf = drafDb.map(ringkas);
  // Aturan sama dengan ajukanPenggajian: slip draf dengan sidik versi lain dari bahan hitung terbaru harus dihitung ulang.
  const bahan = drafDb.length ? new Map((await muatBahanGaji(db, periode)).map((b) => [b.karyawanKode, b])) : new Map();
  const usang = drafDb.filter((s) => {
    const b = bahan.get(s.karyawanKode);
    return s.settingKode === null || !b || sidikSlip(s) !== sidikBahan(b);
  }).map((s) => s.no);
  return {
    saldoKas,
    draf,
    usang,
    barisJurnalDraf: barisGaji(draf.map((s) => ({ akunBeban: s.akunBeban, bruto: s.bruto, pph21: s.pph21, thp: s.thp }))),
    pengajuan: pengajuan.map((g) => ({
      no: g.no,
      jumlahSlip: g.jumlahSlip,
      totalBruto: g.totalBruto,
      totalPph: g.totalPph,
      totalThp: g.totalThp,
      status: g.status,
      alasanTolak: g.alasanTolak,
      jurnalNo: g.jurnalNo,
      dibuatOleh: g.dibuatOleh.nama,
      disetujuiOleh: g.disetujuiOleh?.nama ?? null,
    })),
    dibayar: slip
      .filter((s) => s.status === "DISETUJUI")
      .map((s) => ({ ...ringkas(s), tanggal: hariTerakhir(periode), jurnalNo: s.penggajian?.jurnalNo ?? null })),
  };
}
