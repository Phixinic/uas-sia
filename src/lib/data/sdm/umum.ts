/*
 * Bahan bersama halaman SDM: pemilihan periode lewat query string (?bulan=10&tahun=2026).
 * Hanya untuk komponen server.
 */
import { db } from "@/lib/server/db";
import { periodeDariCari, periodeIni, tambahBulan } from "@/lib/inti/tanggal";

/** Parameter periode di URL: bentuk baru ?bulan=&tahun=, bentuk lama ?periode= (dialihkan proxy). */
export type CariPeriode = { periode?: string; bulan?: string; tahun?: string };

/**
 * Periode dari query string; bawaannya periode berjalan, sama dengan dashboard dan halaman lain.
 * Bulan lalu tetap ada di pilihan (lihat opsiPeriodeSdm), dan tautan dashboard membawa ?periode yang sedang dipilih.
 */
export function periodeDipilih(cari: CariPeriode): string {
  const p = periodeDariCari(cari);
  return p && p !== "semua" ? p : periodeIni();
}

/**
 * Periode yang bisa dipilih di halaman SDM: semua baris tabel periode, bulan ini, bulan lalu, bulan depan, dan semua periode
 * yang punya presensi, slip, penggajian, atau mulai berlakunya setting gaji. Pemilih menampilkan Tahun sendiri dan bulan
 * mengikuti tahun yang dipilih.
 */
export async function opsiPeriodeSdm(terpilih: string): Promise<string[]> {
  const [presensi, slip, gaji, setting, periode] = await Promise.all([
    db.$queryRaw<{ p: string }[]>`select distinct to_char(tanggal, 'YYYY-MM') as p from presensi`,
    db.slipGaji.findMany({ distinct: ["periodeId"], select: { periodeId: true } }),
    db.penggajian.findMany({ distinct: ["periodeId"], select: { periodeId: true } }),
    db.settingGaji.findMany({ where: { status: "DISETUJUI" }, distinct: ["berlakuMulai"], select: { berlakuMulai: true } }),
    // Semua baris periode (termasuk yang dibuat jadwal penyusutan bertahun-tahun ke depan), jadi tiap tahun bisa dibuka.
    db.periode.findMany({ select: { id: true } }),
  ]);
  const semua = new Set<string>([terpilih, periodeIni(), tambahBulan(periodeIni(), -1), tambahBulan(periodeIni(), 1)]);
  setting.forEach((x) => semua.add(x.berlakuMulai));
  periode.forEach((x) => semua.add(x.id));
  presensi.forEach((x) => semua.add(x.p));
  slip.forEach((x) => semua.add(x.periodeId));
  gaji.forEach((x) => semua.add(x.periodeId));
  return [...semua].sort().reverse();
}
