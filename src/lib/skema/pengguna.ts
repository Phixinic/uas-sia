/*
 * Skema validasi kelola pengguna (hanya Owner).
 */
import { z } from "zod";
import { PANJANG_SANDI_MINIMUM } from "@/lib/server/kata-sandi";

const peran = z.enum(["ADMIN", "HRD", "OWNER"], { error: "Pilih peran." });
const sandi = z.string().min(PANJANG_SANDI_MINIMUM, `Kata sandi minimal ${PANJANG_SANDI_MINIMUM} karakter.`).max(100, "Kata sandi maksimal 100 karakter.");

export const skemaBuatPengguna = z.object({
  namaPengguna: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/, "Nama pengguna 3 sampai 30 karakter: huruf kecil, angka, titik, garis bawah, atau minus."),
  nama: z.string().trim().min(1, "Nama wajib diisi.").max(80, "Nama maksimal 80 karakter."),
  peran,
  kataSandi: sandi,
});

export const skemaUbahPengguna = z.object({
  id: z.coerce.number().int().positive(),
  nama: z.string().trim().min(1, "Nama wajib diisi.").max(80, "Nama maksimal 80 karakter."),
  peran,
});

export const skemaResetSandi = z.object({ id: z.coerce.number().int().positive(), kataSandi: sandi });
export const skemaStatusPengguna = z.object({ id: z.coerce.number().int().positive(), aktif: z.boolean() });
