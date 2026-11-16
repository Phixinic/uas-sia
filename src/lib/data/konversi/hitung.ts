/*
 * Hitungan murni siklus konversi (tanpa database), supaya mudah diuji.
 */

export type PembelianLkp = { perlengkapanKode: string; periode: string; nilai: number };
export type BebanOpname = { perlengkapanKode: string; periode: string; beban: number };

/**
 * Saldo buku tiap perlengkapan pada awal pengisian periode P (sama dengan saldoBukuLkp di app lama):
 * pembelian DISETUJUI sampai periode P dikurangi beban opname yang tidak ditolak di periode sebelum P.
 */
export function saldoBukuPerlengkapan(pembelian: PembelianLkp[], opname: BebanOpname[], periode: string): Record<string, number> {
  const saldo: Record<string, number> = {};
  for (const b of pembelian) if (b.periode <= periode) saldo[b.perlengkapanKode] = (saldo[b.perlengkapanKode] ?? 0) + b.nilai;
  for (const o of opname) if (o.periode < periode) saldo[o.perlengkapanKode] = (saldo[o.perlengkapanKode] ?? 0) - o.beban;
  return saldo;
}

export type BarisAset = { periodeKe: number; periode: string; beban: number; jurnalNo: string | null; statusJurnal: string | null };

/** Akumulasi yang diakui = jumlah beban baris jadwal yang jurnalnya DISETUJUI. */
export const akumulasiDisetujui = (jadwal: BarisAset[]) => jadwal.filter((r) => r.jurnalNo && r.statusJurnal === "DISETUJUI").reduce((s, r) => s + r.beban, 0);

/** Baris jadwal yang sudah dijurnal tetapi jurnalnya belum disetujui (menahan pelepasan). */
export const jadwalMenunggu = (jadwal: BarisAset[]) => jadwal.filter((r) => r.jurnalNo && r.statusJurnal !== "DISETUJUI");
