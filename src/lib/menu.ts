/*
 * Peta menu sidebar (aman untuk klien). Urutan grup mengikuti siklus.
 * `peran` kosong = semua peran staf (Admin, HRD, Owner) boleh membuka halaman itu (aksi di dalamnya tetap dibatasi IZIN).
 * Kapten hanya melihat tautan yang menyebut KAPTEN secara eksplisit.
 */
import { IZIN, type Peran } from "@/lib/peran";

export type IkonMenu =
  | "dashboard" | "beli-alat" | "beli-lengkap" | "nilai-sisa" | "penyusutan" | "kartu-aset" | "pelepasan"
  | "presensi" | "hitung-gaji" | "distribusi" | "jurnal-penyesuaian" | "jurnal-umum" | "buku-besar" | "neraca-saldo"
  | "tutup-periode" | "master-konversi" | "master-sdm" | "pengguna" | "event" | "fee-event" | "penilaian" | "investasi-kas";

export type TautanMenu = { href: string; label: string; ikon: IkonMenu; peran?: readonly Peran[] };
export type GrupMenu = { kunci: string; judul: string; tautan: TautanMenu[] };

export const MENU: GrupMenu[] = [
  {
    kunci: "ringkasan",
    judul: "Ringkasan",
    tautan: [
      { href: "/", label: "Dashboard", ikon: "dashboard", peran: ["ADMIN", "HRD", "OWNER", "KAPTEN"] },
      // Satu-satunya menu kerja kapten, ditaruh di grup ringkasan supaya selalu terbuka.
      { href: "/kapten", label: "Penilaian Crew", ikon: "penilaian", peran: ["KAPTEN"] },
    ],
  },
  {
    // Modal pemilik ditaruh sebelum kedua siklus: kas yang dipakai siklus konversi dan SDM berasal dari setoran ini.
    kunci: "modal",
    judul: "Modal pemilik",
    tautan: [{ href: "/modal/investasi-kas", label: "Investasi Kas", ikon: "investasi-kas", peran: IZIN["investasi-kas.lihat"] }],
  },
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
    judul: "Siklus SDM: gaji inhouse (biaya tetap)",
    tautan: [
      { href: "/sdm/presensi", label: "Presensi", ikon: "presensi" },
      { href: "/sdm/hitung-gaji", label: "Hitung Gaji", ikon: "hitung-gaji" },
      { href: "/sdm/distribusi", label: "Distribusi Gaji", ikon: "distribusi" },
    ],
  },
  {
    kunci: "fee-event",
    judul: "Siklus SDM: fee event (biaya variabel)",
    tautan: [
      { href: "/fee-event/event", label: "Event & Kehadiran", ikon: "event" },
      { href: "/fee-event/keputusan", label: "Laporan & Fee", ikon: "fee-event" },
    ],
  },
  {
    kunci: "pelaporan",
    judul: "Jurnal & laporan",
    // Urut siklus akuntansi: jurnal umum, buku besar, neraca saldo, penyesuaian, lalu tutup periode.
    // Buku Besar dan Neraca Saldo punya pilihan tahap sebelum atau setelah penyesuaian di halamannya.
    tautan: [
      { href: "/pelaporan/jurnal-umum", label: "Jurnal Umum", ikon: "jurnal-umum" },
      { href: "/pelaporan/buku-besar", label: "Buku Besar", ikon: "buku-besar" },
      { href: "/pelaporan/neraca-saldo", label: "Neraca Saldo", ikon: "neraca-saldo" },
      { href: "/pelaporan/jurnal-penyesuaian", label: "Jurnal Penyesuaian", ikon: "jurnal-penyesuaian" },
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

/** true bila tautan menu tampil untuk peran ini. */
export const tampilUntuk = (t: TautanMenu, peran: Peran) => (t.peran ? t.peran.includes(peran) : peran !== "KAPTEN");

/** Tautan aktif bila jalurnya sama, atau jalur saat ini berada di bawahnya (kecuali "/"). */
export const aktifDi = (href: string, pathname: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
