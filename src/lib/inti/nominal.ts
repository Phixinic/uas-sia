/*
 * Riwayat nominal master (logika murni, tanpa database): gaji pokok golongan, nominal tunjangan, tunjangan jabatan dan
 * tunjangan istri/anak jabatan inhouse, dan tarif jabatan event. Setiap perubahan adalah versi baru dengan bulan berlaku
 * yang diajukan lalu diputuskan Owner. Nominal berlaku di periode P dipilih dengan aturan yang sama dengan setting gaji
 * (pilihVersiBerlaku): versi DISETUJUI dengan berlaku mulai <= P yang paling akhir.
 * Pengaman pengajuan dan persetujuan juga dihitung di sini supaya server action, halaman, dan tes memakai aturan yang sama.
 */
import { labelPeriode, tambahBulan } from "./tanggal";
import { pilihVersiBerlaku, type StatusVersi } from "./setting-gaji";

export type JenisNominal = "GOLONGAN" | "TUNJANGAN" | "JABATAN" | "JABATAN_EVENT";
export const JENIS_NOMINAL = ["GOLONGAN", "TUNJANGAN", "JABATAN", "JABATAN_EVENT"] as const satisfies readonly JenisNominal[];

/** Nama komponen untuk teks layar dan log. */
export const LABEL_JENIS_NOMINAL: Record<JenisNominal, string> = {
  GOLONGAN: "Gaji pokok",
  TUNJANGAN: "Tunjangan",
  JABATAN: "Tunjangan jabatan",
  JABATAN_EVENT: "Tarif event",
};

/** Isi nominal satu versi. JABATAN memakai tunjJabatan dan tunjKeluarga; jenis lain memakai nominal. */
export type IsiNominal = { nominal: number; tunjJabatan: number; tunjKeluarga: number };

export type VersiNominalRingkas = IsiNominal & {
  kode: string;
  jenis: JenisNominal;
  /** Kode golongan, tunjangan, atau jabatan. */
  itemKode: string;
  status: StatusVersi;
  berlakuMulai: string;
  diputuskanPada: Date | string | null;
};

/** Kunci peta per item: jenis JABATAN dan JABATAN_EVENT sama-sama memakai kode jabatan, jadi jenis ikut di kunci. */
export const kunciItem = (jenis: JenisNominal, itemKode: string) => `${jenis}:${itemKode}`;

/**
 * Peta versi nominal per item. `pada(jenis, kode, periode)` = versi DISETUJUI yang berlaku di periode itu, atau null bila
 * item belum punya nominal berlaku (misalnya master baru yang nominal awalnya masih menunggu Owner).
 */
export type PetaNominal<T extends VersiNominalRingkas = VersiNominalRingkas> = {
  pada(jenis: JenisNominal, itemKode: string, periode: string): T | null;
  /** Semua versi satu item (semua status), urut berlaku mulai lalu waktu pengajuan. */
  riwayat(jenis: JenisNominal, itemKode: string): T[];
};

export function buatPetaNominal<T extends VersiNominalRingkas>(versi: readonly T[]): PetaNominal<T> {
  const per = new Map<string, T[]>();
  for (const v of versi) {
    const k = kunciItem(v.jenis, v.itemKode);
    per.set(k, [...(per.get(k) ?? []), v]);
  }
  return {
    pada: (jenis, itemKode, periode) => pilihVersiBerlaku(per.get(kunciItem(jenis, itemKode)) ?? [], periode),
    riwayat: (jenis, itemKode) => [...(per.get(kunciItem(jenis, itemKode)) ?? [])].sort((a, b) => a.berlakuMulai.localeCompare(b.berlakuMulai)),
  };
}

/** true bila isi nominal dua versi sama (untuk menolak pengajuan yang tidak mengubah apa pun). */
export function nominalSama(jenis: JenisNominal, a: IsiNominal, b: IsiNominal): boolean {
  if (jenis === "JABATAN") return a.tunjJabatan === b.tunjJabatan && a.tunjKeluarga === b.tunjKeluarga;
  return a.nominal === b.nominal;
}

const rp = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

/** Isi nominal sebagai teks: "Rp4.500.000", jabatan "tunjangan jabatan Rp500.000, istri/anak Rp250.000", tarif "Rp20.000/jam". */
export function teksNominal(jenis: JenisNominal, v: IsiNominal, satuanTarif?: "HARI" | "JAM" | null): string {
  if (jenis === "JABATAN") return `tunjangan jabatan ${rp(v.tunjJabatan)}, istri/anak ${rp(v.tunjKeluarga)}`;
  if (jenis === "JABATAN_EVENT") return `${rp(v.nominal)}${satuanTarif === "HARI" ? "/hari" : satuanTarif === "JAM" ? "/jam" : ""}`;
  return rp(v.nominal);
}

