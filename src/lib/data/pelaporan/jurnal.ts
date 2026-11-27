/*
 * Kueri jurnal untuk halaman Jurnal Penyesuaian, Jurnal Umum, Buku Besar, dan Neraca Saldo.
 * Semua hasil berupa objek biasa (tanggal sudah jadi string) supaya aman dikirim ke komponen klien.
 */
import { db } from "@/lib/server/db";
import { muatJurnalBuku } from "@/lib/server/jurnal";
import { bukuBesarTahap, neracaLajur, neracaSaldo, saringTahap, type Tahap } from "@/lib/inti/buku-besar";
import { dariDate } from "@/lib/inti/tanggal";
import type { BarisJurnal } from "@/lib/inti/jurnal";
import type { Prisma } from "@/generated/prisma/client";
import type { JenisJurnal, StatusPersetujuan, SumberJurnal } from "@/generated/prisma/enums";

export type RincianJurnal = { label: string; info: string; nilai: number };

export type DataJurnal = {
  no: string;
  tanggal: string;
  periode: string;
  jenis: JenisJurnal;
  keterangan: string;
  status: StatusPersetujuan;
  alasanTolak: string | null;
  dibuatOleh: string;
  dibuatOlehId: number;
  diajukanPada: string | null;
  disetujuiOleh: string | null;
  disetujuiPada: string | null;
  pembalikDariNo: string | null;
  sumberTipe: SumberJurnal | null;
  baris: BarisJurnal[];
  rincian: RincianJurnal[];
};

const sertakan = {
  dibuatOleh: { select: { nama: true } },
  disetujuiOleh: { select: { nama: true } },
  detail: { orderBy: { noUrut: "asc" as const }, select: { akunKode: true, debit: true, kredit: true } },
};

type BarisDb = Awaited<ReturnType<typeof ambilBaris>>[number];
const ambilBaris = (where: Prisma.JurnalWhereInput) =>
  db.jurnal.findMany({ where, orderBy: [{ tanggal: "asc" }, { no: "asc" }], include: sertakan });

function petakan(j: BarisDb, rincian: RincianJurnal[] = []): DataJurnal {
  return {
    no: j.no,
    tanggal: dariDate(j.tanggal),
    periode: j.periodeId,
    jenis: j.jenis,
    keterangan: j.keterangan,
    status: j.status,
    alasanTolak: j.alasanTolak,
    dibuatOleh: j.dibuatOleh.nama,
    dibuatOlehId: j.dibuatOlehId,
    diajukanPada: j.diajukanPada?.toISOString() ?? null,
    disetujuiOleh: j.disetujuiOleh?.nama ?? null,
    disetujuiPada: j.disetujuiPada?.toISOString() ?? null,
    pembalikDariNo: j.pembalikDariNo,
    sumberTipe: j.sumberTipe,
    baris: j.detail.map((d) => ({ akun: d.akunKode, debit: d.debit, kredit: d.kredit })),
    rincian,
  };
}

/** Rincian asal jurnal penyesuaian: baris jadwal penyusutan atau hitungan opname perlengkapan. */
async function rincianPenyesuaian(daftar: BarisDb[]): Promise<Map<string, RincianJurnal[]>> {
  const hasil = new Map<string, RincianJurnal[]>();
  const nomorSusut = daftar.filter((j) => j.sumberTipe === "PENYUSUTAN").map((j) => j.no);
  const nomorOpname = daftar.filter((j) => j.sumberTipe === "OPNAME").map((j) => j.no);
  const [jadwal, opname] = await Promise.all([
    nomorSusut.length
      ? db.jadwalPenyusutan.findMany({ where: { jurnalNo: { in: nomorSusut } }, orderBy: [{ asetKode: "asc" }], include: { aset: { select: { nama: true } } } })
      : [],
    nomorOpname.length
      ? db.opname.findMany({ where: { jurnalNo: { in: nomorOpname } }, include: { detail: { include: { perlengkapan: { select: { nama: true } } }, orderBy: { perlengkapanKode: "asc" } } } })
      : [],
  ]);
  for (const r of jadwal) {
    const l = hasil.get(r.jurnalNo!) ?? [];
    l.push({ label: `${r.asetKode} ${r.aset.nama}`, info: `periode ke-${r.periodeKe}`, nilai: r.beban });
    hasil.set(r.jurnalNo!, l);
  }
  for (const o of opname) {
    hasil.set(
      o.jurnalNo!,
      o.detail.map((d) => ({ label: d.perlengkapan.nama, info: `saldo buku ${d.saldoBuku.toLocaleString("id-ID")}, nilai sisa ${d.nilaiSisa.toLocaleString("id-ID")}`, nilai: d.saldoBuku - d.nilaiSisa })),
    );
  }
  return hasil;
}

