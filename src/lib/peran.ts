/*
 * Peran dan aturan izin per aksi. Aman diimpor dari komponen klien (tanpa database).
 * Aturan ini sama dengan app lama (versi-statis). Pemeriksaan sesungguhnya ada di server lewat wajibPeran().
 */
import type { Peran } from "@/generated/prisma/enums";

export type { Peran };

export const LABEL_PERAN: Record<Peran, string> = { ADMIN: "Admin", HRD: "HRD", OWNER: "Owner" };

/** Nama cookie sesi; dipakai juga oleh proxy.ts. */
export const NAMA_COOKIE_SESI = "sia_sesi";

/** Jalur yang boleh dibuka tanpa sesi. */
export const JALUR_PUBLIK = ["/masuk", "/api/sehat"] as const;
export const jalurPublik = (pathname: string) => JALUR_PUBLIK.some((j) => pathname === j || pathname.startsWith(`${j}/`));

/** Siapa yang boleh melakukan aksi apa. Kunci dipakai di server action (wajibPeran) dan di UI (boleh). */
export const IZIN = {
  // Siklus konversi
  "pembelian.kelola-draf": ["ADMIN"],
  "pembelian.posting": ["ADMIN", "OWNER"],
  "pembelian.balik": ["OWNER"],
  "nilai-sisa.input": ["ADMIN"],
  "penyusutan.proses": ["ADMIN"],
  "pelepasan.ajukan": ["ADMIN"],
  "pelepasan.putuskan": ["OWNER"],
  // Siklus SDM
  "presensi.kelola": ["HRD"],
  "gaji.hitung": ["HRD"],
  "penggajian.ajukan": ["HRD"],
  "penggajian.putuskan": ["OWNER"],
  // Pelaporan
  "jurnal-penyesuaian.ajukan": ["ADMIN"],
  "jurnal-penyesuaian.putuskan": ["OWNER"],
  "periode.kunci": ["OWNER"],
  // Master
  "master-konversi.ubah": ["ADMIN", "OWNER"],
  "master-konversi.tambah-cepat": ["ADMIN"],
  "master-sdm.ubah": ["HRD", "OWNER"],
  "master.akun-kategori": ["OWNER"],
  "master.nonaktifkan": ["OWNER"],
  "profil.ubah": ["OWNER"],
  "pengguna.kelola": ["OWNER"],
} as const satisfies Record<string, readonly Peran[]>;

export type KunciIzin = keyof typeof IZIN;

/** true bila peran boleh melakukan aksi. Untuk menampilkan atau menyembunyikan tombol. */
export const boleh = (peran: Peran | null | undefined, izin: KunciIzin) => !!peran && (IZIN[izin] as readonly Peran[]).includes(peran);
