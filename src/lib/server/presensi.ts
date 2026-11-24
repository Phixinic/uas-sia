/*
 * Layanan presensi (dipanggil server action dan skrip seed). Satu catatan per karyawan per tanggal, terlambat dihitung
 * dari jam masuk jadwal kerja jabatan (kolom di tabel jabatan) pada versi setting gaji yang berlaku di bulan itu, dan
 * presensi terkunci setelah gaji bulan itu diajukan atau dibayar.
 */
import type { Tx } from "@/lib/server/db";
import { GalatAksi } from "@/lib/server/aksi";
import { catatLog } from "@/lib/server/log";
import { hitungTerlambat } from "@/lib/inti/penggajian";
import { keDate, labelPeriode, periodeDari } from "@/lib/inti/tanggal";
import { versiBerlakuPeriode } from "@/lib/data/sdm/gaji";
import type { z } from "zod";
import type { skemaPresensi } from "@/lib/skema/sdm";

export async function pastikanBelumTerkunci(tx: Tx, karyawanKode: string, periode: string) {
  const slip = await tx.slipGaji.findUnique({ where: { periodeId_karyawanKode: { periodeId: periode, karyawanKode } }, select: { status: true } });
  if (slip && slip.status !== "DRAFT") {
    throw new GalatAksi(`Gaji ${labelPeriode(periode)} untuk karyawan ini sudah diajukan atau dibayar, jadi presensinya terkunci.`);
  }
}

export async function simpanPresensiDalam(tx: Tx, penggunaId: number, d: z.infer<typeof skemaPresensi>) {
  const hadir = d.absensi === "HADIR";
  const periode = periodeDari(d.tanggal);
  const karyawan = await tx.karyawan.findUnique({ where: { kode: d.karyawanKode }, select: { aktif: true, jenis: true } });
  if (!karyawan || !karyawan.aktif) throw new GalatAksi("Karyawan tidak ditemukan atau sudah nonaktif.", { karyawanKode: "Karyawan tidak ditemukan." });
  if (karyawan.jenis !== "INHOUSE") throw new GalatAksi("Crew event tidak memakai presensi bulanan. Catat kehadirannya di menu Event & Kehadiran.", { karyawanKode: "Karyawan event." });
  // Jadwal kerja mengikuti jabatan di versi setting gaji yang berlaku pada bulan tanggal presensi.
  const [versi] = await versiBerlakuPeriode(tx, periode, d.karyawanKode);
  if (!versi) throw new GalatAksi(`Karyawan ini belum punya setting gaji yang disetujui dan berlaku di ${labelPeriode(periode)}.`, { karyawanKode: "Belum ada setting gaji berlaku di bulan ini." });
  const jab = versi.jabatan;
  if (!jab.jamMasuk) throw new GalatAksi("Jabatan karyawan ini belum punya jadwal kerja.", { karyawanKode: "Jadwal kerja belum ada." });

  await pastikanBelumTerkunci(tx, d.karyawanKode, periode);

  if (d.id) {
    const lama = await tx.presensi.findUnique({ where: { id: d.id }, select: { karyawanKode: true, tanggal: true } });
    if (!lama) throw new GalatAksi("Presensi tidak ditemukan.");
    await pastikanBelumTerkunci(tx, lama.karyawanKode, periodeDari(lama.tanggal.toISOString().slice(0, 10)));
  }

  const bentrok = await tx.presensi.findUnique({ where: { karyawanKode_tanggal: { karyawanKode: d.karyawanKode, tanggal: keDate(d.tanggal) } }, select: { id: true } });
  if (bentrok && bentrok.id !== (d.id ?? null)) {
    throw new GalatAksi("Presensi karyawan ini pada tanggal tersebut sudah ada.", { tanggal: "Sudah ada presensi pada tanggal ini." });
  }

  const data = {
    karyawanKode: d.karyawanKode,
    tanggal: keDate(d.tanggal),
    jabatanKode: jab.kode,
    absensi: d.absensi,
    jamMasuk: hadir ? d.jamMasuk : null,
    jamKeluar: hadir ? d.jamKeluar : null,
    terlambat: hitungTerlambat(d.absensi, hadir ? d.jamMasuk : null, jab.jamMasuk),
  };
  if (d.id) {
    await tx.presensi.update({ where: { id: d.id }, data });
    await catatLog(tx, penggunaId, "presensi.ubah", "presensi", String(d.id), `${d.karyawanKode} ${d.tanggal}`);
    return d.id;
  }
  const baru = await tx.presensi.create({ data: { ...data, dibuatOlehId: penggunaId }, select: { id: true } });
  await catatLog(tx, penggunaId, "presensi.buat", "presensi", String(baru.id), `${d.karyawanKode} ${d.tanggal}`);
  return baru.id;
}
