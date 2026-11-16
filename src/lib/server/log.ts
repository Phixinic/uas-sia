import type { DbAtauTx } from "@/lib/server/db";

/** Catat aktivitas yang mengubah data. Panggil di dalam transaksi yang sama dengan perubahannya. */
export async function catatLog(
  tx: DbAtauTx,
  penggunaId: number | null,
  aksi: string,
  entitas: string,
  entitasId: string | null,
  keterangan?: string,
) {
  await tx.logAktivitas.create({ data: { penggunaId, aksi, entitas, entitasId, keterangan } });
}
