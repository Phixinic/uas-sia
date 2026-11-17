/*
 * Periode akuntansi bulanan. Baris periode dibuat otomatis saat pertama dipakai (status TERBUKA).
 *
 * Kunci periode berurutan (lihat aksi tutup periode): periode P hanya boleh dikunci bila semua periode sebelumnya
 * sudah terkunci, dan hanya boleh dibuka bila tidak ada periode sesudahnya yang terkunci. Karena itu P dianggap
 * tertutup bila P sendiri atau periode sesudahnya terkunci. Semua jalur posting dan persetujuan memakai
 * pastikanTerbuka, jadi dokumen bertanggal 30 Oktober ditolak selama November terkunci (saldo November tidak
 * bisa berubah), termasuk bulan yang belum punya baris periode.
 *
 * Kunci advisory Postgres menyerialkan kunci/buka periode terhadap posting: posting memegang kunci bersama
 * sampai transaksinya selesai, kunci/buka periode memegang kunci eksklusif. Jadi periode tidak bisa dikunci
 * di tengah posting yang sudah lolos pemeriksaan, dan dua aksi kunci/buka tidak bisa saling menyalip.
 */
import type { DbAtauTx } from "@/lib/server/db";
import { GalatAksi } from "@/lib/server/aksi";
import { labelPeriode } from "@/lib/inti/tanggal";

/** Ditulis langsung di SQL (bukan parameter) supaya Postgres memilih fungsi bigint tanpa ambigu. */
export async function tahanKunciPeriode(tx: DbAtauTx, eksklusif = false) {
  if (eksklusif) await tx.$executeRaw`SELECT pg_advisory_xact_lock(7410001)`;
  else await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(7410001)`;
}

export async function pastikanPeriode(tx: DbAtauTx, ...periode: string[]) {
  const unik = [...new Set(periode)];
  if (unik.length) await tx.periode.createMany({ data: unik.map((id) => ({ id })), skipDuplicates: true });
}

/** Periode terkunci paling awal yang >= periode, yaitu penutup periode itu. null bila periode masih terbuka. */
export async function kunciPenutupDb(tx: DbAtauTx, periode: string): Promise<string | null> {
  const p = await tx.periode.findFirst({ where: { id: { gte: periode }, status: "TERKUNCI" }, orderBy: { id: "asc" }, select: { id: true } });
  return p?.id ?? null;
}

/** Pesan penolakan untuk periode tertutup, atau null bila periode masih terbuka. */
export async function pesanPeriodeTertutup(tx: DbAtauTx, periode: string): Promise<string | null> {
  const penutup = await kunciPenutupDb(tx, periode);
  if (!penutup) return null;
  if (penutup === periode) return `Periode ${labelPeriode(periode)} sudah dikunci. Minta Owner membuka kunci dulu.`;
  return `Periode ${labelPeriode(periode)} sudah tertutup karena periode sesudahnya (${labelPeriode(penutup)}) sudah dikunci. Minta Owner membuka kunci periode itu dulu.`;
}

/**
 * Melempar GalatAksi bila periode tertutup (terkunci, atau ada periode sesudahnya yang terkunci), lalu memastikan
 * baris periodenya ada. Wajib dipanggil di dalam transaksi supaya kunci bersamanya bertahan sampai commit.
 */
export async function pastikanTerbuka(tx: DbAtauTx, periode: string, galatIsian?: Record<string, string>) {
  await tahanKunciPeriode(tx);
  const pesan = await pesanPeriodeTertutup(tx, periode);
  if (pesan) throw new GalatAksi(pesan, galatIsian);
  await pastikanPeriode(tx, periode);
}
