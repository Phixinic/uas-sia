/*
 * Format tampilan dan label enum. Aman untuk komponen klien.
 */
import type {
  AlasanPelepasan, CaraBayar, DasarN, JenisJurnal, JenisPembelian, StatusAset, StatusPembelian, StatusPeriode, StatusPersetujuan, TipeAkun, Absensi,
} from "@/generated/prisma/enums";

export { labelPeriode, labelTanggal } from "@/lib/inti/tanggal";
export { labelPtkp } from "@/lib/inti/penggajian";

const angkaId = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** 1234567 -> "1.234.567"; negatif memakai tanda minus asli (−). */
export function angka(n: number | null | undefined): string {
  const x = Math.round(n || 0);
  return (x < 0 ? "−" : "") + angkaId.format(Math.abs(x));
}

/** 1234567 -> "Rp1.234.567". */
export const rupiah = (n: number | null | undefined) => {
  const x = Math.round(n || 0);
  return (x < 0 ? "−Rp" : "Rp") + angkaId.format(Math.abs(x));
};

/** Date -> "16/11/2026 21.05" (zona Asia/Jakarta). */
export const labelWaktu = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" }).format(new Date(d)) : "-";

export const LABEL_STATUS_PERSETUJUAN: Record<StatusPersetujuan, string> = { DRAFT: "Draf", DIAJUKAN: "Diajukan", DISETUJUI: "Disetujui", DITOLAK: "Ditolak" };
export const LABEL_STATUS_PEMBELIAN: Record<StatusPembelian, string> = { DRAFT: "Draf", DIAJUKAN: "Diajukan", DISETUJUI: "Diposting", DITOLAK: "Ditolak", DIBALIK: "Dibalik" };
export const LABEL_STATUS_SLIP: Record<StatusPersetujuan, string> = { DRAFT: "Draf", DIAJUKAN: "Diajukan", DISETUJUI: "Dibayar", DITOLAK: "Ditolak" };
export const LABEL_STATUS_ASET: Record<StatusAset, string> = { AKTIF: "Aktif", DILEPAS: "Dilepas", BATAL: "Batal" };
export const LABEL_STATUS_PERIODE: Record<StatusPeriode, string> = { TERBUKA: "Terbuka", TERKUNCI: "Terkunci" };
export const LABEL_CARA_BAYAR: Record<CaraBayar, string> = { TUNAI: "Tunai", KREDIT: "Kredit", INVESTASI: "Investasi" };
export const LABEL_JENIS_PEMBELIAN: Record<JenisPembelian, string> = { PERALATAN: "Peralatan", PERLENGKAPAN: "Perlengkapan" };
export const LABEL_DASAR_N: Record<DasarN, string> = { GARANSI: "Garansi", MASA_MANFAAT: "Masa manfaat" };
export const LABEL_ALASAN_PELEPASAN: Record<AlasanPelepasan, string> = { DIJUAL: "Dijual", DIBUANG: "Dibuang / rusak", HILANG: "Hilang" };
export const LABEL_JENIS_JURNAL: Record<JenisJurnal, string> = { UMUM: "Umum", PENYESUAIAN: "Penyesuaian", PEMBALIK: "Pembalik" };
export const LABEL_TIPE_AKUN: Record<TipeAkun, string> = { ASET: "Aset", KONTRA_ASET: "Kontra aset", LIABILITAS: "Liabilitas", EKUITAS: "Ekuitas", PENDAPATAN: "Pendapatan", BEBAN: "Beban" };
export const LABEL_ABSENSI: Record<Absensi, string> = { HADIR: "Hadir", IZIN: "Izin", SAKIT: "Sakit", CUTI: "Cuti", ALPA: "Alpa" };
