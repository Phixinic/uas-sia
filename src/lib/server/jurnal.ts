/*
 * Layanan jurnal bersama untuk semua siklus:
 * - buatJurnal: validasi seimbang, cek kunci periode, nomor otomatis, simpan header dan detail.
 * - ajukanJurnal / setujuiJurnal / tolakJurnal: alur persetujuan jurnal penyesuaian beserta efeknya ke dokumen
 *   sumber (jadwal penyusutan, opname). Dipanggil dari server action halaman Jurnal Penyesuaian.
 * - muatJurnalBuku / saldoAkun: bahan buku besar, neraca saldo, dan cek saldo kas.
 * Semua fungsi tulis menerima `tx` dan harus dipanggil di dalam db.$transaction.
 */
import type { DbAtauTx, Tx } from "@/lib/server/db";
import { db } from "@/lib/server/db";
import { GalatAksi } from "@/lib/server/aksi";
import { nomorDokumen, AWALAN } from "@/lib/server/nomor";
import { pastikanTerbuka } from "@/lib/server/periode";
import { catatLog } from "@/lib/server/log";
import { validasiBaris, type BarisJurnal } from "@/lib/inti/jurnal";
import { periodeDari, keDate, dariDate, labelPeriode } from "@/lib/inti/tanggal";
import { AKUN } from "@/lib/inti/akun";
import { rupiah } from "@/lib/format";
import type { JurnalBuku } from "@/lib/inti/buku-besar";
import type { JenisJurnal, StatusPersetujuan, SumberJurnal } from "@/generated/prisma/enums";

const AWALAN_JENIS: Record<JenisJurnal, string> = {
  UMUM: AWALAN.JURNAL_UMUM,
  PENYESUAIAN: AWALAN.JURNAL_PENYESUAIAN,
  PEMBALIK: AWALAN.JURNAL_PEMBALIK,
};

export type InputJurnal = {
  tanggal: string;
  jenis: JenisJurnal;
  /** DRAFT untuk jurnal penyesuaian yang masih perlu diajukan; DISETUJUI untuk jurnal otomatis yang langsung berlaku. */
  status: Extract<StatusPersetujuan, "DRAFT" | "DISETUJUI">;
  keterangan: string;
  baris: BarisJurnal[];
  sumberTipe?: SumberJurnal | null;
  sumberId?: string | null;
  pembalikDariNo?: string | null;
  dibuatOlehId: number;
  /** Wajib bila status DISETUJUI; bawaannya sama dengan pembuat. */
  disetujuiOlehId?: number | null;
};

/** Membuat jurnal dan mengembalikan nomornya. */
export async function buatJurnal(tx: Tx, input: InputJurnal): Promise<string> {
  const periode = periodeDari(input.tanggal);
  await pastikanTerbuka(tx, periode);
  const baris = validasiBaris(input.baris);
  const no = await nomorDokumen(tx, AWALAN_JENIS[input.jenis], input.tanggal);
  const sekarang = new Date();
  const disetujui = input.status === "DISETUJUI";
  await tx.jurnal.create({
    data: {
      no,
      tanggal: keDate(input.tanggal),
      periodeId: periode,
      jenis: input.jenis,
      keterangan: input.keterangan,
      status: input.status,
      sumberTipe: input.sumberTipe ?? null,
      sumberId: input.sumberId ?? null,
      pembalikDariNo: input.pembalikDariNo ?? null,
      dibuatOlehId: input.dibuatOlehId,
      diajukanPada: disetujui ? sekarang : null,
      disetujuiOlehId: disetujui ? (input.disetujuiOlehId ?? input.dibuatOlehId) : null,
      disetujuiPada: disetujui ? sekarang : null,
      detail: { create: baris.map((b, i) => ({ noUrut: i + 1, akunKode: b.akun, debit: b.debit, kredit: b.kredit })) },
    },
  });
  return no;
}

