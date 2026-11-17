/*
 * Kueri baca halaman Proses Penyusutan.
 */
import { db } from "@/lib/server/db";
import { daftarPeriode, periodeIni } from "@/lib/inti/tanggal";
import { barisPenyusutan } from "@/lib/inti/jurnal";

export async function periodePenyusutan(dipilih?: string) {
  const sekarang = periodeIni();
  const [awal, belum] = await Promise.all([
    db.aset.findFirst({ where: { status: { not: "BATAL" } }, orderBy: { bulanMulai: "asc" }, select: { bulanMulai: true } }),
    db.jadwalPenyusutan.findFirst({ where: { jurnalNo: null, aset: { status: "AKTIF" }, periodeId: { lte: sekarang } }, orderBy: { periodeId: "asc" }, select: { periodeId: true } }),
  ]);
  const pertama = awal?.bulanMulai ?? sekarang;
  const pilihan = daftarPeriode(pertama < sekarang ? pertama : sekarang, sekarang);
  const bawaan = belum?.periodeId ?? sekarang;
  const periode = dipilih && pilihan.includes(dipilih) ? dipilih : bawaan;
  return { periode, pilihan, sekarang };
}

export async function dataPenyusutan(periode: string) {
  const [jadwal, sebelumnya, riwayat, terkunci] = await Promise.all([
    db.jadwalPenyusutan.findMany({
      where: { periodeId: periode, aset: { status: "AKTIF" } },
      orderBy: { asetKode: "asc" },
      include: { aset: { select: { nama: true, n: true, akunBebanKode: true, akunAkumulasiKode: true } }, jurnal: { select: { status: true } } },
    }),
    db.jadwalPenyusutan.findMany({ where: { periodeId: { lt: periode }, jurnalNo: null, aset: { status: "AKTIF" } }, distinct: ["periodeId"], orderBy: { periodeId: "asc" }, select: { periodeId: true } }),
    db.jurnal.findMany({
      where: { sumberTipe: "PENYUSUTAN" },
      orderBy: [{ periodeId: "desc" }, { no: "desc" }],
      select: { no: true, periodeId: true, status: true, alasanTolak: true, detail: { select: { debit: true } }, _count: { select: { jadwalPenyusutan: true } } },
    }),
    // Tertutup bila periode ini atau periode sesudahnya terkunci (kunci berurutan).
    db.periode.findFirst({ where: { id: { gte: periode }, status: "TERKUNCI" }, orderBy: { id: "asc" }, select: { id: true } }),
  ]);
  const baris = jadwal.map((r) => ({
    asetKode: r.asetKode,
    nama: r.aset.nama,
    periodeKe: r.periodeKe,
    n: r.aset.n,
    beban: r.beban,
    akumulasi: r.akumulasi,
    nilaiBuku: r.nilaiBuku,
    jurnalNo: r.jurnalNo,
    statusJurnal: r.jurnal?.status ?? null,
  }));
  const belum = jadwal.filter((r) => !r.jurnalNo);
  return {
    baris,
    belumDiproses: belum.length,
    totalBelum: belum.reduce((s, r) => s + r.beban, 0),
    jurnalBaris: barisPenyusutan(belum.map((r) => ({ akunBeban: r.aset.akunBebanKode, akunAkumulasi: r.aset.akunAkumulasiKode, beban: r.beban }))),
    periodeSebelumnyaBelum: sebelumnya.map((x) => x.periodeId),
    terkunci: !!terkunci,
    penutup: terkunci?.id ?? null,
    riwayat: riwayat.map((j) => ({ no: j.no, periode: j.periodeId, status: j.status, alasanTolak: j.alasanTolak, total: j.detail.reduce((s, d) => s + d.debit, 0), jumlahAset: j._count.jadwalPenyusutan })),
  };
}
