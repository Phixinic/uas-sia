/*
 * Kueri dashboard: KPI per periode, daftar "Perlu tindakan", dan jurnal terbaru.
 * Padanan versi-statis/assets/js/views/dashboard.js.
 */
import { db } from "@/lib/server/db";
import { saldoAkun } from "@/lib/server/jurnal";
import { AKUN } from "@/lib/inti/akun";
import { dariDate, hariIni, keDate, labelPeriode, periodeIni, tambahHari } from "@/lib/inti/tanggal";
import type { Peran } from "@/lib/peran";

export type Tindakan = { judul: string; uraian: string; href: string; peran: Peran[] };

export async function dataDashboard(periode: string) {
  const hari = hariIni();
  const sekarang = periodeIni();
  const [kas, mutasiAkun, tipeAkun, jadwalP, susutDijurnal, gaji, jurnalTunggu, pelepasanTunggu, penggajianTunggu, statusP, terbaru] = await Promise.all([
    saldoAkun(db, AKUN.KAS, periode),
    db.detailJurnal.groupBy({ by: ["akunKode"], where: { jurnal: { status: "DISETUJUI", periodeId: { lte: periode } } }, _sum: { debit: true, kredit: true } }),
    db.akun.findMany({ select: { kode: true, tipe: true } }),
    db.jadwalPenyusutan.aggregate({ where: { periodeId: periode, aset: { status: "AKTIF" } }, _sum: { beban: true }, _count: true }),
    db.jadwalPenyusutan.aggregate({ where: { periodeId: periode, aset: { status: "AKTIF" }, jurnal: { status: "DISETUJUI" } }, _sum: { beban: true } }),
    db.detailJurnal.aggregate({ where: { jurnal: { status: "DISETUJUI", sumberTipe: "PENGGAJIAN", periodeId: periode } }, _sum: { debit: true } }),
    db.jurnal.count({ where: { status: "DIAJUKAN" } }),
    db.pelepasan.count({ where: { status: "DIAJUKAN" } }),
    db.penggajian.count({ where: { status: "DIAJUKAN" } }),
    db.periode.findUnique({ where: { id: periode }, select: { status: true } }),
    db.jurnal.findMany({ orderBy: [{ dibuatPada: "desc" }, { no: "desc" }], take: 6, include: { detail: { select: { debit: true } } } }),
  ]);

  // Total aset bersih = aset (bersaldo debit) dikurangi kontra aset (akumulasi penyusutan), dari buku besar sampai periode.
  const tipe = new Map(tipeAkun.map((a) => [a.kode, a.tipe]));
  let totalAset = 0;
  for (const m of mutasiAkun) {
    const t = tipe.get(m.akunKode);
    const net = (m._sum.debit ?? 0) - (m._sum.kredit ?? 0);
    if (t === "ASET" || t === "KONTRA_ASET") totalAset += net;
  }

  const [drafBeli, drafJurnal, susutBelum, slipDraf, garansi] = await Promise.all([
    db.pembelian.findMany({ where: { status: "DRAFT" }, select: { jenis: true } }),
    db.jurnal.count({ where: { status: "DRAFT", jenis: "PENYESUAIAN" } }),
    db.jadwalPenyusutan.findMany({ where: { aset: { status: "AKTIF" }, periodeId: { lt: sekarang }, jurnalNo: null }, distinct: ["periodeId"], select: { periodeId: true }, orderBy: { periodeId: "asc" } }),
    db.slipGaji.count({ where: { status: "DRAFT" } }),
    db.aset.findMany({ where: { status: "AKTIF", garansiSampai: { gte: keDate(hari), lte: keDate(tambahHari(hari, 30)) } }, select: { kode: true, nama: true, garansiSampai: true }, orderBy: { garansiSampai: "asc" } }),
  ]);

  const tindakan: Tindakan[] = [];
  if (drafBeli.length) tindakan.push({ judul: `${drafBeli.length} pembelian masih draf`, uraian: "Posting supaya masuk jurnal umum dan kartu aset.", href: drafBeli[0].jenis === "PERALATAN" ? "/konversi/pembelian-peralatan" : "/konversi/pembelian-perlengkapan", peran: ["ADMIN", "OWNER"] });
  if (susutBelum.length) tindakan.push({ judul: `Penyusutan ${labelPeriode(susutBelum[0].periodeId)} belum diproses`, uraian: susutBelum.length > 1 ? `Ada ${susutBelum.length} periode yang belum diproses.` : "Admin memproses lalu mengajukan jurnalnya.", href: "/konversi/penyusutan", peran: ["ADMIN"] });
  if (drafJurnal) tindakan.push({ judul: `${drafJurnal} jurnal penyesuaian masih draf`, uraian: "Admin perlu mengajukannya ke Owner.", href: "/pelaporan/jurnal-penyesuaian?status=DRAFT", peran: ["ADMIN"] });
  if (jurnalTunggu) tindakan.push({ judul: `${jurnalTunggu} jurnal penyesuaian menunggu persetujuan`, uraian: "Owner menyetujui atau menolak dengan alasan.", href: "/pelaporan/jurnal-penyesuaian?status=DIAJUKAN", peran: ["OWNER"] });
  if (pelepasanTunggu) tindakan.push({ judul: `${pelepasanTunggu} pengajuan pelepasan peralatan`, uraian: "Menunggu keputusan Owner.", href: "/konversi/pelepasan", peran: ["OWNER"] });
  if (slipDraf) tindakan.push({ judul: `${slipDraf} slip gaji masih draf`, uraian: "HRD mengajukan distribusinya ke Owner.", href: "/sdm/distribusi", peran: ["HRD"] });
  if (penggajianTunggu) tindakan.push({ judul: `${penggajianTunggu} pengajuan penggajian menunggu persetujuan`, uraian: "Owner menyetujui supaya gaji dijurnal dan dibayar.", href: "/sdm/distribusi", peran: ["OWNER"] });
  for (const a of garansi) tindakan.push({ judul: `Garansi ${a.nama} habis ${dariDate(a.garansiSampai)}`, uraian: `${a.kode}: cek kondisi sebelum garansi berakhir.`, href: `/konversi/kartu-aset?aset=${a.kode}`, peran: ["ADMIN"] });

  return {
    kas,
    totalAset,
    susut: { jadwal: jadwalP._sum.beban ?? 0, dijurnal: susutDijurnal._sum.beban ?? 0, unit: jadwalP._count },
    bebanGaji: gaji._sum.debit ?? 0,
    menunggu: { jurnal: jurnalTunggu, pelepasan: pelepasanTunggu, penggajian: penggajianTunggu, total: jurnalTunggu + pelepasanTunggu + penggajianTunggu },
    statusPeriode: statusP?.status ?? ("TERBUKA" as const),
    tindakan,
    terbaru: terbaru.map((j) => ({ no: j.no, tanggal: dariDate(j.tanggal), keterangan: j.keterangan, jenis: j.jenis, status: j.status, jumlah: j.detail.reduce((s, d) => s + d.debit, 0) })),
  };
}
