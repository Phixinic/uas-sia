/*
 * Penomoran dokumen. Penghitung disimpan di tabel penghitung dan dinaikkan secara atomik
 * (INSERT ... ON CONFLICT DO UPDATE), jadi aman dipakai beberapa pengguna sekaligus.
 *
 * Format (sama dengan app lama):
 *   dokumen bertahun : AWALAN-YYYY-NNNN   (JU, JP, JB, BP, BL, PLP, PAY, EVT, FEE, INV), penghitung per tahun
 *   aset             : AST-NNNN
 *   master           : AWALAN-NN          (SUP, ALT, LKP, KAT, KRY, JBT, GP, TNJ, TM, SET)
 *   turunan          : OPN-YYYY-MM, SLP-YYYY-MM-<kode karyawan>, SFE-<kode event>-<kode karyawan> (tidak memakai penghitung)
 */
import type { DbAtauTx } from "@/lib/server/db";

export const AWALAN = {
  JURNAL_UMUM: "JU",
  JURNAL_PENYESUAIAN: "JP",
  JURNAL_PEMBALIK: "JB",
  PEMBELIAN_PERALATAN: "BP",
  PEMBELIAN_PERLENGKAPAN: "BL",
  PELEPASAN: "PLP",
  PENGGAJIAN: "PAY",
  EVENT: "EVT",
  LAPORAN_FEE: "FEE",
  INVESTASI_KAS: "INV",
  ASET: "AST",
  SUPPLIER: "SUP",
  PERALATAN: "ALT",
  PERLENGKAPAN: "LKP",
  KATEGORI: "KAT",
  KARYAWAN: "KRY",
  JABATAN: "JBT",
  GOLONGAN: "GP",
  TUNJANGAN: "TNJ",
  JADWAL_KERJA: "TM",
  SETTING_GAJI: "SET",
} as const;

async function naikkan(tx: DbAtauTx, kunci: string): Promise<number> {
  const h = await tx.penghitung.upsert({ where: { kunci }, create: { kunci, nilai: 1 }, update: { nilai: { increment: 1 } } });
  return h.nilai;
}

/** Nomor dokumen bertahun dari tanggal dokumen: nomorDokumen(tx, "BP", "2026-10-05") -> "BP-2026-0008". */
export async function nomorDokumen(tx: DbAtauTx, awalan: string, tanggal: string): Promise<string> {
  const tahun = tanggal.slice(0, 4);
  const n = await naikkan(tx, awalan + tahun);
  return `${awalan}-${tahun}-${String(n).padStart(4, "0")}`;
}

/** Kode tanpa tahun: kodeBerikutnya(tx, "SUP") -> "SUP-04"; kodeBerikutnya(tx, "AST", 4) -> "AST-0010". */
export async function kodeBerikutnya(tx: DbAtauTx, awalan: string, lebar = 2): Promise<string> {
  const n = await naikkan(tx, awalan);
  return `${awalan}-${String(n).padStart(lebar, "0")}`;
}

export const nomorOpname = (periode: string) => `OPN-${periode}`;
export const nomorSlip = (periode: string, karyawanKode: string) => `SLP-${periode}-${karyawanKode}`;
/** Slip fee event: satu per orang per event, contoh SFE-EVT-2026-0001-KRY-06. */
export const nomorSlipFee = (eventKode: string, karyawanKode: string) => `SFE-${eventKode}-${karyawanKode}`;
