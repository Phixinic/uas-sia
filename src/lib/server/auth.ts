/*
 * Sesi login berbasis database:
 * - cookie httpOnly hanya berisi token acak 256-bit; tabel sesi menyimpan SHA-256-nya.
 * - keluar = hapus baris sesi; menonaktifkan pengguna langsung memutus aksesnya.
 * Untuk halaman pakai wajibMasuk()/wajibPeranHalaman(); untuk server action pakai wajibPeran().
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/server/db";
import { GalatAksi } from "@/lib/server/aksi";
import { LABEL_PERAN, NAMA_COOKIE_SESI, type Peran } from "@/lib/peran";

const UMUR_SESI_MS = 7 * 24 * 60 * 60 * 1000;

export type PenggunaSesi = { id: number; namaPengguna: string; nama: string; peran: Peran };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function buatSesi(penggunaId: number) {
  const token = randomBytes(32).toString("base64url");
  const kedaluwarsa = new Date(Date.now() + UMUR_SESI_MS);
  await db.sesi.deleteMany({ where: { kedaluwarsa: { lt: new Date() } } });
  await db.sesi.create({ data: { tokenHash: hashToken(token), penggunaId, kedaluwarsa } });
  (await cookies()).set(NAMA_COOKIE_SESI, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_TIDAK_AMAN !== "1",
    expires: kedaluwarsa,
    path: "/",
  });
}

export async function hapusSesi() {
  const toko = await cookies();
  const token = toko.get(NAMA_COOKIE_SESI)?.value;
  if (token) await db.sesi.deleteMany({ where: { tokenHash: hashToken(token) } });
  toko.delete(NAMA_COOKIE_SESI);
}

/** Pengguna yang sedang masuk, atau null. Di-cache per permintaan. */
export const penggunaSaatIni = cache(async (): Promise<PenggunaSesi | null> => {
  const token = (await cookies()).get(NAMA_COOKIE_SESI)?.value;
  if (!token) return null;
  const sesi = await db.sesi.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { kedaluwarsa: true, pengguna: { select: { id: true, namaPengguna: true, nama: true, peran: true, aktif: true } } },
  });
  if (!sesi || sesi.kedaluwarsa < new Date() || !sesi.pengguna.aktif) return null;
  const { id, namaPengguna, nama, peran } = sesi.pengguna;
  return { id, namaPengguna, nama, peran };
});

/** Halaman: belum masuk -> /masuk. */
export async function wajibMasuk(): Promise<PenggunaSesi> {
  const p = await penggunaSaatIni();
  if (!p) redirect("/masuk");
  return p;
}

/** Halaman: peran tidak termasuk daftar -> /tanpa-akses. */
export async function wajibPeranHalaman(peran: readonly Peran[]): Promise<PenggunaSesi> {
  const p = await wajibMasuk();
  if (!peran.includes(p.peran)) redirect("/tanpa-akses");
  return p;
}

/**
 * Server action: melempar GalatAksi bila belum masuk atau peran tidak berhak.
 * Contoh: const p = await wajibPeran(IZIN["pembelian.posting"]);  atau  wajibPeran(["OWNER"])
 */
export async function wajibPeran(peran: readonly Peran[]): Promise<PenggunaSesi> {
  const p = await penggunaSaatIni();
  if (!p) throw new GalatAksi("Sesi sudah berakhir. Masuk lagi lalu ulangi.");
  if (!peran.includes(p.peran)) {
    throw new GalatAksi(`Aksi ini hanya untuk ${peran.map((x) => LABEL_PERAN[x]).join(" atau ")}. Kamu masuk sebagai ${LABEL_PERAN[p.peran]}.`);
  }
  return p;
}
