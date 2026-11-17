/*
 * Bahan bersama halaman SDM: pemilihan periode lewat query string (?periode=2026-10).
 * Hanya untuk komponen server.
 */
import { db } from "@/lib/server/db";
import { POLA_PERIODE, periodeIni, tambahBulan } from "@/lib/inti/tanggal";

/**
 * Periode dari query string; bawaannya periode berjalan, sama dengan dashboard dan halaman lain.
 * Bulan lalu tetap ada di pilihan (lihat opsiPeriodeSdm), dan tautan dashboard membawa ?periode yang sedang dipilih.
 */
export function periodeDipilih(param?: string): string {
  if (param && POLA_PERIODE.test(param)) return param;
  return periodeIni();
}

/** Periode yang layak dipilih: bulan ini, bulan lalu, serta semua periode yang punya presensi, slip, atau penggajian. */
export async function opsiPeriodeSdm(terpilih: string): Promise<string[]> {
  const [presensi, slip, gaji] = await Promise.all([
    db.$queryRaw<{ p: string }[]>`select distinct to_char(tanggal, 'YYYY-MM') as p from presensi`,
    db.slipGaji.findMany({ distinct: ["periodeId"], select: { periodeId: true } }),
    db.penggajian.findMany({ distinct: ["periodeId"], select: { periodeId: true } }),
  ]);
  const semua = new Set<string>([terpilih, periodeIni(), tambahBulan(periodeIni(), -1)]);
  presensi.forEach((x) => semua.add(x.p));
  slip.forEach((x) => semua.add(x.periodeId));
  gaji.forEach((x) => semua.add(x.periodeId));
  return [...semua].sort().reverse();
}
