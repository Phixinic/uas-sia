/*
 * Kueri baca halaman pembelian (komponen server saja).
 */
import { db } from "@/lib/server/db";
import { dariDate } from "@/lib/inti/tanggal";
import type { JenisPembelian } from "@/generated/prisma/enums";

export async function daftarPembelian(jenis: JenisPembelian) {
  const daftar = await db.pembelian.findMany({
    where: { jenis },
    orderBy: [{ tanggal: "desc" }, { no: "desc" }],
    include: {
      supplier: { select: { nama: true } },
      detail: { orderBy: { noUrut: "asc" }, include: { peralatan: { select: { nama: true } }, perlengkapan: { select: { nama: true } } } },
    },
  });
  return daftar.map((b) => ({
    no: b.no,
    tanggal: dariDate(b.tanggal),
    supplier: b.supplier?.nama ?? "Setoran pemilik",
    caraBayar: b.caraBayar,
    jatuhTempo: dariDate(b.jatuhTempo),
    total: b.total,
    status: b.status,
    jurnalNo: b.jurnalNo,
    alasanBalik: b.alasanBalik,
    barang: b.detail.map((d) => `${d.peralatan?.nama ?? d.perlengkapan?.nama ?? "?"} × ${d.qty}`),
  }));
}
export type RingkasPembelian = Awaited<ReturnType<typeof daftarPembelian>>[number];

/** Satu pembelian lengkap: baris barang, jurnal, jurnal pembalik, dan kartu aset yang terbentuk. */
export async function ambilPembelian(no: string) {
  const b = await db.pembelian.findUnique({
    where: { no },
    include: {
      supplier: true,
      dibuatOleh: { select: { nama: true } },
      disetujuiOleh: { select: { nama: true } },
      dibalikOleh: { select: { nama: true } },
      detail: { orderBy: { noUrut: "asc" }, include: { peralatan: true, perlengkapan: true, aset: { orderBy: { kode: "asc" }, select: { kode: true, status: true, n: true, d: true, terakhir: true } } } },
      jurnal: { include: { detail: { orderBy: { noUrut: "asc" } } } },
      jurnalPembalik: { include: { detail: { orderBy: { noUrut: "asc" } } } },
    },
  });
  return b;
}

/** Pilihan untuk form: supplier aktif, barang aktif (beserta kategori untuk peralatan), dan isi draf bila mengubah. */
export async function opsiFormPembelian(jenis: JenisPembelian, noDraf?: string) {
  const draf = noDraf
    ? await db.pembelian.findUnique({ where: { no: noDraf }, include: { detail: { orderBy: { noUrut: "asc" } } } })
    : null;
  const kodeDraf = draf?.detail.map((d) => d.peralatanKode ?? d.perlengkapanKode ?? "") ?? [];
  const [supplier, barang, kategori] = await Promise.all([
    db.supplier.findMany({ where: { OR: [{ aktif: true }, { kode: draf?.supplierKode ?? "" }] }, orderBy: { kode: "asc" }, select: { kode: true, nama: true } }),
    jenis === "PERALATAN"
      ? db.peralatan
          .findMany({ where: { OR: [{ aktif: true }, { kode: { in: kodeDraf } }] }, orderBy: { kode: "asc" }, include: { kategori: true } })
          .then((x) => x.map((p) => ({ kode: p.kode, nama: p.nama, satuan: p.satuan, kategori: { nama: p.kategori.nama, masaManfaatBulan: p.kategori.masaManfaatBulan, persenResidu: p.kategori.persenResidu, akunAset: p.kategori.akunAsetKode } })))
      : db.perlengkapan
          .findMany({ where: { OR: [{ aktif: true }, { kode: { in: kodeDraf } }] }, orderBy: { kode: "asc" } })
          .then((x) => x.map((p) => ({ kode: p.kode, nama: p.nama, satuan: p.satuan, kategori: null }))),
    jenis === "PERALATAN"
      ? db.kategoriAset
          .findMany({ where: { aktif: true }, orderBy: { kode: "asc" } })
          .then((x) => x.map((k) => ({ kode: k.kode, nama: k.nama, masaManfaatBulan: k.masaManfaatBulan, persenResidu: k.persenResidu, akunAset: k.akunAsetKode })))
      : Promise.resolve([]),
  ]);
  return { supplier, barang, kategori, draf };
}
export type BarangForm = Awaited<ReturnType<typeof opsiFormPembelian>>["barang"][number];
