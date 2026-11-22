/*
 * Logika fee event (crew freelance per event). Murni: tanpa database dan tanpa jam sistem, jadi bisa diuji langsung.
 * Konsepnya mengikuti app absen D'Production (dproabsent, src/lib/upah.js), disederhanakan untuk SIA:
 *
 * - Waktu dihitung per menit penuh dan selalu dipotong ke jadwal sesi:
 *     menit tercatat = maks(0, min(pulang, selesai sesi) - maks(masuk, mulai sesi)).
 *   Datang lebih awal atau pulang sesudah jadwal tidak dibayar. Lembur yang direncanakan dicatat dengan
 *   memperpanjang jam selesai sesi.
 * - Penilaian progres: SESUAI (atau belum dinilai) = menit tercatat diakui penuh; KURANG = menit yang diisi penilai,
 *   tetapi tidak pernah lebih dari menit tercatat.
 * - Tarif per JAM: fee = menit diakui x tarif per jam / 60, dibulatkan ke rupiah terdekat.
 *   Tarif per HARI: fee = jumlah tanggal berbeda yang punya menit diakui > 0 x tarif per hari.
 *   Bawaannya Kapten per hari dan Crew per jam (tarif ada di master jabatan event dan hanya diubah Owner).
 * - PPh 21 penerima penghasilan bukan pegawai (asumsi sederhana untuk tugas): DPP = 50% x bruto,
 *   PPh = DPP x 5% (tarif lapis pertama Pasal 17), tanpa PTKP dan tanpa akumulasi setahun.
 */
import { keMenit } from "./tanggal";

export type KodeSatuan = "HARI" | "JAM";
export type KodePeranEvent = "KAPTEN" | "CREW";
export type KodePenilaian = "SESUAI" | "KURANG";

export const TARIF_BAWAAN = { KAPTEN_PER_HARI: 200_000, CREW_PER_JAM: 20_000 } as const;
/** Jam kerja normal per sesi. Menit diakui di atasnya ditampilkan sebagai lembur, dibayar dengan tarif yang sama. */
export const JAM_NORMAL_SESI = 8;
/** PPh 21 bukan pegawai: DPP 50% dari bruto, tarif lapis pertama Pasal 17 sebesar 5%. */
export const PERSEN_DPP_BUKAN_PEGAWAI = 0.5;
export const TARIF_PPH_LAPIS_1 = 0.05;

export const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Durasi "H:MM" atau "HH:MM" untuk isian jam diakui, contoh "6:30". */
export const POLA_DURASI = /^(\d{1,2}):([0-5]\d)$/;

export type JadwalSesi = { jamMulai: string; jamSelesai: string };
export type CatatanJam = { jamMasuk: string; jamPulang: string };

/** Menit kerja yang tercatat di dalam jadwal sesi (menit penuh, tidak pernah negatif). */
export function menitTercatat(sesi: JadwalSesi, k: CatatanJam): number {
  const mulai = Math.max(keMenit(k.jamMasuk), keMenit(sesi.jamMulai));
  const selesai = Math.min(keMenit(k.jamPulang), keMenit(sesi.jamSelesai));
  return Math.max(0, selesai - mulai);
}

/** Menit maksimal yang boleh diakui penilai = menit tercatat yang sudah dipotong ke jadwal sesi. */
export const batasMenitDiakui = menitTercatat;

export type KehadiranHitung = CatatanJam & {
  sesi: JadwalSesi & { id: number; tanggal: string; nama?: string };
  penilaian: KodePenilaian | null;
  /** Hanya dipakai bila KURANG. */
  menitDiakui: number | null;
};

/** Menit yang diakui dari satu kehadiran: KURANG = isian penilai (dipotong ke menit tercatat), selain itu menit tercatat. */
export function menitDiakuiKehadiran(k: KehadiranHitung): number {
  const tercatat = menitTercatat(k.sesi, k);
  if (k.penilaian !== "KURANG") return tercatat;
  return Math.max(0, Math.min(Math.round(k.menitDiakui ?? 0), tercatat));
}

export const feeDariMenit = (menit: number, tarifPerJam: number) => Math.round((menit * tarifPerJam) / 60);

