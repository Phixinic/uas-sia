import { db } from "@/lib/server/db";
import type { Peran } from "@/lib/peran";

export type DataPengguna = { id: number; namaPengguna: string; nama: string; peran: Peran; aktif: boolean; dibuatPada: string; sesiAktif: number; karyawanKode: string | null; karyawan: string | null };

export async function daftarPengguna(): Promise<DataPengguna[]> {
  const d = await db.pengguna.findMany({ orderBy: [{ aktif: "desc" }, { id: "asc" }], include: { karyawan: { select: { nama: true } }, _count: { select: { sesi: { where: { kedaluwarsa: { gt: new Date() } } } } } } });
  return d.map((x) => ({ id: x.id, namaPengguna: x.namaPengguna, nama: x.nama, peran: x.peran, aktif: x.aktif, dibuatPada: x.dibuatPada.toISOString(), sesiAktif: x._count.sesi, karyawanKode: x.karyawanKode, karyawan: x.karyawan?.nama ?? null }));
}

/** Karyawan berjenis Event yang bisa ditautkan ke akun kapten (yang sudah punya akun ditandai). */
export async function opsiKaryawanKapten(): Promise<{ kode: string; nama: string; aktif: boolean; akun: string | null }[]> {
  const d = await db.karyawan.findMany({ where: { jenis: "EVENT" }, orderBy: { kode: "asc" }, select: { kode: true, nama: true, aktif: true, pengguna: { select: { namaPengguna: true } } } });
  return d.map((k) => ({ kode: k.kode, nama: k.nama, aktif: k.aktif, akun: k.pengguna?.namaPengguna ?? null }));
}
