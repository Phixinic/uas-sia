/*
 * Kueri dashboard: KPI per periode, daftar "Perlu tindakan", dan jurnal terbaru.
 * Padanan versi-statis/assets/js/views/dashboard.js.
 */
import { db } from "@/lib/server/db";
import { saldoAkun } from "@/lib/server/jurnal";
import { AKUN } from "@/lib/inti/akun";
import { dariDate, denganPeriode, hariIni, keDate, labelPeriode, periodeIni, tambahHari } from "@/lib/inti/tanggal";
import { rupiah } from "@/lib/format";
import type { Peran } from "@/lib/peran";
import { LABEL_JENIS_NOMINAL } from "@/lib/inti/nominal";

export type Tindakan = { judul: string; uraian: string; href: string; peran: Peran[] };

export async function dataDashboard(periode: string) {
  const hari = hariIni();
  const sekarang = periodeIni();
  const [kas, mutasiAkun, tipeAkun, jadwalP, susutDisetujui, susutMenunggu, gaji, jurnalTunggu, pelepasanTunggu, penggajianTunggu, statusP, terbaru, feeTunggu, fee, setoranTunggu, settingTunggu, nominalTunggu] = await Promise.all([
    saldoAkun(db, AKUN.KAS, periode),
    db.detailJurnal.groupBy({ by: ["akunKode"], where: { jurnal: { status: "DISETUJUI", periodeId: { lte: periode } } }, _sum: { debit: true, kredit: true } }),
    db.akun.findMany({ select: { kode: true, tipe: true } }),
    // Jadwal periode ini: aset aktif, ditambah baris yang sudah dijurnal walau asetnya sudah dilepas sesudahnya.
    db.jadwalPenyusutan.aggregate({ where: { periodeId: periode, OR: [{ aset: { status: "AKTIF" } }, { jurnalNo: { not: null } }] }, _sum: { beban: true }, _count: true }),
    // Angka disetujui diambil dari jurnal penyusutan yang disetujui (sumber kebenaran), bukan dari jadwal aset aktif.
    db.detailJurnal.aggregate({ where: { jurnal: { status: "DISETUJUI", sumberTipe: "PENYUSUTAN", periodeId: periode } }, _sum: { debit: true } }),
    // Sudah dijurnal tetapi belum berlaku (draf atau menunggu Owner): hanya untuk keterangan, tidak dijumlahkan ke angka kartu.
    db.detailJurnal.aggregate({ where: { jurnal: { status: { in: ["DRAFT", "DIAJUKAN"] }, sumberTipe: "PENYUSUTAN", periodeId: periode } }, _sum: { debit: true } }),
    db.detailJurnal.aggregate({ where: { jurnal: { status: "DISETUJUI", sumberTipe: "PENGGAJIAN", periodeId: periode } }, _sum: { debit: true } }),
    db.jurnal.count({ where: { status: "DIAJUKAN" } }),
    db.pelepasan.count({ where: { status: "DIAJUKAN" } }),
    db.penggajian.count({ where: { status: "DIAJUKAN" } }),
    // Tertutup bila periode ini atau periode sesudahnya terkunci (kunci berurutan).
    db.periode.findFirst({ where: { id: { gte: periode }, status: "TERKUNCI" }, select: { id: true } }),
    db.jurnal.findMany({ orderBy: [{ dibuatPada: "desc" }, { no: "desc" }], take: 6, include: { detail: { select: { debit: true } } } }),
    db.laporanFee.findMany({ where: { status: "DIAJUKAN" }, orderBy: { diajukanPada: "asc" }, select: { no: true, totalUsulan: true, event: { select: { nama: true } } } }),
    db.detailJurnal.aggregate({ where: { jurnal: { status: "DISETUJUI", sumberTipe: "FEE_EVENT", periodeId: periode } }, _sum: { debit: true } }),
    db.investasiKas.aggregate({ where: { status: "DIAJUKAN" }, _sum: { jumlah: true }, _count: true }),
    db.settingGaji.findMany({ where: { status: "DIAJUKAN" }, orderBy: { diajukanPada: "asc" }, select: { berlakuMulai: true, karyawan: { select: { nama: true } } } }),
    db.versiNominal.findMany({
      where: { status: "DIAJUKAN" },
      orderBy: { diajukanPada: "asc" },
      select: { jenis: true, berlakuMulai: true, golongan: { select: { nama: true } }, tunjangan: { select: { nama: true } }, jabatan: { select: { nama: true } } },
    }),
  ]);

  // Total aset bersih = aset (bersaldo debit) dikurangi kontra aset (akumulasi penyusutan), dari buku besar sampai periode.
  const tipe = new Map(tipeAkun.map((a) => [a.kode, a.tipe]));
  let totalAset = 0;
  for (const m of mutasiAkun) {
    const t = tipe.get(m.akunKode);
    const net = (m._sum.debit ?? 0) - (m._sum.kredit ?? 0);
    if (t === "ASET" || t === "KONTRA_ASET") totalAset += net;
  }

  const [drafBeli, drafJurnal, susutBelum, slipDraf, garansi, slipDrafPertama, penggajianPertama, eventTanpaKapten, eventDitolak] = await Promise.all([
    db.pembelian.findMany({ where: { status: "DRAFT" }, select: { jenis: true } }),
    db.jurnal.count({ where: { status: "DRAFT", jenis: "PENYESUAIAN" } }),
    db.jadwalPenyusutan.findMany({ where: { aset: { status: "AKTIF" }, periodeId: { lt: sekarang }, jurnalNo: null }, distinct: ["periodeId"], select: { periodeId: true }, orderBy: { periodeId: "asc" } }),
    db.slipGaji.count({ where: { status: "DRAFT" } }),
    db.aset.findMany({ where: { status: "AKTIF", garansiSampai: { gte: keDate(hari), lte: keDate(tambahHari(hari, 30)) } }, select: { kode: true, nama: true, garansiSampai: true }, orderBy: { garansiSampai: "asc" } }),
    // Periode pekerjaan SDM yang tertunda, supaya tautan "Buka" mendarat di bulan yang benar.
    db.slipGaji.findFirst({ where: { status: "DRAFT" }, orderBy: { periodeId: "asc" }, select: { periodeId: true } }),
    db.penggajian.findFirst({ where: { status: "DIAJUKAN" }, orderBy: { periodeId: "asc" }, select: { periodeId: true } }),
    db.event.findMany({ where: { status: "PENILAIAN", penugasan: { none: { jabatan: { peranEvent: "KAPTEN" } } } }, select: { kode: true, nama: true }, orderBy: { tanggalMulai: "asc" } }),
    db.event.findMany({ where: { status: "PENILAIAN", alasanTolak: { not: null } }, select: { kode: true, nama: true }, orderBy: { tanggalMulai: "asc" } }),
  ]);

  const tindakan: Tindakan[] = [];
  if (drafBeli.length) tindakan.push({ judul: `${drafBeli.length} pembelian masih draf`, uraian: "Posting supaya masuk jurnal umum dan kartu aset.", href: drafBeli[0].jenis === "PERALATAN" ? "/konversi/pembelian-peralatan" : "/konversi/pembelian-perlengkapan", peran: ["ADMIN", "OWNER"] });
  if (susutBelum.length) tindakan.push({ judul: `Penyusutan ${labelPeriode(susutBelum[0].periodeId)} belum diproses`, uraian: susutBelum.length > 1 ? `Ada ${susutBelum.length} periode yang belum diproses.` : "Admin memproses lalu mengajukan jurnalnya.", href: denganPeriode("/konversi/penyusutan", susutBelum[0].periodeId), peran: ["ADMIN"] });
  if (drafJurnal) tindakan.push({ judul: `${drafJurnal} jurnal penyesuaian masih draf`, uraian: "Admin perlu mengajukannya ke Owner.", href: "/pelaporan/jurnal-penyesuaian?status=DRAFT", peran: ["ADMIN"] });
  if (jurnalTunggu) tindakan.push({ judul: `${jurnalTunggu} jurnal penyesuaian menunggu persetujuan`, uraian: "Owner menyetujui atau menolak dengan alasan.", href: "/pelaporan/jurnal-penyesuaian?status=DIAJUKAN", peran: ["OWNER"] });
  if (setoranTunggu._count) {
    tindakan.push({
      judul: `${setoranTunggu._count} setoran modal menunggu keputusan`,
      uraian: `Investasi Kas ${rupiah(setoranTunggu._sum.jumlah ?? 0)}. Owner menyetujui supaya kas bertambah lewat jurnal Debit Kas, Kredit Modal Pemilik.`,
      href: "/modal/investasi-kas",
      peran: ["OWNER"],
    });
  }
  if (settingTunggu.length) {
    tindakan.push({
      judul: `${settingTunggu.length} pengajuan setting gaji menunggu keputusan`,
      uraian: `${settingTunggu.map((v) => `${v.karyawan.nama} (berlaku ${labelPeriode(v.berlakuMulai)})`).join(", ")}. Owner membandingkan setting lama dan baru lalu menyetujui atau menolak.`,
      href: "/sdm/setting-gaji",
      peran: ["OWNER"],
    });
  }
  if (nominalTunggu.length) {
    tindakan.push({
      judul: `${nominalTunggu.length} pengajuan nominal gaji atau tarif menunggu keputusan`,
      uraian: `${nominalTunggu.map((v) => `${LABEL_JENIS_NOMINAL[v.jenis]} ${v.golongan?.nama ?? v.tunjangan?.nama ?? v.jabatan?.nama ?? ""} (berlaku ${labelPeriode(v.berlakuMulai)})`).join(", ")}. Owner membandingkan nominal lama dan baru lalu menyetujui atau menolak.`,
      href: "/master/sdm?tab=struktur",
      peran: ["OWNER"],
    });
  }
  if (pelepasanTunggu) tindakan.push({ judul: `${pelepasanTunggu} pengajuan pelepasan peralatan`, uraian: "Menunggu keputusan Owner.", href: "/konversi/pelepasan", peran: ["OWNER"] });
  if (slipDraf) tindakan.push({ judul: `${slipDraf} slip gaji masih draf`, uraian: "HRD mengajukan distribusinya ke Owner.", href: denganPeriode("/sdm/distribusi", slipDrafPertama?.periodeId ?? periode), peran: ["HRD"] });
  if (penggajianTunggu) tindakan.push({ judul: `${penggajianTunggu} pengajuan penggajian menunggu persetujuan`, uraian: "Owner menyetujui supaya gaji dijurnal dan dibayar.", href: denganPeriode("/sdm/distribusi", penggajianPertama?.periodeId ?? periode), peran: ["OWNER"] });
  if (feeTunggu.length) {
    tindakan.push({
      judul: `${feeTunggu.length} laporan kapten menunggu keputusan fee`,
      uraian: `${feeTunggu.map((l) => l.event.nama).join(", ")}. Owner menentukan fee akhir lalu menyetujui atau menolak.`,
      href: feeTunggu.length === 1 ? `/fee-event/keputusan?lihat=${feeTunggu[0].no}` : "/fee-event/keputusan",
      peran: ["OWNER"],
    });
  }
  for (const e of eventTanpaKapten) tindakan.push({ judul: `Event ${e.nama} belum punya kapten`, uraian: `${e.kode}: tugaskan minimal satu kapten supaya progres crew bisa dinilai.`, href: `/fee-event/event?lihat=${e.kode}`, peran: ["HRD"] });
  for (const e of eventDitolak) tindakan.push({ judul: `Laporan event ${e.nama} ditolak Owner`, uraian: `${e.kode}: periksa data kehadiran bila perlu; kapten menilai ulang lalu mengirim lagi.`, href: `/fee-event/event?lihat=${e.kode}`, peran: ["HRD"] });
  for (const a of garansi) tindakan.push({ judul: `Garansi ${a.nama} habis ${dariDate(a.garansiSampai)}`, uraian: `${a.kode}: cek kondisi sebelum garansi berakhir.`, href: `/konversi/kartu-aset?aset=${a.kode}`, peran: ["ADMIN"] });

  return {
    kas,
    totalAset,
    susut: { jadwal: jadwalP._sum.beban ?? 0, disetujui: susutDisetujui._sum.debit ?? 0, menunggu: susutMenunggu._sum.debit ?? 0, unit: jadwalP._count },
    bebanGaji: gaji._sum.debit ?? 0,
    /** Beban fee event (crew freelance) dari jurnal fee yang disetujui di periode ini. */
    bebanFee: fee._sum.debit ?? 0,
    menunggu: {
      jurnal: jurnalTunggu,
      pelepasan: pelepasanTunggu,
      penggajian: penggajianTunggu,
      fee: feeTunggu.length,
      setoran: setoranTunggu._count,
      setting: settingTunggu.length,
      nominal: nominalTunggu.length,
      total: jurnalTunggu + pelepasanTunggu + penggajianTunggu + feeTunggu.length + setoranTunggu._count + settingTunggu.length + nominalTunggu.length,
    },
    statusPeriode: statusP ? ("TERKUNCI" as const) : ("TERBUKA" as const),
    tindakan,
    terbaru: terbaru.map((j) => ({ no: j.no, tanggal: dariDate(j.tanggal), keterangan: j.keterangan, jenis: j.jenis, status: j.status, jumlah: j.detail.reduce((s, d) => s + d.debit, 0) })),
  };
}
