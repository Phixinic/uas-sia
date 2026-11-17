/*
 * Fungsi tanggal dan periode tanpa ketergantungan. Tanggal berbentuk "YYYY-MM-DD", periode "YYYY-MM".
 * Semua perhitungan memakai kalender (bukan jam), jadi aman dari geser zona waktu.
 */

export const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"] as const;

const pad = (n: number, k = 2) => String(n).padStart(k, "0");

/** Periode dari tanggal: "2026-10-05" -> "2026-10". */
export const periodeDari = (tanggal: string) => String(tanggal || "").slice(0, 7);

/** Geser periode k bulan: tambahBulan("2026-10", 3) -> "2027-01". */
export function tambahBulan(periode: string, k: number): string {
  let y = +periode.slice(0, 4);
  let m = +periode.slice(5, 7) + k;
  y += Math.floor((m - 1) / 12);
  m = (((m - 1) % 12) + 12) % 12 + 1;
  return `${y}-${pad(m)}`;
}

/** Tanggal terakhir periode: "2026-02" -> "2026-02-28". */
export function hariTerakhir(periode: string): string {
  const hari = new Date(Date.UTC(+periode.slice(0, 4), +periode.slice(5, 7), 0)).getUTCDate();
  return `${periode}-${pad(hari)}`;
}

/** Tanggal + k bulan dengan aturan Date JS (31 Jan + 1 bulan = 3 Mar), sama dengan app lama. */
export function tambahBulanTanggal(tanggal: string, k: number): string {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + k);
  return d.toISOString().slice(0, 10);
}

export function tambahHari(tanggal: string, k: number): string {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + k);
  return d.toISOString().slice(0, 10);
}

/** Daftar periode dari a sampai b (inklusif), paling banyak 120. */
export function daftarPeriode(a: string, b: string): string[] {
  if (!a || !b || a > b) return [b || a].filter(Boolean);
  const hasil: string[] = [];
  for (let x = a; x <= b && hasil.length < 120; x = tambahBulan(x, 1)) hasil.push(x);
  return hasil;
}

/**
 * Kunci periode berurutan: periode P tertutup bila P sendiri atau periode sesudahnya sudah dikunci.
 * Mengembalikan periode terkunci paling awal yang >= P (penutupnya), atau null bila P masih terbuka.
 */
export function kunciPenutup(periode: string, terkunci: readonly string[]): string | null {
  let hasil: string | null = null;
  for (const p of terkunci) if (p >= periode && (hasil === null || p < hasil)) hasil = p;
  return hasil;
}

/** "2026-10" -> "Oktober 2026". */
export const labelPeriode = (periode: string | null | undefined) =>
  periode ? `${NAMA_BULAN[+periode.slice(5, 7) - 1]} ${periode.slice(0, 4)}` : "-";

/** "2026-10-05" -> "05/10/2026". */
export const labelTanggal = (tanggal: string | null | undefined) =>
  tanggal ? `${tanggal.slice(8, 10)}/${tanggal.slice(5, 7)}/${tanggal.slice(0, 4)}` : "-";

/** "08:30" -> 510 menit. */
export function keMenit(jam: string | null | undefined): number {
  if (!jam) return 0;
  const [h, m] = String(jam).split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Tanggal hari ini di zona Asia/Jakarta, "YYYY-MM-DD". */
export function hariIni(sekarang = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(sekarang);
}

export const periodeIni = (sekarang = new Date()) => periodeDari(hariIni(sekarang));

export const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
export const POLA_PERIODE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "2026-10-05" -> Date UTC tengah malam (untuk kolom @db.Date). */
export const keDate = (tanggal: string) => new Date(`${tanggal}T00:00:00Z`);

/** Date dari kolom @db.Date -> "2026-10-05". */
export const dariDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
