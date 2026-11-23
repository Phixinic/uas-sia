/*
 * Riwayat setting gaji (logika murni, tanpa database). Setiap versi setting gaji punya bulan berlaku dan status
 * persetujuan. Hitung Gaji periode P memakai versi DISETUJUI dengan berlaku mulai <= P yang paling akhir.
 * Pengaman pengajuan dan persetujuan juga dihitung di sini supaya server action, halaman, dan tes memakai aturan yang sama.
 */
import { labelPeriode, tambahBulan } from "./tanggal";

export type JenisPerubahan = "SETTING_AWAL" | "PROMOSI" | "DEMOSI" | "PENYESUAIAN";
export type StatusVersi = "DRAFT" | "DIAJUKAN" | "DISETUJUI" | "DITOLAK";

export const LABEL_JENIS_PERUBAHAN: Record<JenisPerubahan, string> = {
  SETTING_AWAL: "Setting awal",
  PROMOSI: "Promosi",
  DEMOSI: "Demosi",
  PENYESUAIAN: "Penyesuaian",
};

export type VersiRingkas = {
  kode: string;
  status: StatusVersi;
  /** Periode "YYYY-MM". */
  berlakuMulai: string;
  diputuskanPada: Date | string | null;
  /** Kolom lama setting_gaji.aktif; versi nonaktif tidak berlaku. Bawaan aktif. */
  aktif?: boolean;
};

const waktu = (x: Date | string | null) => (x ? new Date(x).getTime() : 0);

/**
 * Urutan versi disetujui dari yang paling menentukan: berlaku mulai terbesar, lalu diputuskan paling akhir, lalu kode.
 * Dua versi disetujui dengan bulan berlaku sama = koreksi; yang diputuskan belakangan menggantikan yang lama.
 */
export function bandingVersi(a: VersiRingkas, b: VersiRingkas): number {
  if (a.berlakuMulai !== b.berlakuMulai) return a.berlakuMulai < b.berlakuMulai ? 1 : -1;
  const w = waktu(b.diputuskanPada) - waktu(a.diputuskanPada);
  if (w !== 0) return w;
  return b.kode.localeCompare(a.kode);
}

/** Versi yang berlaku di periode: DISETUJUI, berlaku mulai <= periode, paling akhir. null bila belum ada (atau nonaktif). */
export function pilihVersiBerlaku<T extends VersiRingkas>(versi: readonly T[], periode: string): T | null {
  const kandidat = versi.filter((v) => v.status === "DISETUJUI" && v.berlakuMulai <= periode).sort(bandingVersi);
  const v = kandidat[0] ?? null;
  return v && v.aktif === false ? null : v;
}

/**
 * Label keadaan tiap versi di riwayat SATU karyawan: versi disetujui yang sudah tidak pernah berlaku lagi karena ada versi
 * disetujui lain dengan bulan berlaku sama yang diputuskan belakangan ditandai "digantikan".
 */
export function versiDigantikan<T extends VersiRingkas>(versi: readonly T[]): Set<string> {
  const hasil = new Set<string>();
  const disetujui = versi.filter((v) => v.status === "DISETUJUI");
  for (const v of disetujui) {
    const lebihBaru = disetujui.some((x) => x.kode !== v.kode && x.berlakuMulai === v.berlakuMulai && bandingVersi(x, v) < 0);
    if (lebihBaru) hasil.add(v.kode);
  }
  return hasil;
}

export type SlipRingkas = { no: string; periode: string; status: StatusVersi };

export type HasilPengaman = {
  /** Pesan penolakan, atau null bila bulan berlaku boleh dipakai. */
  galat: string | null;
  /** Slip draf di bulan berlaku atau sesudahnya: tetap ada, tetapi perlu dihitung ulang sesudah versi disetujui. */
  drafTerdampak: SlipRingkas[];
  /** Bulan berlaku paling awal yang masih boleh (sesudah slip diajukan atau dibayar terakhir), null bila bebas. */
  palingAwal: string | null;
};

/**
 * Pengaman bulan berlaku untuk satu karyawan (dipakai saat mengajukan dan saat menyetujui):
 * 1. karyawan belum boleh punya slip DIAJUKAN atau DISETUJUI di bulan berlaku atau sesudahnya;
 * 2. bulan berlaku tidak boleh lebih awal dari versi yang sudah dipakai slip non-draf (slip terakhir yang dibekukan);
 * 3. slip draf di bulan berlaku atau sesudahnya dilaporkan sebagai "perlu dihitung ulang".
 * Cek periode terbuka dilakukan terpisah di server (pastikanTerbuka).
 */
