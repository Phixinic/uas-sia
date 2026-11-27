/*
 * Format tampilan dan label enum. Aman untuk komponen klien.
 */
import type {
  AlasanPelepasan, CaraBayar, DasarN, JenisJurnal, JenisPembelian, StatusAset, StatusPembelian, StatusPeriode, StatusPersetujuan, TipeAkun, Absensi,
  HasilPenilaian, JenisKaryawan, PeranEvent, SatuanTarif, StatusEvent, SumberInvestasi,
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
/** Jurnal dan revisi nilai sisa: DITOLAK berarti dikembalikan ke Admin untuk direvisi, bukan tolak final. */
export const LABEL_STATUS_REVISI: Record<StatusPersetujuan, string> = { DRAFT: "Draf", DIAJUKAN: "Menunggu Owner", DISETUJUI: "Disetujui", DITOLAK: "Dikembalikan" };
export const LABEL_STATUS_SLIP: Record<StatusPersetujuan, string> = { DRAFT: "Draf", DIAJUKAN: "Diajukan", DISETUJUI: "Dibayar", DITOLAK: "Ditolak" };
export const LABEL_STATUS_ASET: Record<StatusAset, string> = { AKTIF: "Aktif", DILEPAS: "Dilepas", BATAL: "Batal" };
export const LABEL_STATUS_PERIODE: Record<StatusPeriode, string> = { TERBUKA: "Terbuka", TERKUNCI: "Terkunci" };
export const LABEL_CARA_BAYAR: Record<CaraBayar, string> = { TUNAI: "Tunai", KREDIT: "Kredit", INVESTASI: "Investasi" };
export const LABEL_SUMBER_INVESTASI: Record<SumberInvestasi, string> = { PEMILIK: "Pemilik", INVESTOR: "Investor", HIBAH: "Hibah" };
/** Pengganti nama supplier bila pembelian Investasi tidak punya supplier. */
export const TANPA_SUPPLIER: Record<SumberInvestasi, string> = { PEMILIK: "Setoran pemilik", INVESTOR: "Setoran investor", HIBAH: "Hibah barang" };

/** "Tunai", "Kredit", atau "Investasi (Investor)". Investasi tanpa sumber (data sebelum kolomnya ada) = Pemilik. */
export const labelCaraBayar = (caraBayar: CaraBayar, sumber?: SumberInvestasi | null) =>
  caraBayar === "INVESTASI" ? `${LABEL_CARA_BAYAR.INVESTASI} (${LABEL_SUMBER_INVESTASI[sumber ?? "PEMILIK"]})` : LABEL_CARA_BAYAR[caraBayar];

/** Nama supplier, atau asal barang untuk pembelian Investasi tanpa supplier. */
export const namaSupplierAtauSumber = (supplier: string | null | undefined, sumber?: SumberInvestasi | null) => supplier ?? TANPA_SUPPLIER[sumber ?? "PEMILIK"];
export const LABEL_JENIS_PEMBELIAN: Record<JenisPembelian, string> = { PERALATAN: "Peralatan", PERLENGKAPAN: "Perlengkapan" };
export const LABEL_DASAR_N: Record<DasarN, string> = { GARANSI: "Garansi", MASA_MANFAAT: "Masa manfaat" };
export const LABEL_ALASAN_PELEPASAN: Record<AlasanPelepasan, string> = { DIJUAL: "Dijual", DIBUANG: "Dibuang / rusak", HILANG: "Hilang" };
export const LABEL_JENIS_JURNAL: Record<JenisJurnal, string> = { UMUM: "Umum", PENYESUAIAN: "Penyesuaian", PEMBALIK: "Pembalik" };
export const LABEL_TIPE_AKUN: Record<TipeAkun, string> = { ASET: "Aset", KONTRA_ASET: "Kontra aset", LIABILITAS: "Liabilitas", EKUITAS: "Ekuitas", PENDAPATAN: "Pendapatan", BEBAN: "Beban" };
export const LABEL_ABSENSI: Record<Absensi, string> = { HADIR: "Hadir", IZIN: "Izin", SAKIT: "Sakit", CUTI: "Cuti", ALPA: "Alpa" };
export const LABEL_JENIS_KARYAWAN: Record<JenisKaryawan, string> = { INHOUSE: "Inhouse (gaji bulanan)", EVENT: "Event (fee per event)" };
export const LABEL_PERAN_EVENT: Record<PeranEvent, string> = { KAPTEN: "Kapten", CREW: "Crew" };
export const LABEL_SATUAN_TARIF: Record<SatuanTarif, string> = { HARI: "per hari", JAM: "per jam" };
export const LABEL_STATUS_EVENT: Record<StatusEvent, string> = { PENILAIAN: "Penilaian kapten", DIAJUKAN: "Menunggu Owner", SELESAI: "Selesai, dibayar" };
export const LABEL_PENILAIAN: Record<HasilPenilaian, string> = { SESUAI: "Sesuai", KURANG: "Kurang" };
