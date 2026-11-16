/*
 * Konvensi server action (lihat docs/KONTRAK.md):
 *   export async function namaAksi(input: unknown): Promise<HasilAksi> {
 *     return aksiAman(async () => {
 *       const pengguna = await wajibPeran(IZIN["kunci.izin"]);
 *       const data = validasi(skema, input);
 *       await db.$transaction(async (tx) => { ... });
 *       segarkan();
 *       return { pesan: "..." };
 *     });
 *   }
 * Galat bisnis dilempar sebagai GalatAksi (pesannya tampil ke pengguna). Galat lain dicatat di log server
 * dan pengguna hanya melihat pesan umum, supaya detail database tidak bocor.
 */
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { GalatJurnal } from "@/lib/inti/jurnal";
import { GalatPenyusutan } from "@/lib/inti/penyusutan";

export type HasilAksi<T = undefined> =
  | { ok: true; pesan: string; data?: T }
  | { ok: false; galat: string; galatIsian?: Record<string, string> };

/** Galat yang pesannya aman dan memang ditujukan ke pengguna. */
export class GalatAksi extends Error {
  constructor(pesan: string, public galatIsian?: Record<string, string>) {
    super(pesan);
  }
}

export async function aksiAman<T = undefined>(fn: () => Promise<{ pesan: string; data?: T }>): Promise<HasilAksi<T>> {
  try {
    const h = await fn();
    return { ok: true, pesan: h.pesan, data: h.data };
  } catch (e) {
    unstable_rethrow(e); // redirect() dan notFound() harus diteruskan ke Next
    if (e instanceof GalatAksi) return { ok: false, galat: e.message, galatIsian: e.galatIsian };
    if (e instanceof GalatJurnal || e instanceof GalatPenyusutan) return { ok: false, galat: e.message };
    const kode = (e as { code?: string })?.code;
    if (kode === "P2002") return { ok: false, galat: "Data dengan kunci yang sama sudah ada." };
    if (kode === "P2003") return { ok: false, galat: "Data ini masih dipakai data lain." };
    if (kode === "P2034") return { ok: false, galat: "Data sedang diubah pengguna lain. Coba lagi." };
    console.error("[aksi] galat tak terduga", e);
    return { ok: false, galat: "Terjadi kesalahan di server. Coba lagi, atau hubungi admin bila berulang." };
  }
}

/** Validasi input dengan zod. Gagal -> GalatAksi berisi pesan pertama dan peta galat per isian. */
export function validasi<S extends z.ZodType>(skema: S, input: unknown): z.infer<S> {
  const h = skema.safeParse(input);
  if (h.success) return h.data;
  const galatIsian: Record<string, string> = {};
  for (const isu of h.error.issues) {
    const kunci = isu.path.join(".");
    if (!(kunci in galatIsian)) galatIsian[kunci] = isu.message;
  }
  throw new GalatAksi(h.error.issues[0]?.message ?? "Isian tidak valid.", galatIsian);
}

/** Muat ulang data semua halaman sesudah perubahan (aplikasi kecil, jadi cukup satu panggilan). */
export function segarkan() {
  revalidatePath("/", "layout");
}