export async function daftarJurnalPenyesuaian(status: StatusPersetujuan | null): Promise<{ daftar: DataJurnal[]; hitung: Record<StatusPersetujuan | "semua", number> }> {
  const [daftarDb, grup] = await Promise.all([
    ambilBaris({ jenis: "PENYESUAIAN", ...(status ? { status } : {}) }),
    db.jurnal.groupBy({ by: ["status"], where: { jenis: "PENYESUAIAN" }, _count: true }),
  ]);
  const rincian = await rincianPenyesuaian(daftarDb);
  const hitung = { DRAFT: 0, DIAJUKAN: 0, DISETUJUI: 0, DITOLAK: 0, semua: 0 };
  for (const g of grup) {
    hitung[g.status] = g._count;
    hitung.semua += g._count;
  }
  return { daftar: daftarDb.map((j) => petakan(j, rincian.get(j.no))), hitung };
}

/** Jurnal umum dan pembalik yang sudah disetujui. `periode` null = semua periode. */
export async function daftarJurnalUmum(periode: string | null, jenis: "UMUM" | "PEMBALIK" | null): Promise<DataJurnal[]> {
  const daftar = await db.jurnal.findMany({
    where: { status: "DISETUJUI", jenis: jenis ?? { in: ["UMUM", "PEMBALIK"] }, ...(periode ? { periodeId: periode } : {}) },
    orderBy: [{ tanggal: "asc" }, { no: "asc" }],
    include: sertakan,
  });
  return daftar.map((j) => petakan(j));
}

/** Buku besar satu akun per tahap (bawaan "setelah" = semua jurnal disetujui sampai periode itu). */
export async function dataBukuBesar(kodeAkun: string, periode: string, tahap: Tahap = "setelah") {
  const [akun, buku] = await Promise.all([db.akun.findUnique({ where: { kode: kodeAkun } }), muatJurnalBuku(db, periode)]);
  if (!akun) return null;
  return { akun: { kode: akun.kode, nama: akun.nama, saldoNormal: akun.saldoNormal }, ...bukuBesarTahap(buku, akun.kode, akun.saldoNormal, periode, tahap) };
}

/** Neraca saldo sampai akhir periode per tahap (bawaan "setelah" = saldo lengkap seperti sebelumnya). */
export async function dataNeracaSaldo(sampai: string, tahap: Tahap = "setelah") {
  const [akun, buku] = await Promise.all([db.akun.findMany({ select: { kode: true, nama: true } }), muatJurnalBuku(db, sampai)]);
  const n = neracaSaldo(saringTahap(buku, sampai, tahap), akun.map((a) => a.kode), sampai);
  const nama = new Map(akun.map((a) => [a.kode, a.nama]));
  return { ...n, baris: n.baris.map((b) => ({ ...b, nama: nama.get(b.kode) ?? b.kode })) };
}

/** Neraca lajur ringkas periode P: neraca saldo, penyesuaian, dan neraca saldo setelah penyesuaian per akun. */
export async function dataNeracaLajur(periode: string) {
  const [akun, buku] = await Promise.all([db.akun.findMany({ select: { kode: true, nama: true } }), muatJurnalBuku(db, periode)]);
  const n = neracaLajur(buku, akun.map((a) => a.kode), periode);
  const nama = new Map(akun.map((a) => [a.kode, a.nama]));
  return { ...n, baris: n.baris.map((b) => ({ ...b, nama: nama.get(b.kode) ?? b.kode })) };
}
