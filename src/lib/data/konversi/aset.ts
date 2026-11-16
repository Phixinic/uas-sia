/*
 * Kueri baca Kartu Aset dan Pelepasan Peralatan.
 */
import { db } from "@/lib/server/db";
import { dariDate } from "@/lib/inti/tanggal";
import type { StatusAset } from "@/generated/prisma/enums";
import { akumulasiDisetujui, jadwalMenunggu } from "./hitung";

const sisipanJadwal = {
  jadwal: { orderBy: { periodeKe: "asc" as const }, select: { periodeKe: true, periodeId: true, beban: true, akumulasi: true, nilaiBuku: true, jurnalNo: true, jurnal: { select: { status: true } } } },
};

function ringkas<T extends { nilaiPerolehan: number; jadwal: { periodeKe: number; periodeId: string; beban: number; jurnalNo: string | null; jurnal: { status: string } | null }[] }>(a: T) {
  const jadwal = a.jadwal.map((r) => ({ periodeKe: r.periodeKe, periode: r.periodeId, beban: r.beban, jurnalNo: r.jurnalNo, statusJurnal: r.jurnal?.status ?? null }));
  const akumulasi = akumulasiDisetujui(jadwal);
  return { akumulasi, nilaiBuku: a.nilaiPerolehan - akumulasi, menunggu: jadwalMenunggu(jadwal) };
}

export async function daftarAset(status: StatusAset | "SEMUA") {
  const daftar = await db.aset.findMany({ where: status === "SEMUA" ? {} : { status }, orderBy: { kode: "asc" }, include: sisipanJadwal });
  return daftar.map((a) => ({
    kode: a.kode,
    nama: a.nama,
    pembelianNo: a.pembelianNo,
    tglPerolehan: dariDate(a.tglPerolehan),
    nilaiPerolehan: a.nilaiPerolehan,
    residu: a.residu,
    n: a.n,
    d: a.d,
    terakhir: a.terakhir,
    dasarN: a.dasarN,
    status: a.status,
    ...(() => {
      const r = ringkas(a);
      return { akumulasi: r.akumulasi, nilaiBuku: r.nilaiBuku };
    })(),
  }));
}
export type RingkasAset = Awaited<ReturnType<typeof daftarAset>>[number];

export async function hitungPerStatus() {
  const g = await db.aset.groupBy({ by: ["status"], _count: { _all: true } });
  const peta = { AKTIF: 0, DILEPAS: 0, BATAL: 0 } as Record<StatusAset, number>;
  for (const x of g) peta[x.status] = x._count._all;
  return peta;
}

export async function ambilAset(kode: string) {
  const a = await db.aset.findUnique({ where: { kode }, include: sisipanJadwal });
  if (!a) return null;
  const r = ringkas(a);
  return {
    kode: a.kode,
    nama: a.nama,
    pembelianNo: a.pembelianNo,
    tglPerolehan: dariDate(a.tglPerolehan),
    tanggalLepas: dariDate(a.tanggalLepas),
    garansiBulan: a.garansiBulan,
    garansiSampai: dariDate(a.garansiSampai),
    masaManfaatBulan: a.masaManfaatBulan,
    nilaiPerolehan: a.nilaiPerolehan,
    residu: a.residu,
    dasarN: a.dasarN,
    n: a.n,
    d: a.d,
    terakhir: a.terakhir,
    pengaman: a.pengaman,
    status: a.status,
    akumulasi: r.akumulasi,
    nilaiBuku: r.nilaiBuku,
    jadwal: a.jadwal.map((x) => ({ periodeKe: x.periodeKe, periode: x.periodeId, beban: x.beban, akumulasi: x.akumulasi, nilaiBuku: x.nilaiBuku, jurnalNo: x.jurnalNo, statusJurnal: x.jurnal?.status ?? null })),
  };
}

/** Bahan halaman pelepasan: aset aktif beserta akumulasi yang sudah disetujui, dan daftar pengajuan. */
export async function dataPelepasan() {
  const [aktif, daftar] = await Promise.all([
    db.aset.findMany({ where: { status: "AKTIF" }, orderBy: { kode: "asc" }, include: sisipanJadwal }),
    db.pelepasan.findMany({ orderBy: [{ dibuatPada: "desc" }, { no: "desc" }], include: { aset: { select: { nama: true, akunAsetKode: true, akunAkumulasiKode: true } }, dibuatOleh: { select: { nama: true } }, disetujuiOleh: { select: { nama: true } }, jurnal: { select: { no: true, detail: { orderBy: { noUrut: "asc" }, select: { akunKode: true, debit: true, kredit: true } } } } } }),
  ]);
  const diajukan = new Set(daftar.filter((p) => p.status === "DIAJUKAN").map((p) => p.asetKode));
  return {
    aset: aktif.map((a) => {
      const r = ringkas(a);
      return {
        kode: a.kode,
        nama: a.nama,
        tglPerolehan: dariDate(a.tglPerolehan),
        nilaiPerolehan: a.nilaiPerolehan,
        akumulasi: r.akumulasi,
        jadwal: a.jadwal.map((x) => ({ periodeKe: x.periodeKe, periode: x.periodeId, beban: x.beban, jurnalNo: x.jurnalNo, statusJurnal: x.jurnal?.status ?? null })),
        sudahDiajukan: diajukan.has(a.kode),
        akunAset: a.akunAsetKode,
        akunAkumulasi: a.akunAkumulasiKode,
      };
    }),
    pelepasan: daftar.map((p) => ({
      no: p.no,
      asetKode: p.asetKode,
      nama: p.aset.nama,
      akunAset: p.aset.akunAsetKode,
      akunAkumulasi: p.aset.akunAkumulasiKode,
      tanggal: dariDate(p.tanggal),
      alasan: p.alasan,
      hargaJual: p.hargaJual,
      nilaiPerolehan: p.nilaiPerolehan,
      akumulasi: p.akumulasi,
      nilaiBuku: p.nilaiBuku,
      labaRugi: p.labaRugi,
      status: p.status,
      alasanTolak: p.alasanTolak,
      jurnalNo: p.jurnal?.no ?? null,
      jurnalBaris: p.jurnal?.detail.map((d) => ({ akun: d.akunKode, debit: d.debit, kredit: d.kredit })) ?? null,
      dibuatOleh: p.dibuatOleh.nama,
      disetujuiOleh: p.disetujuiOleh?.nama ?? null,
    })),
  };
}
export type DataPelepasan = Awaited<ReturnType<typeof dataPelepasan>>;