export function pengamanBerlaku(berlaku: string, slip: readonly SlipRingkas[], versi: readonly VersiRingkas[]): HasilPengaman {
  const beku = slip.filter((s) => s.status === "DIAJUKAN" || s.status === "DISETUJUI").sort((a, b) => a.periode.localeCompare(b.periode));
  const terakhir = beku.at(-1) ?? null;
  const palingAwal = terakhir ? tambahBulan(terakhir.periode, 1) : null;
  const drafTerdampak = slip.filter((s) => s.status === "DRAFT" && s.periode >= berlaku).sort((a, b) => a.periode.localeCompare(b.periode));

  const bentrok = beku.filter((s) => s.periode >= berlaku);
  if (bentrok.length) {
    const b = bentrok[0];
    const kata = b.status === "DISETUJUI" ? "sudah dibayar" : "sudah diajukan ke Owner";
    return {
      galat: `Gaji ${labelPeriode(b.periode)} karyawan ini ${kata} (${b.no}), jadi setting baru paling awal berlaku ${labelPeriode(palingAwal)}.`,
      drafTerdampak,
      palingAwal,
    };
  }
  if (terakhir) {
    const dipakai = pilihVersiBerlaku(versi, terakhir.periode);
    if (dipakai && berlaku < dipakai.berlakuMulai) {
      return {
        galat: `Bulan berlaku tidak boleh lebih awal dari ${labelPeriode(dipakai.berlakuMulai)}, versi ${dipakai.kode} yang sudah dipakai slip ${terakhir.no}.`,
        drafTerdampak,
        palingAwal,
      };
    }
  }
  return { galat: null, drafTerdampak, palingAwal };
}

/** Isi satu versi untuk dibandingkan dan dicatat di log (nilai lama dan baru). */
export type IsiVersi = {
  jabatanKode: string;
  jabatan: string;
  golonganKode: string;
  golongan: string;
  gajiPokok: number;
  tunjJabatan: number;
  tunjangan: { kode: string; nama: string; nominal: number }[];
  berlakuMulai: string;
};

/** true bila jabatan, golongan, dan daftar tunjangan sama (bulan berlaku tidak dibandingkan). */
export function isiSama(a: Pick<IsiVersi, "jabatanKode" | "golonganKode" | "tunjangan">, b: Pick<IsiVersi, "jabatanKode" | "golonganKode" | "tunjangan">): boolean {
  const ta = a.tunjangan.map((t) => t.kode).sort().join(",");
  const tb = b.tunjangan.map((t) => t.kode).sort().join(",");
  return a.jabatanKode === b.jabatanKode && a.golonganKode === b.golonganKode && ta === tb;
}

const rp = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

/** Ringkasan satu versi untuk log: "JBT-03 Operator, GP-02 Golongan II Rp4.500.000, tunj. jabatan Rp500.000, tunjangan [Transport Rp300.000], berlaku Desember 2026". */
export function ringkasVersi(v: IsiVersi | null): string {
  if (!v) return "(belum ada)";
  const tunj = v.tunjangan.length ? v.tunjangan.map((t) => `${t.nama} ${rp(t.nominal)}`).join(", ") : "tanpa tunjangan lain";
  return `${v.jabatanKode} ${v.jabatan}, ${v.golonganKode} ${v.golongan} ${rp(v.gajiPokok)}, tunj. jabatan ${rp(v.tunjJabatan)}, tunjangan [${tunj}], berlaku ${labelPeriode(v.berlakuMulai)}`;
}

/** Keterangan log ajukan, setujui, dan tolak: nilai lama (versi yang berlaku di bulan itu) dan nilai baru. */
export function keteranganLog(jenis: JenisPerubahan, lama: IsiVersi | null, baru: IsiVersi, tambahan?: string): string {
  return [`${LABEL_JENIS_PERUBAHAN[jenis]}. Lama: ${ringkasVersi(lama)}.`, `Baru: ${ringkasVersi(baru)}.`, tambahan].filter(Boolean).join(" ");
}
