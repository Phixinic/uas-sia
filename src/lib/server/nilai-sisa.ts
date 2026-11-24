/*
 * Layanan Nilai Sisa Perlengkapan (dipanggil server action dan skrip seed). Semua fungsi menerima `tx`.
 *
 * Sebelum disetujui: Admin menyimpan hasil hitung fisik (opname DRAFT + jurnal penyesuaian DRAFT), boleh mengubahnya
 * selama masih draf, lalu mengajukan. Owner menyetujui, atau mengembalikan untuk revisi dengan alasan (lewat
 * `tolakJurnal`): jurnal yang diajukan tetap tercatat berstatus DITOLAK beserta alasannya (tampil "Dikembalikan"), opname
 * kembali DRAFT tanpa jurnal, dan Admin mengubah lalu mengajukan ulang.
 *
 * Sesudah disetujui (selama periode terbuka dan belum ada nilai sisa bulan sesudahnya): Admin mengajukan revisi
 * (`revisi_opname`, alasan wajib). Owner menyetujui (jurnal lama dibalik, jurnal baru dibuat, nilai opname diganti) atau
 * mengembalikan dengan alasan (Admin mengajukan revisi baru; yang lama tetap di riwayat).
 */
import type { Tx } from "@/lib/server/db";
import { GalatAksi } from "@/lib/server/aksi";
import { nomorOpname } from "@/lib/server/nomor";
import { pastikanTerbuka } from "@/lib/server/periode";
import { buatJurnal, saldoAkun } from "@/lib/server/jurnal";
import { catatLog } from "@/lib/server/log";
import { barisOpname } from "@/lib/inti/jurnal";
import { AKUN } from "@/lib/inti/akun";
import { hariTerakhir, labelPeriode, periodeBatasProses } from "@/lib/inti/tanggal";
import { rupiah } from "@/lib/format";
import { bahanNilaiSisa } from "@/lib/data/konversi/nilai-sisa";
import { tahanUrutanNilaiSisa } from "@/lib/data/konversi/hitung";

export type InputNilaiSisa = { periode: string; nilai: { perlengkapanKode: string; nilaiSisa: number }[] };

/** Satu proses nilai sisa sekaligus, supaya cek urutan bulan tidak disalip input atau revisi bulan lain. */
const tahanKunciNilaiSisa = (tx: Tx) => tx.$executeRaw`SELECT pg_advisory_xact_lock(7410002)`;

/** Cocokkan nilai kiriman dengan daftar saldo buku. Galat per isian memakai kunci `nilai.<kode>`. */
function cocokkanNilai(saldo: { kode: string; nama: string; saldoBuku: number }[], kiriman: InputNilaiSisa["nilai"]) {
  const nilai = new Map(kiriman.map((x) => [x.perlengkapanKode, x.nilaiSisa]));
  const galatIsian: Record<string, string> = {};
  const baris = saldo.map((s) => {
    const v = nilai.get(s.kode);
    if (v === undefined) galatIsian[s.kode] = "Belum dihitung.";
    else if (v > s.saldoBuku) galatIsian[s.kode] = `Nilai sisa harus 0 sampai ${rupiah(s.saldoBuku)}.`;
    return { kode: s.kode, nama: s.nama, saldoBuku: s.saldoBuku, nilaiSisa: v ?? 0 };
  });
  const salah = Object.keys(galatIsian);
  if (salah.length) {
    const pertama = baris.find((b) => b.kode === salah[0])!;
    throw new GalatAksi(`${pertama.nama}: ${galatIsian[salah[0]].toLowerCase()}`, Object.fromEntries(salah.map((k) => [`nilai.${k}`, galatIsian[k]])));
  }
  return { baris, total: baris.reduce((s, b) => s + (b.saldoBuku - b.nilaiSisa), 0) };
}

