"use server";

/*
 * Masuk dan keluar. Login memakai nama pengguna + kata sandi; percobaan gagal dibatasi per nama pengguna
 * (5 kali dalam 10 menit, disimpan di memori proses, cukup untuk satu server kecil).
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { buatSesi, hapusSesi, penggunaSaatIni } from "@/lib/server/auth";
import { cocokKataSandi, HASH_TIRUAN } from "@/lib/server/kata-sandi";
import { catatLog } from "@/lib/server/log";
import { tujuanAman } from "@/lib/inti/tujuan";

export type StatusMasuk = { galat: string | null };

const skemaMasuk = z.object({
  namaPengguna: z.string().trim().toLowerCase().min(1, "Isi nama pengguna.").max(50),
  kataSandi: z.string().min(1, "Isi kata sandi.").max(200),
  kembali: z.string().optional(),
});

const BATAS_GAGAL = 5;
const JENDELA_MS = 10 * 60 * 1000;
const gagal = new Map<string, { n: number; sejak: number }>();

export async function masuk(_sebelumnya: StatusMasuk, fd: FormData): Promise<StatusMasuk> {
  const h = skemaMasuk.safeParse(Object.fromEntries(fd));
  if (!h.success) return { galat: h.error.issues[0].message };
  const { namaPengguna, kataSandi, kembali } = h.data;

  const catatan = gagal.get(namaPengguna);
  if (catatan && Date.now() - catatan.sejak < JENDELA_MS && catatan.n >= BATAS_GAGAL) {
    return { galat: "Terlalu banyak percobaan gagal. Tunggu 10 menit lalu coba lagi." };
  }

  const p = await db.pengguna.findUnique({ where: { namaPengguna } });
  const cocok = await cocokKataSandi(kataSandi, p?.kataSandiHash ?? HASH_TIRUAN);
  if (!p || !cocok || !p.aktif) {
    const c = catatan && Date.now() - catatan.sejak < JENDELA_MS ? catatan : { n: 0, sejak: Date.now() };
    gagal.set(namaPengguna, { n: c.n + 1, sejak: c.sejak });
    return { galat: p && cocok && !p.aktif ? "Akun ini dinonaktifkan. Hubungi Owner." : "Nama pengguna atau kata sandi salah." };
  }
  gagal.delete(namaPengguna);
  await buatSesi(p.id);
  await catatLog(db, p.id, "auth.masuk", "pengguna", String(p.id));
  // Hanya jalur internal yang boleh jadi tujuan, supaya tidak bisa dipakai mengalihkan ke situs lain.
  redirect(tujuanAman(kembali));
}

export async function keluar() {
  const p = await penggunaSaatIni();
  await hapusSesi();
  if (p) await catatLog(db, p.id, "auth.keluar", "pengguna", String(p.id));
  redirect("/masuk");
}