async function ambilJurnal(tx: Tx, no: string) {
  const j = await tx.jurnal.findUnique({ where: { no } });
  if (!j) throw new GalatAksi(`Jurnal ${no} tidak ditemukan.`);
  return j;
}

/** DRAFT -> DIAJUKAN. Opname sumbernya ikut DIAJUKAN. */
export async function ajukanJurnal(tx: Tx, no: string, penggunaId: number) {
  const j = await ambilJurnal(tx, no);
  if (j.status !== "DRAFT") throw new GalatAksi(`${no} bukan draf.`);
  await pastikanTerbuka(tx, j.periodeId);
  await tx.jurnal.update({ where: { no }, data: { status: "DIAJUKAN", diajukanPada: new Date(), alasanTolak: null } });
  if (j.sumberTipe === "OPNAME") await tx.opname.updateMany({ where: { jurnalNo: no }, data: { status: "DIAJUKAN" } });
  await catatLog(tx, penggunaId, "jurnal.ajukan", "jurnal", no);
}

/**
 * DIAJUKAN -> DISETUJUI. Pembuat tidak boleh menyetujui jurnalnya sendiri. Opname sumbernya ikut DISETUJUI.
 * Jurnal biaya perlengkapan (opname) ditolak bila membuat saldo akun Perlengkapan sampai periodenya minus.
 */
export async function setujuiJurnal(tx: Tx, no: string, penggunaId: number) {
  const j = await ambilJurnal(tx, no);
  if (j.status !== "DIAJUKAN") throw new GalatAksi(`${no} belum diajukan atau sudah diputuskan.`);
  if (j.dibuatOlehId === penggunaId) throw new GalatAksi("Pembuat tidak boleh menyetujui jurnalnya sendiri.");
  await pastikanTerbuka(tx, j.periodeId);
  if (j.sumberTipe === "OPNAME") {
    const kredit = await tx.detailJurnal.aggregate({ where: { jurnalNo: no, akunKode: AKUN.PERLENGKAPAN }, _sum: { kredit: true, debit: true } });
    const keluar = (kredit._sum.kredit ?? 0) - (kredit._sum.debit ?? 0);
    const saldo = await saldoAkun(tx, AKUN.PERLENGKAPAN, j.periodeId);
    if (keluar > saldo) {
      throw new GalatAksi(`Saldo Perlengkapan sampai ${labelPeriode(j.periodeId)} tinggal ${rupiah(saldo)}, kurang dari biaya ${rupiah(keluar)} di ${no}. Jurnal ini akan membuat saldo Perlengkapan minus, jadi tolak lalu minta Admin menginput ulang nilai sisanya.`);
    }
  }
  const sekarang = new Date();
  await tx.jurnal.update({ where: { no }, data: { status: "DISETUJUI", disetujuiOlehId: penggunaId, disetujuiPada: sekarang } });
  if (j.sumberTipe === "OPNAME") {
    await tx.opname.updateMany({ where: { jurnalNo: no }, data: { status: "DISETUJUI", disetujuiOlehId: penggunaId, disetujuiPada: sekarang } });
  }
  await catatLog(tx, penggunaId, "jurnal.setujui", "jurnal", no);
}

/**
 * DIAJUKAN -> DITOLAK dengan alasan. Dokumen sumber dibuka lagi supaya Admin bisa memproses ulang:
 * - penyusutan: baris jadwal yang menunjuk jurnal ini dikosongkan jurnalNo-nya;
 * - opname: status DITOLAK dan alasannya disalin, form nilai sisa periode itu terbuka lagi.
 */