/** Penjaga: biaya tidak boleh melebihi saldo akun Perlengkapan di buku besar sampai akhir P (saldo tidak boleh minus). */
async function pastikanSaldoLkp(tx: Tx, P: string, total: number) {
  const saldo = await saldoAkun(tx, AKUN.PERLENGKAPAN, P);
  if (total > saldo) {
    throw new GalatAksi(`Biaya perlengkapan ${rupiah(total)} melebihi saldo akun Perlengkapan sampai ${labelPeriode(P)} (${rupiah(saldo)}), jadi saldonya akan minus. Periksa lagi nilai sisa dan jurnal yang mengurangi akun Perlengkapan.`);
  }
}

/**
 * Simpan hasil hitung fisik periode P. Membuat opname baru, mengubah opname yang masih DRAFT (termasuk yang dikembalikan
 * Owner), atau menginput ulang opname lama berstatus DITOLAK. Total biaya 0 = langsung berlaku tanpa jurnal.
 */
export async function simpanNilaiSisaDalam(tx: Tx, penggunaId: number, d: InputNilaiSisa, batas: string = periodeBatasProses()) {
  const P = d.periode;
  if (P > batas) throw new GalatAksi(`Nilai sisa hanya bisa diinput sampai ${labelPeriode(batas)}.`);
  const no = nomorOpname(P);
  await pastikanTerbuka(tx, P);
  await tahanKunciNilaiSisa(tx);
  const lama = await tx.opname.findUnique({ where: { periodeId: P }, select: { status: true, jurnalNo: true, jurnal: { select: { status: true } } } });
  if (lama?.status === "DIAJUKAN") throw new GalatAksi(`Nilai sisa ${labelPeriode(P)} sedang menunggu keputusan Owner.`);
  if (lama?.status === "DISETUJUI") throw new GalatAksi(`Nilai sisa ${labelPeriode(P)} sudah disetujui. Ajukan revisi bila perlu diubah.`);

  // Urutan: saldo buku P dihitung dari biaya opname bulan-bulan sebelumnya, jadi bulan sesudah P belum boleh
  // punya nilai sisa (biaya akan terhitung dua kali) dan bulan sebelum P harus sudah final.
  const [lain, { saldo, terlewat }] = await Promise.all([
    tx.opname.findMany({ where: { periodeId: { not: P }, status: { not: "DITOLAK" } }, select: { periodeId: true, status: true } }),
    bahanNilaiSisa(tx, P),
  ]);
  const tahan = tahanUrutanNilaiSisa(P, lain, terlewat);
  if (tahan) throw new GalatAksi(tahan);
  if (!saldo.length) throw new GalatAksi("Tidak ada perlengkapan untuk dihitung.");
  const { baris, total } = cocokkanNilai(saldo, d.nilai);
  await pastikanSaldoLkp(tx, P, total);

  // Jurnal: draf lama (bila ada) diganti isinya; tanpa draf dibuat baru. Biaya 0 tidak butuh jurnal, jadi draf lama
  // ditandai ditolak (bukan dihapus) supaya nomor jurnalnya tetap tercatat.
  const drafLama = lama?.status === "DRAFT" && lama.jurnalNo && lama.jurnal?.status === "DRAFT" ? lama.jurnalNo : null;
  let jurnalNo: string | null = null;
  if (total > 0 && drafLama) {
    jurnalNo = drafLama;
    await tx.detailJurnal.deleteMany({ where: { jurnalNo } });
    await tx.detailJurnal.createMany({ data: barisOpname(total).map((b, i) => ({ jurnalNo: drafLama, noUrut: i + 1, akunKode: b.akun, debit: b.debit, kredit: b.kredit })) });
  } else if (total > 0) {
    jurnalNo = await buatJurnal(tx, {
      tanggal: hariTerakhir(P),
      jenis: "PENYESUAIAN",
      status: "DRAFT",
      keterangan: `Biaya perlengkapan ${labelPeriode(P)} (dari input nilai sisa)`,
      baris: barisOpname(total),
      sumberTipe: "OPNAME",
      sumberId: no,
      dibuatOlehId: penggunaId,
    });
  } else if (drafLama) {
    await tx.jurnal.update({ where: { no: drafLama }, data: { status: "DITOLAK", alasanTolak: "Diganti input ulang tanpa biaya perlengkapan.", disetujuiOlehId: penggunaId, disetujuiPada: new Date() } });
  }

  const sekarang = new Date();
  const data = {
    totalBeban: total,
    status: total > 0 ? ("DRAFT" as const) : ("DISETUJUI" as const),
    alasanTolak: null,
    jurnalNo,
    dibuatOlehId: penggunaId,
    dibuatPada: sekarang,
    disetujuiOlehId: total > 0 ? null : penggunaId,
    disetujuiPada: total > 0 ? null : sekarang,
  };
  const detail = baris.map((b) => ({ perlengkapanKode: b.kode, saldoBuku: b.saldoBuku, nilaiSisa: b.nilaiSisa }));
  if (lama) {
    // Klaim bersyarat: hanya draf (termasuk yang dikembalikan) atau opname lama yang ditolak yang boleh diubah.
    const klaim = await tx.opname.updateMany({ where: { no, status: { in: ["DRAFT", "DITOLAK"] } }, data });
    if (klaim.count !== 1) throw new GalatAksi(`Nilai sisa ${labelPeriode(P)} baru saja diproses pengguna lain.`);
    await tx.detailOpname.deleteMany({ where: { opnameNo: no } });
    await tx.detailOpname.createMany({ data: detail.map((x) => ({ ...x, opnameNo: no })) });
  } else {
    await tx.opname.create({ data: { no, periodeId: P, ...data, detail: { create: detail } } });
  }
  const aksi = !lama ? "opname.input" : lama.status === "DRAFT" ? "opname.ubah" : "opname.input-ulang";
  await catatLog(tx, penggunaId, aksi, "opname", no, jurnalNo ? `Jurnal ${jurnalNo}, biaya ${total}` : "Tanpa biaya");
  return { no, jurnalNo, total };
}

