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
  LABA_PELEPASAN: "7-110",
  RUGI_PELEPASAN: "8-110",
} as const;

export type CaraBayar = "TUNAI" | "KREDIT" | "INVESTASI";

/** Akun lawan (kredit) pembelian menurut cara bayar. */
export const AKUN_LAWAN_BAYAR: Record<CaraBayar, string> = {
  TUNAI: AKUN.KAS,
  KREDIT: AKUN.UTANG_USAHA,
  INVESTASI: AKUN.MODAL,
};
