/*
 * Kueri baca halaman Nilai Sisa Perlengkapan. Fungsi saldoBukuLkp juga dipakai server action supaya
 * saldo yang divalidasi sama dengan yang ditampilkan.
 */
import { db, type DbAtauTx } from "@/lib/server/db";
import { dariDate, daftarPeriode, periodeDari, periodeIni } from "@/lib/inti/tanggal";
import { saldoBukuPerlengkapan } from "./hitung";

export type BarisSaldoLkp = { kode: string; nama: string; satuan: string; saldoBuku: number };

/** Perlengkapan yang masih punya saldo buku di periode P, urut kode. */
export async function saldoBukuLkp(klien: DbAtauTx, periode: string): Promise<BarisSaldoLkp[]> {
  const [barang, detail, opname] = await Promise.all([
    klien.perlengkapan.findMany({ orderBy: { kode: "asc" }, select: { kode: true, nama: true, satuan: true } }),
    klien.detailPembelian.findMany({
      where: { perlengkapanKode: { not: null }, pembelian: { status: "DISETUJUI" } },
      select: { perlengkapanKode: true, qty: true, harga: true, pembelian: { select: { tanggal: true } } },
    }),
    klien.detailOpname.findMany({
      where: { opname: { status: { not: "DITOLAK" } } },
      select: { perlengkapanKode: true, saldoBuku: true, nilaiSisa: true, opname: { select: { periodeId: true } } },
    }),
  ]);
  const saldo = saldoBukuPerlengkapan(
    detail.map((d) => ({ perlengkapanKode: d.perlengkapanKode!, periode: periodeDari(dariDate(d.pembelian.tanggal)), nilai: d.qty * d.harga })),
    opname.map((o) => ({ perlengkapanKode: o.perlengkapanKode, periode: o.opname.periodeId, beban: o.saldoBuku - o.nilaiSisa })),
    periode,
  );
  return barang.filter((b) => (saldo[b.kode] ?? 0) > 0).map((b) => ({ ...b, saldoBuku: saldo[b.kode] }));
}

/** Periode pertama yang belum punya opname (tidak ditolak) sejak pembelian pertama; bila semua sudah, periode berjalan. */
export async function periodeNilaiSisa(dipilih?: string) {
  const sekarang = periodeIni();
  const pertama = await db.pembelian.findFirst({ where: { jenis: "PERLENGKAPAN", status: "DISETUJUI" }, orderBy: { tanggal: "asc" }, select: { tanggal: true } });
  const awal = pertama ? periodeDari(dariDate(pertama.tanggal)) : sekarang;
  const pilihan = daftarPeriode(awal < sekarang ? awal : sekarang, sekarang);
  const sudah = new Set((await db.opname.findMany({ where: { status: { not: "DITOLAK" } }, select: { periodeId: true } })).map((o) => o.periodeId));
  const bawaan = pilihan.find((p) => !sudah.has(p)) ?? sekarang;
  const periode = dipilih && pilihan.includes(dipilih) ? dipilih : bawaan;
  return { periode, pilihan, sekarang };
}

export async function dataNilaiSisa(periode: string) {
  const [baris, opname, riwayat] = await Promise.all([
    saldoBukuLkp(db, periode),
    db.opname.findUnique({
      where: { periodeId: periode },
      include: {
        detail: { orderBy: { perlengkapanKode: "asc" }, include: { perlengkapan: { select: { nama: true, satuan: true } } } },
        jurnal: { select: { no: true, status: true, alasanTolak: true, detail: { orderBy: { noUrut: "asc" }, select: { akunKode: true, debit: true, kredit: true } } } },
        dibuatOleh: { select: { nama: true } },
      },
    }),
    db.opname.findMany({ orderBy: { periodeId: "desc" }, include: { jurnal: { select: { no: true, status: true } } } }),
  ]);
  return {
    baris,
    opname: opname && {
      no: opname.no,
      status: opname.status,
      alasanTolak: opname.alasanTolak,
      totalBeban: opname.totalBeban,
      dibuatOleh: opname.dibuatOleh.nama,
      jurnal: opname.jurnal && { no: opname.jurnal.no, status: opname.jurnal.status, baris: opname.jurnal.detail.map((d) => ({ akun: d.akunKode, debit: d.debit, kredit: d.kredit })) },
      detail: opname.detail.map((d) => ({ kode: d.perlengkapanKode, nama: d.perlengkapan.nama, satuan: d.perlengkapan.satuan, saldoBuku: d.saldoBuku, nilaiSisa: d.nilaiSisa, beban: d.saldoBuku - d.nilaiSisa })),
    },
    riwayat: riwayat.map((o) => ({ no: o.no, periode: o.periodeId, totalBeban: o.totalBeban, status: o.status, jurnalNo: o.jurnal?.no ?? null, statusJurnal: o.jurnal?.status ?? null })),
  };
}
