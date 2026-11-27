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
  /** Barang yang disetor investor lewat pembelian cara bayar Investasi. */
  MODAL_INVESTOR: "3-120",
  /** Barang hibah lewat pembelian cara bayar Investasi. */
  MODAL_HIBAH: "3-130",
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

/** Akun modal untuk sumber investasi selain pemilik (migrasi 20261127090000_sumber_investasi dan seed). */
export const AKUN_MODAL_TAMBAHAN = [
  { kode: AKUN.MODAL_INVESTOR, nama: "Modal Investor", tipe: "EKUITAS", saldoNormal: "K" },
  { kode: AKUN.MODAL_HIBAH, nama: "Modal Hibah", tipe: "EKUITAS", saldoNormal: "K" },
] as const;

export type CaraBayar = "TUNAI" | "KREDIT" | "INVESTASI";
export type SumberInvestasi = "PEMILIK" | "INVESTOR" | "HIBAH";

/** Akun modal lawan pembelian cara bayar Investasi, menurut sumbernya. */
export const AKUN_SUMBER_INVESTASI: Record<SumberInvestasi, string> = {
  PEMILIK: AKUN.MODAL,
  INVESTOR: AKUN.MODAL_INVESTOR,
  HIBAH: AKUN.MODAL_HIBAH,
};

/** Semua akun modal yang ditelusuri ringkasan "Dari mana kas dan modal", urut kode. */
export const AKUN_MODAL_SEMUA: readonly string[] = [AKUN.MODAL, AKUN.MODAL_INVESTOR, AKUN.MODAL_HIBAH];

/**
 * Akun lawan (kredit) pembelian: Tunai ke Kas, Kredit ke Utang Usaha, Investasi ke akun modal sumbernya.
 * Sumber kosong pada Investasi dianggap Pemilik (perilaku sebelum ada pilihan sumber).
 */
export function akunLawanBayar(caraBayar: CaraBayar, sumber?: SumberInvestasi | null): string {
  if (caraBayar === "TUNAI") return AKUN.KAS;
  if (caraBayar === "KREDIT") return AKUN.UTANG_USAHA;
  return AKUN_SUMBER_INVESTASI[sumber ?? "PEMILIK"];
}
