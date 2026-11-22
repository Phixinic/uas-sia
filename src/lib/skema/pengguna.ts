/*
 * Skema validasi kelola pengguna (hanya Owner).
 */
import { z } from "./zod";
import { PANJANG_SANDI_MINIMUM } from "@/lib/server/kata-sandi";

const peran = z.enum(["ADMIN", "HRD", "OWNER", "KAPTEN"], { error: "Pilih peran." });
/** Hanya untuk peran KAPTEN: karyawan berjenis Event yang dipegang akun ini (dicek di server). */
const karyawanKode = z.string({ error: "Pilih crew." }).trim().optional().nullable();
const idPengguna = z.coerce.number({ error: "Pengguna tidak valid." }).int("Pengguna tidak valid.").positive("Pengguna tidak valid.");
const sandi = z.string({ error: "Isi kata sandi." }).min(PANJANG_SANDI_MINIMUM, `Kata sandi minimal ${PANJANG_SANDI_MINIMUM} karakter.`).max(100, "Kata sandi maksimal 100 karakter.");

export const skemaBuatPengguna = z.object({
  namaPengguna: z.string({ error: "Isi nama pengguna." }).trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/, "Nama pengguna 3 sampai 30 karakter: huruf kecil, angka, titik, garis bawah, atau minus."),
  nama: z.string({ error: "Nama wajib diisi." }).trim().min(1, "Nama wajib diisi.").max(80, "Nama maksimal 80 karakter."),
  peran,
  karyawanKode,
  kataSandi: sandi,
});

export const skemaUbahPengguna = z.object({
  id: idPengguna,
  nama: z.string({ error: "Nama wajib diisi." }).trim().min(1, "Nama wajib diisi.").max(80, "Nama maksimal 80 karakter."),
  peran,
  karyawanKode,
});

export const skemaResetSandi = z.object({ id: idPengguna, kataSandi: sandi });
export const skemaStatusPengguna = z.object({ id: idPengguna, aktif: z.boolean({ error: "Status aktif tidak valid." }) });
