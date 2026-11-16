import { db } from "@/lib/server/db";
import type { Peran } from "@/lib/peran";

export type DataPengguna = { id: number; namaPengguna: string; nama: string; peran: Peran; aktif: boolean; dibuatPada: string; sesiAktif: number };

export async function daftarPengguna(): Promise<DataPengguna[]> {
  const d = await db.pengguna.findMany({ orderBy: [{ aktif: "desc" }, { id: "asc" }], include: { _count: { select: { sesi: { where: { kedaluwarsa: { gt: new Date() } } } } } } });
  return d.map((x) => ({ id: x.id, namaPengguna: x.namaPengguna, nama: x.nama, peran: x.peran, aktif: x.aktif, dibuatPada: x.dibuatPada.toISOString(), sesiAktif: x._count.sesi }));
}
