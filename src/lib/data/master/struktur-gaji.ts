/*
 * Kueri tab Struktur gaji di Master SDM: jabatan inhouse, jabatan event, golongan (gaji pokok), dan tunjangan lain
 * dalam satu halaman, beserta pemakaiannya oleh setting gaji yang berlaku bulan berjalan.
 * Baris tiap jenis diambil dari daftarMaster supaya kolom dan nilai form sama dengan tab master lain.
 */
import { db } from "@/lib/server/db";
import { periodeIni } from "@/lib/inti/tanggal";
import { daftarMaster, type DaftarMaster } from "./master";
import { dataSettingGaji } from "./setting-gaji";
import type { JenisStruktur } from "@/lib/skema/master";

export type RingkasJabatan = { kode: string; nama: string; aktif: boolean; karyawan: number; brutoMin: number | null; brutoMaks: number | null };
export type RingkasGolongan = { kode: string; nama: string; aktif: boolean; jumlah: number; karyawan: number };

export type DataStrukturGaji = {
  periode: string;
  daftar: Record<JenisStruktur, DaftarMaster>;
  /** Pemakaian per kode master oleh setting gaji yang berlaku (karyawan inhouse aktif). */
  pemakaian: Record<"jabatan" | "golongan" | "tunjangan", Record<string, number>>;
  /** Jadwal kerja per kode jabatan inhouse, sudah diformat (jam kerja dan hari kerja dipisah supaya tabel tidak melebar). */
  jadwal: Record<string, { jam: string; hari: string }>;
  ringkasJabatan: RingkasJabatan[];
  ringkasGolongan: RingkasGolongan[];
  /** Karyawan inhouse aktif, dan berapa yang punya setting gaji berlaku bulan berjalan. */
  karyawanAktif: number;
  karyawanBersetting: number;
};

const tambah = (peta: Record<string, number>, kode: string) => {
  peta[kode] = (peta[kode] ?? 0) + 1;
};

export async function dataStrukturGaji(periode = periodeIni()): Promise<DataStrukturGaji> {
  const [jabatan, jabatanEvent, golongan, tunjangan, jadwalKerja, golonganDb, setting] = await Promise.all([
    daftarMaster("jabatan"),
    daftarMaster("jabatanEvent"),
    daftarMaster("golongan"),
    daftarMaster("tunjangan"),
    db.jadwalKerja.findMany({ select: { jabatanKode: true, jamMasuk: true, jamKeluar: true, hariKerja: true, aktif: true } }),
    db.golongan.findMany({ orderBy: { kode: "asc" }, select: { kode: true, nama: true, aktif: true, jumlah: true } }),
    dataSettingGaji(periode),
  ]);

  // Setting yang berlaku bulan berjalan, hanya karyawan inhouse yang masih aktif (logika sama dengan halaman Setting Gaji).
  const aktif = setting.baris.filter((b) => b.aktif);
  const berlaku = aktif.flatMap((b) => (b.aktifSekarang ? [b.aktifSekarang] : []));
  const pemakaian = { jabatan: {} as Record<string, number>, golongan: {} as Record<string, number>, tunjangan: {} as Record<string, number> };
  const bruto = new Map<string, number[]>();
  for (const v of berlaku) {
    tambah(pemakaian.jabatan, v.jabatanKode);
    tambah(pemakaian.golongan, v.golonganKode);
    for (const t of v.tunjanganKodes) tambah(pemakaian.tunjangan, t);
    bruto.set(v.jabatanKode, [...(bruto.get(v.jabatanKode) ?? []), v.estimasiBruto]);
  }

  const jadwal: Record<string, { jam: string; hari: string }> = {};
  for (const j of jadwalKerja) jadwal[j.jabatanKode] = { jam: `${j.jamMasuk} sampai ${j.jamKeluar}`, hari: `${j.hariKerja} hari/bulan${j.aktif ? "" : " (nonaktif)"}` };

  return {
    periode,
    daftar: { jabatan, jabatanEvent, golongan, tunjangan },
    pemakaian,
    jadwal,
    ringkasJabatan: jabatan.baris.map((b) => {
      const n = bruto.get(b.kode) ?? [];
      return { kode: b.kode, nama: b.nama, aktif: b.aktif, karyawan: n.length, brutoMin: n.length ? Math.min(...n) : null, brutoMaks: n.length ? Math.max(...n) : null };
    }),
    ringkasGolongan: golonganDb.map((g) => ({ kode: g.kode, nama: g.nama, aktif: g.aktif, jumlah: g.jumlah, karyawan: pemakaian.golongan[g.kode] ?? 0 })),
    karyawanAktif: aktif.length,
    karyawanBersetting: berlaku.length,
  };
}