/** Alasan revisi tidak boleh diajukan untuk opname periode P, atau null bila boleh. Dipakai halaman dan aksi. */
export async function tahanRevisi(tx: Tx, P: string): Promise<string | null> {
  const [o, sesudah] = await Promise.all([
    tx.opname.findUnique({ where: { periodeId: P }, select: { status: true, revisi: { where: { status: "DIAJUKAN" }, select: { no: true } } } }),
    tx.opname.findFirst({ where: { periodeId: { gt: P }, status: { not: "DITOLAK" } }, orderBy: { periodeId: "asc" }, select: { periodeId: true } }),
  ]);
  if (!o || o.status !== "DISETUJUI") return `Nilai sisa ${labelPeriode(P)} belum disetujui, jadi belum ada yang perlu direvisi.`;
  if (o.revisi.length) return `Revisi ${o.revisi[0].no} masih menunggu keputusan Owner.`;
  if (sesudah) return `Nilai sisa ${labelPeriode(sesudah.periodeId)} sudah diinput, jadi nilai sisa ${labelPeriode(P)} tidak bisa direvisi lagi (biaya bulan sesudahnya sudah dihitung dari saldo ini).`;
  return null;
}

/** Admin mengajukan revisi nilai sisa yang sudah disetujui. Alasan wajib. */
export async function ajukanRevisiDalam(tx: Tx, penggunaId: number, d: InputNilaiSisa & { alasan: string }) {
  const P = d.periode;
  const alasan = d.alasan.trim();
  if (!alasan) throw new GalatAksi("Tulis alasan revisi.", { alasan: "Tulis alasan revisi." });
  await pastikanTerbuka(tx, P);
  await tahanKunciNilaiSisa(tx);
  const tahan = await tahanRevisi(tx, P);
  if (tahan) throw new GalatAksi(tahan);
  const o = await tx.opname.findUniqueOrThrow({ where: { periodeId: P }, include: { detail: { include: { perlengkapan: { select: { nama: true } } }, orderBy: { perlengkapanKode: "asc" } }, _count: { select: { revisi: true } } } });
  const { baris, total } = cocokkanNilai(o.detail.map((x) => ({ kode: x.perlengkapanKode, nama: x.perlengkapan.nama, saldoBuku: x.saldoBuku })), d.nilai);
  const lama = new Map(o.detail.map((x) => [x.perlengkapanKode, x.nilaiSisa]));
  if (baris.every((b) => b.nilaiSisa === lama.get(b.kode))) throw new GalatAksi("Nilai sisa revisi sama persis dengan yang berlaku. Ubah minimal satu perlengkapan.");
  const ke = o._count.revisi + 1;
  const no = `${o.no}-R${ke}`;
  await tx.revisiOpname.create({
    data: {
      no,
      opnameNo: o.no,
      ke,
      totalBebanLama: o.totalBeban,
      totalBeban: total,
      alasan,
      status: "DIAJUKAN",
      jurnalLamaNo: o.jurnalNo,
      diajukanOlehId: penggunaId,
      detail: { create: baris.map((b) => ({ perlengkapanKode: b.kode, saldoBuku: b.saldoBuku, nilaiSisaLama: lama.get(b.kode) ?? 0, nilaiSisa: b.nilaiSisa })) },
    },
  });
  await catatLog(tx, penggunaId, "opname.revisi-ajukan", "opname", o.no, `${no}: biaya ${o.totalBeban} menjadi ${total}. ${alasan}`);
  return { no, total, totalLama: o.totalBeban };
}

