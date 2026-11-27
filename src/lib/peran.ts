/*
 * Peran dan aturan izin per aksi. Aman diimpor dari komponen klien (tanpa database).
 * Aturan ini sama dengan app lama (versi-statis). Pemeriksaan sesungguhnya ada di server lewat wajibPeran().
 */
import type { Peran } from "@/generated/prisma/enums";

export type { Peran };

export const LABEL_PERAN: Record<Peran, string> = { ADMIN: "Admin", HRD: "HRD", OWNER: "Owner", KAPTEN: "Kapten" };

/**
 * Peran staf kantor. Kapten (crew freelance) bukan staf: ia hanya boleh membuka dashboard dan halaman Penilaian Crew,
 * jadi halaman lain menolaknya lewat wajibMasuk() (lihat src/lib/server/auth.ts).
 */
export const PERAN_STAF = ["ADMIN", "HRD", "OWNER"] as const satisfies readonly Peran[];

/** Nama cookie sesi; dipakai juga oleh proxy.ts. */
export const NAMA_COOKIE_SESI = "sia_sesi";

/** Jalur yang boleh dibuka tanpa sesi. */
export const JALUR_PUBLIK = ["/masuk", "/api/sehat"] as const;
export const jalurPublik = (pathname: string) => JALUR_PUBLIK.some((j) => pathname === j || pathname.startsWith(`${j}/`));

/** Siapa yang boleh melakukan aksi apa. Kunci dipakai di server action (wajibPeran) dan di UI (boleh). */
export const IZIN = {
  // Modal pemilik (Investasi Kas). Halamannya hanya untuk Admin dan Owner; HRD dan Kapten tidak punya akses.
  "investasi-kas.lihat": ["ADMIN", "OWNER"],
  "investasi-kas.catat": ["ADMIN", "OWNER"],
  "investasi-kas.putuskan": ["OWNER"],
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
  // Fee event (crew freelance per event)
  "event.kelola": ["HRD", "OWNER"],
  "event.nilai": ["KAPTEN", "OWNER"],
  "event.lapor": ["KAPTEN"],
  "fee-event.putuskan": ["OWNER"],
  // Pelaporan
  "jurnal-penyesuaian.ajukan": ["ADMIN"],
  "jurnal-penyesuaian.putuskan": ["OWNER"],
  "periode.kunci": ["OWNER"],
  // Master
  "master-konversi.ubah": ["ADMIN", "OWNER"],
  "master-konversi.tambah-cepat": ["ADMIN"],
  // Karyawan dan jadwal kerja.
  "master-sdm.ubah": ["HRD", "OWNER"],
  // Urusan gaji: HRD mengajukan, Owner hanya memutuskan (setujui atau tolak).
  // Struktur gaji (jabatan inhouse, jabatan event, golongan, tunjangan): tambah dan ubah data hanya HRD, karena data baru
  // bernominal otomatis membuat pengajuan nominal awal. Menonaktifkan tetap Owner (master.nonaktifkan).
  "struktur-gaji.ubah": ["HRD"],
  // Setting gaji inhouse: setiap versi (setting awal, promosi, demosi, penyesuaian) diajukan lalu diputuskan Owner.
  "setting-gaji.ajukan": ["HRD"],
  "setting-gaji.putuskan": ["OWNER"],
  // Nominal master (gaji pokok, tunjangan, tunjangan jabatan, tarif jabatan event): setiap perubahan diajukan dengan bulan
  // berlaku lalu diputuskan Owner.
  "nominal.ajukan": ["HRD"],
  "nominal.putuskan": ["OWNER"],
  "master.akun-kategori": ["OWNER"],
  "master.nonaktifkan": ["OWNER"],
  "profil.ubah": ["OWNER"],
  "pengguna.kelola": ["OWNER"],
} as const satisfies Record<string, readonly Peran[]>;

export type KunciIzin = keyof typeof IZIN;

/** true bila peran boleh melakukan aksi. Untuk menampilkan atau menyembunyikan tombol. */
export const boleh = (peran: Peran | null | undefined, izin: KunciIzin) => !!peran && (IZIN[izin] as readonly Peran[]).includes(peran);