export type RincianSesiFee = {
  sesiId: number;
  tanggal: string;
  menitTercatat: number;
  menitDiakui: number;
  menitLembur: number;
  penilaian: KodePenilaian | null;
};

export type HasilFeeOrang = {
  satuanTarif: KodeSatuan;
  tarif: number;
  jumlahSesi: number;
  menitTercatat: number;
  menitDiakui: number;
  menitLembur: number;
  /** Tanggal berbeda yang punya menit diakui > 0 (dasar tarif per hari). */
  jumlahHari: number;
  /** Banyaknya kehadiran yang dinilai KURANG. */
  jumlahKurang: number;
  fee: number;
  sesi: RincianSesiFee[];
};

/** Usulan fee satu orang di satu event dari semua kehadirannya. */
export function hitungFeeOrang(input: { satuanTarif: KodeSatuan; tarif: number; kehadiran: KehadiranHitung[] }): HasilFeeOrang {
  const tarif = Math.max(0, Math.round(input.tarif || 0));
  const urut = [...input.kehadiran].sort((a, b) => a.sesi.tanggal.localeCompare(b.sesi.tanggal) || keMenit(a.sesi.jamMulai) - keMenit(b.sesi.jamMulai) || a.sesi.id - b.sesi.id);
  const sesi: RincianSesiFee[] = urut.map((k) => {
    const diakui = menitDiakuiKehadiran(k);
    return {
      sesiId: k.sesi.id,
      tanggal: k.sesi.tanggal,
      menitTercatat: menitTercatat(k.sesi, k),
      menitDiakui: diakui,
      menitLembur: Math.max(0, diakui - JAM_NORMAL_SESI * 60),
      penilaian: k.penilaian,
    };
  });
  const jumlah = (f: (r: RincianSesiFee) => number) => sesi.reduce((s, r) => s + f(r), 0);
  const menitDiakui = jumlah((r) => r.menitDiakui);
  const jumlahHari = new Set(sesi.filter((r) => r.menitDiakui > 0).map((r) => r.tanggal)).size;
  const fee = input.satuanTarif === "HARI" ? jumlahHari * tarif : feeDariMenit(menitDiakui, tarif);
  return {
    satuanTarif: input.satuanTarif,
    tarif,
    jumlahSesi: sesi.length,
    menitTercatat: jumlah((r) => r.menitTercatat),
    menitDiakui,
    menitLembur: jumlah((r) => r.menitLembur),
    jumlahHari,
    jumlahKurang: sesi.filter((r) => r.penilaian === "KURANG").length,
    fee,
    sesi,
  };
}

export type RincianPphBukanPegawai = { bruto: number; dpp: number; pph21: number; dibayar: number };

/** PPh 21 bukan pegawai (asumsi tugas): DPP = 50% bruto (dibulatkan), PPh = 5% DPP (dibulatkan), dibayar = bruto - PPh. */
export function pph21BukanPegawai(bruto: number): RincianPphBukanPegawai {
  const b = Math.max(0, Math.round(bruto || 0));
  const dpp = Math.round(b * PERSEN_DPP_BUKAN_PEGAWAI);
  const pph21 = Math.round(dpp * TARIF_PPH_LAPIS_1);
  return { bruto: b, dpp, pph21, dibayar: b - pph21 };
}

/** "6:30" -> 390 menit; null bila bentuknya salah. */
export function durasiKeMenit(teks: string): number | null {
  const m = POLA_DURASI.exec(String(teks ?? "").trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 390 -> "6:30". */
export const menitKeDurasi = (menit: number) => `${Math.floor(Math.max(0, menit) / 60)}:${String(Math.max(0, menit) % 60).padStart(2, "0")}`;

/** 450 -> "7 jam 30 menit", 480 -> "8 jam", 45 -> "45 menit", 0 -> "0 menit". */
export function labelDurasi(menit: number): string {
  const x = Math.max(0, Math.round(menit));
  const j = Math.floor(x / 60);
  const m = x % 60;
  if (!j) return `${m} menit`;
  return m ? `${j} jam ${m} menit` : `${j} jam`;
}
