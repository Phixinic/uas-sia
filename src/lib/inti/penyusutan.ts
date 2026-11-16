/*
 * Rumus penyusutan dua tahap (sesuai papan dosen), sama persis dengan versi-statis/assets/js/core/penyusutan.js.
 *   Periode 1..n-1 : d = round((b - S) / n)
 *   Periode n      : (b - S) - (n - 1) x d   -> nilai buku akhir tepat = residu
 */
import { tambahBulan } from "./tanggal";

export type BarisJadwal = {
  /** Periode ke (1..n). */
  periodeKe: number;
  /** "YYYY-MM". */
  periode: string;
  beban: number;
  akumulasi: number;
  nilaiBuku: number;
};

export type HasilJadwal = {
  /** Nilai yang dapat disusutkan (b - S). */
  v: number;
  d: number;
  terakhir: number;
  /** true bila rumus 1 dibulatkan ke bawah supaya beban periode n tidak negatif. */
  pengaman: boolean;
  baris: BarisJadwal[];
};

export class GalatPenyusutan extends Error {}

/**
 * @param hargaBeli b (rupiah)
 * @param residu S (rupiah)
 * @param n jumlah periode (bulan)
 * @param mulai periode pertama "YYYY-MM"
 */
export function hitungJadwal(hargaBeli: number, residu: number, n: number, mulai: string): HasilJadwal {
  const b = Math.round(hargaBeli);
  const s = Math.round(residu || 0);
  const nn = Math.round(n);
  if (!(b > 0)) throw new GalatPenyusutan("Harga beli harus lebih dari 0.");
  if (!(nn >= 1)) throw new GalatPenyusutan("Jumlah periode (n) minimal 1 bulan.");
  if (s < 0 || s >= b) throw new GalatPenyusutan("Nilai residu harus 0 atau lebih, dan lebih kecil dari harga beli.");
  const v = b - s;
  let d = Math.floor((2 * v + nn) / (2 * nn)); // rumus 1: pembulatan setengah ke atas dengan bilangan bulat
  let terakhir = v - (nn - 1) * d; // rumus 2: periode n mengambil seluruh sisa
  let pengaman = false;
  if (terakhir < 0) {
    d = Math.floor(v / nn);
    terakhir = v - (nn - 1) * d;
    pengaman = true;
  }
  const baris: BarisJadwal[] = [];
  let total = 0;
  for (let p = 1; p <= nn; p++) {
    const beban = p < nn ? d : terakhir;
    total += beban;
    baris.push({ periodeKe: p, periode: tambahBulan(mulai, p - 1), beban, akumulasi: total, nilaiBuku: b - total });
  }
  if (total !== v) throw new GalatPenyusutan("Total penyusutan tidak sama dengan nilai yang dapat disusutkan.");
  return { v, d, terakhir, pengaman, baris };
}

export type DasarN = "GARANSI" | "MASA_MANFAAT";

/** n menurut dasar yang dipilih per baris pembelian. */
export const nDariDasar = (dasar: DasarN, garansiBulan: number, masaManfaatBulan: number) =>
  dasar === "GARANSI" ? Math.trunc(garansiBulan || 0) : Math.trunc(masaManfaatBulan || 0);
