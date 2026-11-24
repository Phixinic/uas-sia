/*
 * Kode akun bawaan (bagan akun D'Production). Kode ini dipakai pembentuk jurnal sebagai nilai bawaan;
 * akun per kategori aset dan per jabatan tetap diambil dari data master.
 */
export const AKUN = {
  KAS: "1-110",
  PERLENGKAPAN: "1-140",
  PERALATAN: "1-150",
  AKUMULASI_PENYUSUTAN: "1-151",
  UTANG_USAHA: "2-110",
  UTANG_PPH21: "2-120",
  MODAL: "3-110",
  BIAYA_PENYUSUTAN: "6-110",
  BIAYA_PERLENGKAPAN: "6-120",
  BIAYA_GAJI_PRODUKSI: "6-210",
  BIAYA_GAJI_ADMINISTRASI: "6-220",
  BIAYA_FEE_EVENT: "6-230",
  /** Upah event karyawan inhouse yang dibayar lewat Gaji Bulanan (biaya variabel, PPh 21 pegawai). */
  BIAYA_UPAH_EVENT: "6-240",
  /** Bonus karyawan inhouse yang diisi manual di Gaji Bulanan. */
  BIAYA_BONUS: "6-250",
  LABA_PELEPASAN: "7-110",
  /** Potongan gaji karena denda (misalnya merusak alat): mengurangi THP dan menjadi pendapatan lain-lain. */
  PENDAPATAN_DENDA: "7-120",
  RUGI_PELEPASAN: "8-110",
} as const;

/** Akun yang ditambah untuk Gaji Bulanan (migrasi 20261125120000_upah_event_inhouse dan seed). */
export const AKUN_GAJI_BULANAN = [
  { kode: AKUN.BIAYA_UPAH_EVENT, nama: "Biaya Upah Event Karyawan", tipe: "BEBAN", saldoNormal: "D" },
  { kode: AKUN.BIAYA_BONUS, nama: "Biaya Bonus Karyawan", tipe: "BEBAN", saldoNormal: "D" },
  { kode: AKUN.PENDAPATAN_DENDA, nama: "Pendapatan Lain-lain (Denda Karyawan)", tipe: "PENDAPATAN", saldoNormal: "K" },
] as const;

export type CaraBayar = "TUNAI" | "KREDIT" | "INVESTASI";

/** Akun lawan (kredit) pembelian menurut cara bayar. */
export const AKUN_LAWAN_BAYAR: Record<CaraBayar, string> = {
  TUNAI: AKUN.KAS,
  KREDIT: AKUN.UTANG_USAHA,
  INVESTASI: AKUN.MODAL,
};