export async function tolakJurnal(tx: Tx, no: string, penggunaId: number, alasan: string) {
  const al = alasan.trim();
  if (!al) throw new GalatAksi("Tulis alasan penolakan.");
  const j = await ambilJurnal(tx, no);
  if (j.status !== "DIAJUKAN") throw new GalatAksi(`${no} belum diajukan atau sudah diputuskan.`);
  // Penolakan membuka lagi dokumen sumbernya, jadi periode tertutup juga menolak keputusan ini.
  await pastikanTerbuka(tx, j.periodeId);
  const sekarang = new Date();
  await tx.jurnal.update({ where: { no }, data: { status: "DITOLAK", alasanTolak: al, disetujuiOlehId: penggunaId, disetujuiPada: sekarang } });
  if (j.sumberTipe === "PENYUSUTAN") await tx.jadwalPenyusutan.updateMany({ where: { jurnalNo: no }, data: { jurnalNo: null } });
  if (j.sumberTipe === "OPNAME") {
    await tx.opname.updateMany({ where: { jurnalNo: no }, data: { status: "DITOLAK", alasanTolak: al, disetujuiOlehId: penggunaId, disetujuiPada: sekarang } });
  }
  await catatLog(tx, penggunaId, "jurnal.tolak", "jurnal", no, al);
}

/**
 * Jurnal DISETUJUI semua jenis (opsional sampai periode tertentu) dalam bentuk yang dipakai src/lib/inti/buku-besar.ts.
 * Tahap sebelum atau setelah penyesuaian disaring di pemanggil lewat `saringTahap`, bukan di kueri ini.
 */
export async function muatJurnalBuku(klien: DbAtauTx = db, sampai?: string | null): Promise<JurnalBuku[]> {
  const daftar = await klien.jurnal.findMany({
    where: { status: "DISETUJUI", ...(sampai ? { periodeId: { lte: sampai } } : {}) },
    orderBy: [{ tanggal: "asc" }, { no: "asc" }],
    select: { no: true, tanggal: true, periodeId: true, status: true, jenis: true, keterangan: true, detail: { orderBy: { noUrut: "asc" }, select: { akunKode: true, debit: true, kredit: true } } },
  });
  return daftar.map((j) => ({
    no: j.no,
    tanggal: dariDate(j.tanggal),
    periode: j.periodeId,
    status: j.status,
    jenis: j.jenis,
    keterangan: j.keterangan,
    baris: j.detail.map((d) => ({ akun: d.akunKode, debit: d.debit, kredit: d.kredit })),
  }));
}

/** Mutasi bersih (debit - kredit) satu akun per periode dari jurnal DISETUJUI. */
export async function mutasiAkunPerPeriode(klien: DbAtauTx, kode: string): Promise<{ periode: string; net: number }[]> {
  const baris = await klien.$queryRaw<{ periode: string; net: bigint }[]>`
    SELECT j."periode" AS periode, SUM(d."debit" - d."kredit")::bigint AS net
    FROM "detail_jurnal" d JOIN "jurnal" j ON j."no_jurnal" = d."no_jurnal"
    WHERE d."kode_akun" = ${kode} AND j."status" = 'DISETUJUI'
    GROUP BY j."periode"`;
  return baris.map((b) => ({ periode: b.periode, net: Number(b.net) }));
}

/**
 * Kunci advisory 7410003: pembayaran tunai yang memeriksa saldo kas diserialkan supaya dua posting bersamaan tidak
 * sama-sama lolos cek lalu membuat kas minus.
 */
export async function tahanKunciKas(tx: DbAtauTx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(7410003)`;
}

/** Saldo satu akun dari jurnal DISETUJUI sampai akhir periode (null = semua), bertanda sesuai saldo normal. */
export async function saldoAkun(klien: DbAtauTx, kode: string, sampai: string | null = null): Promise<number> {
  const [akun, jumlah] = await Promise.all([
    klien.akun.findUnique({ where: { kode }, select: { saldoNormal: true } }),
    klien.detailJurnal.aggregate({
      where: { akunKode: kode, jurnal: { status: "DISETUJUI", ...(sampai ? { periodeId: { lte: sampai } } : {}) } },
      _sum: { debit: true, kredit: true },
    }),
  ]);
  const d = jumlah._sum.debit ?? 0;
  const k = jumlah._sum.kredit ?? 0;
  return (akun?.saldoNormal ?? "D") === "D" ? d - k : k - d;
}
