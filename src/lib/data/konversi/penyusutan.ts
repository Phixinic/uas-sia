/*
 * Kueri baca halaman Proses Penyusutan.
 */
import { db } from "@/lib/server/db";
import { daftarPeriode, periodeBatasProses, periodeIni } from "@/lib/inti/tanggal";
import { barisPenyusutan } from "@/lib/inti/jurnal";
import { jurnalPeriode, riwayatJurnalSumber } from "./persetujuan";

export async function periodePenyusutan(dipilih?: string) {
  const sekarang = periodeIni();
  const [awal, belum] = await Promise.all([
    db.aset.findFirst({ where: { status: { not: "BATAL" } }, orderBy: { bulanMulai: "asc" }, select: { bulanMulai: true } }),
    db.jadwalPenyusutan.findFirst({ where: { jurnalNo: null, aset: { status: "AKTIF" }, periodeId: { lte: sekarang } }, orderBy: { periodeId: "asc" }, select: { periodeId: true } }),
  ]);
  const pertama = awal?.bulanMulai ?? sekarang;
  const batas = periodeBatasProses();
  const pilihan = daftarPeriode(pertama < sekarang ? pertama : sekarang, batas);
  const bawaan = belum?.periodeId ?? sekarang;
  // Periode yang dipilih dipakai apa adanya (bulan tanpa jadwal tampil kosong), bukan dialihkan diam-diam ke bulan lain.
  const periode = dipilih && dipilih !== "semua" ? dipilih : bawaan;
  return { periode, pilihan, sekarang, batas, lewatBatas: periode > batas };
}

export async function dataPenyusutan(periode: string) {
  const [jadwal, sebelumnya, riwayat, terkunci] = await Promise.all([
    // Semua aset yang punya jadwal di periode ini: aset aktif, ditambah baris yang sudah dijurnal walau asetnya dilepas
    // sesudahnya, supaya total tabel sama dengan jurnal penyusutan periode itu.
    db.jadwalPenyusutan.findMany({
      where: { periodeId: periode, OR: [{ aset: { status: "AKTIF" } }, { jurnalNo: { not: null } }] },
      orderBy: { asetKode: "asc" },
      include: { aset: { select: { nama: true, n: true, status: true, akunBebanKode: true, akunAkumulasiKode: true } }, jurnal: { select: { status: true } } },
    }),
    db.jadwalPenyusutan.findMany({ where: { periodeId: { lt: periode }, jurnalNo: null, aset: { status: "AKTIF" } }, distinct: ["periodeId"], orderBy: { periodeId: "asc" }, select: { periodeId: true } }),
    riwayatJurnalSumber("PENYUSUTAN"),
    // Tertutup bila periode ini atau periode sesudahnya terkunci (kunci berurutan).
    db.periode.findFirst({ where: { id: { gte: periode }, status: "TERKUNCI" }, orderBy: { id: "asc" }, select: { id: true } }),
  ]);
  const baris = jadwal.map((r) => ({
    asetKode: r.asetKode,
    nama: r.aset.nama,
    dilepas: r.aset.status === "DILEPAS",
    periodeKe: r.periodeKe,
    n: r.aset.n,
    beban: r.beban,
    akumulasi: r.akumulasi,
    nilaiBuku: r.nilaiBuku,
    jurnalNo: r.jurnalNo,
    statusJurnal: r.jurnal?.status ?? null,
  }));
  const belum = jadwal.filter((r) => !r.jurnalNo);
  // Jumlah aset per jurnal dari jadwal yang menunjuknya. Jurnal ditolak sudah melepas jadwalnya, jadi tidak punya angka.
  const asetPerJurnal = await db.jadwalPenyusutan.groupBy({ by: ["jurnalNo"], where: { jurnalNo: { in: riwayat.map((j) => j.no) } }, _count: true });
  const jumlahAset = Object.fromEntries(asetPerJurnal.map((g) => [g.jurnalNo!, g._count]));
  const bebanStatus = (cocok: (s: string | null) => boolean) => jadwal.filter((r) => r.jurnalNo && cocok(r.jurnal?.status ?? null)).reduce((s, r) => s + r.beban, 0);
  return {
    baris,
    totalBeban: jadwal.reduce((s, r) => s + r.beban, 0),
    belumDiproses: belum.length,
    totalBelum: belum.reduce((s, r) => s + r.beban, 0),
    jurnalBaris: barisPenyusutan(belum.map((r) => ({ akunBeban: r.aset.akunBebanKode, akunAkumulasi: r.aset.akunAkumulasiKode, beban: r.beban }))),
    periodeSebelumnyaBelum: sebelumnya.map((x) => x.periodeId),
    terkunci: !!terkunci,
    penutup: terkunci?.id ?? null,
    /** Beban periode ini yang jurnalnya sudah disetujui, dan yang sudah dijurnal tetapi masih draf atau diajukan. */
    totalDisetujui: bebanStatus((s) => s === "DISETUJUI"),
    totalMenunggu: bebanStatus((s) => s === "DRAFT" || s === "DIAJUKAN"),
    riwayat,
    jumlahAset,
    /** Jurnal yang mewakili periode ini (berjalan, atau penolakan terakhir). */
    jurnalIni: jurnalPeriode(riwayat, periode),
  };
}

/**
 * Bulan sampai `sampai` (inklusif) yang masih punya jadwal penyusutan aset aktif belum diproses, urut naik.
 * Dipakai peringatan di dashboard dan laporan: beban penyusutan bulan itu belum ada di buku besar.
 */
export async function bulanPenyusutanBelum(sampai: string): Promise<string[]> {
  const r = await db.jadwalPenyusutan.findMany({ where: { periodeId: { lte: sampai }, jurnalNo: null, aset: { status: "AKTIF" } }, distinct: ["periodeId"], orderBy: { periodeId: "asc" }, select: { periodeId: true } });
  return r.map((x) => x.periodeId);
}