/** Sumber komponen untuk slip dan Hitung Gaji: "Gaji pokok Golongan II, berlaku mulai Desember 2026 (NOM-0021)". */
export function labelSumberVersi(jenis: JenisNominal, namaItem: string, versi: { kode: string; berlakuMulai: string } | null): string {
  if (!versi) return `${LABEL_JENIS_NOMINAL[jenis]} ${namaItem}, nominal sebelum riwayat (tanpa versi)`;
  return `${LABEL_JENIS_NOMINAL[jenis]} ${namaItem}, berlaku mulai ${labelPeriode(versi.berlakuMulai)} (${versi.kode})`;
}

/** Ringkasan satu versi untuk log: "GP-02 Golongan II: Rp4.500.000, berlaku Oktober 2026 (NOM-0002)". */
export function ringkasNominal(jenis: JenisNominal, itemKode: string, namaItem: string, v: (IsiNominal & { kode?: string; berlakuMulai: string }) | null, satuanTarif?: "HARI" | "JAM" | null): string {
  if (!v) return "(belum ada nominal berlaku)";
  return `${itemKode} ${namaItem}: ${teksNominal(jenis, v, satuanTarif)}, berlaku ${labelPeriode(v.berlakuMulai)}${v.kode ? ` (${v.kode})` : ""}`;
}

/** Dokumen terkunci yang memakai item (slip gaji DIAJUKAN atau DISETUJUI, atau laporan fee DIAJUKAN atau DISETUJUI). */
export type DokumenBeku = { no: string; periode: string; status: StatusVersi; jenisDokumen: "SLIP" | "LAPORAN_FEE" };

export type HasilPengamanNominal = {
  /** Pesan penolakan, atau null bila bulan berlaku boleh dipakai. */
  galat: string | null;
  /** Bulan berlaku paling awal yang masih boleh (sesudah dokumen terkunci terakhir yang memakai item ini), null bila bebas. */
  palingAwal: string | null;
};

/**
 * Pengaman bulan berlaku perubahan nominal (dipakai saat mengajukan dan saat menyetujui): tidak boleh ada slip gaji
 * DIAJUKAN atau DISETUJUI yang memakai item ini (tarif: laporan fee DIAJUKAN atau DISETUJUI) di bulan berlaku atau
 * sesudahnya, karena angka dokumen itu sudah dikunci. Cek periode terbuka dilakukan terpisah di server (pastikanTerbuka).
 */
export function pengamanNominal(berlaku: string, beku: readonly DokumenBeku[]): HasilPengamanNominal {
  const urut = [...beku].sort((a, b) => a.periode.localeCompare(b.periode) || a.no.localeCompare(b.no));
  const terakhir = urut.at(-1) ?? null;
  const palingAwal = terakhir ? tambahBulan(terakhir.periode, 1) : null;
  const bentrok = urut.find((d) => d.periode >= berlaku);
  if (!bentrok) return { galat: null, palingAwal };
  const dok = bentrok.jenisDokumen === "SLIP" ? "Slip gaji" : "Laporan fee";
  const kata = bentrok.status === "DISETUJUI" ? (bentrok.jenisDokumen === "SLIP" ? "sudah dibayar" : "sudah disetujui") : "sudah diajukan ke Owner";
  return {
    galat: `${dok} ${labelPeriode(bentrok.periode)} yang memakai nominal ini ${kata} (${bentrok.no}), jadi perubahan nominal paling awal berlaku ${labelPeriode(palingAwal)}.`,
    palingAwal,
  };
}

/** Keterangan log ajukan, setujui, dan tolak: nilai lama (versi yang berlaku di bulan itu) dan nilai baru. */
export function keteranganLogNominal(
  jenis: JenisNominal,
  itemKode: string,
  namaItem: string,
  lama: (IsiNominal & { kode?: string; berlakuMulai: string }) | null,
  baru: IsiNominal & { kode?: string; berlakuMulai: string },
  tambahan?: string,
  satuanTarif?: "HARI" | "JAM" | null,
): string {
  return [
    `${LABEL_JENIS_NOMINAL[jenis]}.`,
    `Lama: ${ringkasNominal(jenis, itemKode, namaItem, lama, satuanTarif)}.`,
    `Baru: ${ringkasNominal(jenis, itemKode, namaItem, baru, satuanTarif)}.`,
    tambahan,
  ].filter(Boolean).join(" ");
}

/**
 * Sidik versi komponen satu slip gaji: versi setting, versi gaji pokok, versi nominal jabatan, dan versi tiap tunjangan.
 * Dua sidik berbeda = slip dihitung dengan versi yang sekarang sudah tidak berlaku (perlu dihitung ulang).
 */
export function sidikVersiSlip(x: { settingKode: string | null; versiGajiPokokKode: string | null; versiJabatanKode: string | null; tunjangan: { kode: string; versiKode: string | null }[] }): string {
  const tunj = [...x.tunjangan].sort((a, b) => a.kode.localeCompare(b.kode)).map((t) => `${t.kode}=${t.versiKode ?? "-"}`).join(",");
  return [x.settingKode ?? "-", x.versiGajiPokokKode ?? "-", x.versiJabatanKode ?? "-", tunj].join("|");
}
