/*
 * Peta menu sidebar (aman untuk klien). Urutan grup mengikuti siklus.
 * `peran` kosong = semua peran boleh membuka halaman itu (aksi di dalamnya tetap dibatasi IZIN).
 */
import type { Peran } from "@/lib/peran";

export type IkonMenu =
  | "dashboard" | "beli-alat" | "beli-lengkap" | "nilai-sisa" | "penyusutan" | "kartu-aset" | "pelepasan"
  | "presensi" | "hitung-gaji" | "distribusi" | "jurnal-penyesuaian" | "jurnal-umum" | "buku-besar" | "neraca-saldo"
  | "tutup-periode" | "master-konversi" | "master-sdm" | "pengguna";

export type TautanMenu = { href: string; label: string; ikon: IkonMenu; peran?: readonly Peran[] };
export type GrupMenu = { kunci: string; judul: string; tautan: TautanMenu[] };

export const MENU: GrupMenu[] = [
  { kunci: "ringkasan", judul: "Ringkasan", tautan: [{ href: "/", label: "Dashboard", ikon: "dashboard" }] },
  {
    kunci: "konversi",
    judul: "Siklus konversi",
    tautan: [
      { href: "/konversi/pembelian-peralatan", label: "Pembelian Peralatan", ikon: "beli-alat" },
      { href: "/konversi/pembelian-perlengkapan", label: "Pembelian Perlengkapan", ikon: "beli-lengkap" },
      { href: "/konversi/nilai-sisa", label: "Nilai Sisa Perlengkapan", ikon: "nilai-sisa" },
      { href: "/konversi/penyusutan", label: "Proses Penyusutan", ikon: "penyusutan" },
      { href: "/konversi/kartu-aset", label: "Kartu Aset", ikon: "kartu-aset" },
      { href: "/konversi/pelepasan", label: "Pelepasan Peralatan", ikon: "pelepasan" },
    ],
  },
  {
    kunci: "sdm",
    judul: "Siklus SDM",
    tautan: [
      { href: "/sdm/presensi", label: "Presensi", ikon: "presensi" },
      { href: "/sdm/hitung-gaji", label: "Hitung Gaji", ikon: "hitung-gaji" },
      { href: "/sdm/distribusi", label: "Distribusi Gaji", ikon: "distribusi" },
    ],
  },
  {
    kunci: "pelaporan",
    judul: "Jurnal & laporan",
    tautan: [
      { href: "/pelaporan/jurnal-penyesuaian", label: "Jurnal Penyesuaian", ikon: "jurnal-penyesuaian" },
      { href: "/pelaporan/jurnal-umum", label: "Jurnal Umum", ikon: "jurnal-umum" },
      { href: "/pelaporan/buku-besar", label: "Buku Besar", ikon: "buku-besar" },
      { href: "/pelaporan/neraca-saldo", label: "Neraca Saldo", ikon: "neraca-saldo" },
      { href: "/pelaporan/tutup-periode", label: "Tutup Periode", ikon: "tutup-periode" },
    ],
  },
  {
    kunci: "pengaturan",
    judul: "Pengaturan",
    tautan: [
      { href: "/master/konversi", label: "Master Konversi", ikon: "master-konversi" },
      { href: "/master/sdm", label: "Master SDM", ikon: "master-sdm" },
      { href: "/pengguna", label: "Pengguna", ikon: "pengguna", peran: ["OWNER"] },
    ],
  },
];

/** Tautan aktif bila jalurnya sama, atau jalur saat ini berada di bawahnya (kecuali "/"). */
export const aktifDi = (href: string, pathname: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