async function ambilRevisiMenunggu(tx: Tx, no: string) {
  await tx.$queryRaw`SELECT no_revisi FROM revisi_opname WHERE no_revisi = ${no} FOR UPDATE`;
  const r = await tx.revisiOpname.findUnique({ where: { no }, include: { detail: true, opname: { select: { no: true, periodeId: true, jurnalNo: true, totalBeban: true, status: true } } } });
  if (!r) throw new GalatAksi(`Revisi ${no} tidak ditemukan.`);
  if (r.status !== "DIAJUKAN") throw new GalatAksi(`Revisi ${no} sudah diputuskan.`);
  return r;
}

/**
 * Owner menyetujui revisi: jurnal opname yang berlaku dibalik (jurnal penyesuaian pembalik, `pembalik_dari` = jurnal lama),
 * jurnal penyesuaian baru dibuat dengan biaya revisi, dan nilai opname diganti. Semua jurnal bertanggal akhir periode
 * opname dan langsung DISETUJUI.
 */
export async function setujuiRevisiDalam(tx: Tx, penggunaId: number, no: string) {
  const r = await ambilRevisiMenunggu(tx, no);
  if (r.diajukanOlehId === penggunaId) throw new GalatAksi("Pengaju tidak boleh menyetujui revisinya sendiri.");
  const P = r.opname.periodeId;
  await pastikanTerbuka(tx, P);
  await tahanKunciNilaiSisa(tx);
  if (r.opname.status !== "DISETUJUI") throw new GalatAksi(`Nilai sisa ${labelPeriode(P)} tidak lagi berstatus disetujui.`);
  if (r.opname.jurnalNo !== r.jurnalLamaNo) throw new GalatAksi(`Jurnal nilai sisa ${labelPeriode(P)} sudah berubah sejak revisi ini diajukan. Kembalikan, lalu minta Admin mengajukan ulang.`);
  const sesudah = await tx.opname.findFirst({ where: { periodeId: { gt: P }, status: { not: "DITOLAK" } }, select: { periodeId: true } });
  if (sesudah) throw new GalatAksi(`Nilai sisa ${labelPeriode(sesudah.periodeId)} sudah diinput, jadi revisi ${labelPeriode(P)} tidak bisa disetujui lagi.`);

  let jurnalPembalikNo: string | null = null;
  if (r.opname.jurnalNo) {
    const lama = await tx.jurnal.findUniqueOrThrow({ where: { no: r.opname.jurnalNo }, include: { detail: { orderBy: { noUrut: "asc" } } } });
    jurnalPembalikNo = await buatJurnal(tx, {
      tanggal: hariTerakhir(P),
      jenis: "PENYESUAIAN",
      status: "DISETUJUI",
      keterangan: `Pembalik ${lama.no}: revisi nilai sisa ${labelPeriode(P)} (${r.no})`,
      baris: lama.detail.map((x) => ({ akun: x.akunKode, debit: x.kredit, kredit: x.debit })),
      sumberTipe: "OPNAME",
      sumberId: r.opname.no,
      pembalikDariNo: lama.no,
      dibuatOlehId: r.diajukanOlehId,
      disetujuiOlehId: penggunaId,
    });
  }
  await pastikanSaldoLkp(tx, P, r.totalBeban);
  const jurnalBaruNo = r.totalBeban > 0
    ? await buatJurnal(tx, {
        tanggal: hariTerakhir(P),
        jenis: "PENYESUAIAN",
        status: "DISETUJUI",
        keterangan: `Biaya perlengkapan ${labelPeriode(P)} (revisi ${r.no})`,
        baris: barisOpname(r.totalBeban),
        sumberTipe: "OPNAME",
        sumberId: r.opname.no,
        dibuatOlehId: r.diajukanOlehId,
        disetujuiOlehId: penggunaId,
      })
    : null;
  const sekarang = new Date();
  await tx.opname.update({ where: { no: r.opname.no }, data: { totalBeban: r.totalBeban, jurnalNo: jurnalBaruNo, disetujuiOlehId: penggunaId, disetujuiPada: sekarang } });
  for (const x of r.detail) {
    await tx.detailOpname.update({ where: { opnameNo_perlengkapanKode: { opnameNo: r.opname.no, perlengkapanKode: x.perlengkapanKode } }, data: { nilaiSisa: x.nilaiSisa } });
  }
  const klaim = await tx.revisiOpname.updateMany({ where: { no, status: "DIAJUKAN" }, data: { status: "DISETUJUI", jurnalPembalikNo, jurnalBaruNo, diputuskanOlehId: penggunaId, diputuskanPada: sekarang } });
  if (klaim.count !== 1) throw new GalatAksi(`Revisi ${no} baru saja diputuskan pengguna lain.`);
  await catatLog(tx, penggunaId, "opname.revisi-setujui", "opname", r.opname.no, `${no}: pembalik ${jurnalPembalikNo ?? "-"}, jurnal baru ${jurnalBaruNo ?? "-"}, biaya ${r.totalBebanLama} menjadi ${r.totalBeban}`);
  return { jurnalPembalikNo, jurnalBaruNo };
}

/** Owner mengembalikan revisi ke Admin dengan alasan. Nilai yang berlaku tidak berubah. */
export async function kembalikanRevisiDalam(tx: Tx, penggunaId: number, no: string, alasan: string) {
  const al = alasan.trim();
  if (!al) throw new GalatAksi("Tulis alasan revisi dikembalikan.", { alasan: "Tulis alasan." });
  const r = await ambilRevisiMenunggu(tx, no);
  await pastikanTerbuka(tx, r.opname.periodeId);
  const klaim = await tx.revisiOpname.updateMany({ where: { no, status: "DIAJUKAN" }, data: { status: "DITOLAK", alasanTolak: al, diputuskanOlehId: penggunaId, diputuskanPada: new Date() } });
  if (klaim.count !== 1) throw new GalatAksi(`Revisi ${no} baru saja diputuskan pengguna lain.`);
  await catatLog(tx, penggunaId, "opname.revisi-kembalikan", "opname", r.opname.no, `${no}: ${al}`);
}
