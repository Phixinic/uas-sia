/*
 * Periode akuntansi bulanan. Baris periode dibuat otomatis saat pertama dipakai (status TERBUKA).
 * Periode TERKUNCI menolak semua dokumen dan jurnal baru bertanggal di dalamnya.
 */
import type { DbAtauTx } from "@/lib/server/db";
import { GalatAksi } from "@/lib/server/aksi";
import { labelPeriode } from "@/lib/inti/tanggal";

export async function pastikanPeriode(tx: DbAtauTx, ...periode: string[]) {
  const unik = [...new Set(periode)];
  if (unik.length) await tx.periode.createMany({ data: unik.map((id) => ({ id })), skipDuplicates: true });
}

export async function periodeTerkunci(tx: DbAtauTx, periode: string): Promise<boolean> {
  const p = await tx.periode.findUnique({ where: { id: periode }, select: { status: true } });
  return p?.status === "TERKUNCI";
}

/** Melempar GalatAksi bila periode terkunci, lalu memastikan baris periodenya ada. */
export async function pastikanTerbuka(tx: DbAtauTx, periode: string) {
  if (await periodeTerkunci(tx, periode)) throw new GalatAksi(`Periode ${labelPeriode(periode)} sudah dikunci. Minta Owner membuka kunci dulu.`);
  await pastikanPeriode(tx, periode);
}
