/*
 * Kueri baca yang dipakai banyak halaman. Hanya untuk komponen server.
 */
import { cache } from "react";
import { db } from "@/lib/server/db";

export const profilUsaha = cache(async () => {
  const p = await db.profilUsaha.findUnique({ where: { id: 1 } });
  return { nama: p?.nama ?? "D'Production", keterangan: p?.keterangan ?? "SIA Konversi & SDM" };
});

/** Peta kode akun -> nama, untuk TabelJurnal dan label. */
export const petaAkun = cache(async (): Promise<Record<string, string>> => {
  const daftar = await db.akun.findMany({ select: { kode: true, nama: true } });
  return Object.fromEntries(daftar.map((a) => [a.kode, a.nama]));
});

/** Daftar periode yang terkunci ("YYYY-MM"). */
export const periodeTerkunciSemua = cache(async (): Promise<string[]> =>
  (await db.periode.findMany({ where: { status: "TERKUNCI" }, select: { id: true } })).map((p) => p.id),
);
