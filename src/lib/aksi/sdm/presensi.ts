"use server";

/*
 * Server action presensi (use case: Rekap Presensi). Hanya HRD yang boleh mengelola presensi.
 * Aturan sama dengan app lama: satu catatan per karyawan per tanggal, terlambat dihitung dari jam masuk jadwal
 * jabatan, dan presensi terkunci setelah slip gaji periodenya diajukan atau dibayar.
 */
import { db, type Tx } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { catatLog } from "@/lib/server/log";
import { skemaIdPresensi, skemaPresensi } from "@/lib/skema/sdm";
import { hitungTerlambat } from "@/lib/inti/penggajian";
import { keDate, labelPeriode, periodeDari } from "@/lib/inti/tanggal";

async function pastikanBelumTerkunci(tx: Tx, karyawanKode: string, periode: string) {
  const slip = await tx.slipGaji.findUnique({ where: { periodeId_karyawanKode: { periodeId: periode, karyawanKode } }, select: { status: true } });
  if (slip && slip.status !== "DRAFT") {
    throw new GalatAksi(`Gaji ${labelPeriode(periode)} untuk karyawan ini sudah diajukan atau dibayar, jadi presensinya terkunci.`);
  }
}

export async function simpanPresensi(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["presensi.kelola"]);
    const d = validasi(skemaPresensi, input);
    const hadir = d.absensi === "HADIR";
    const periode = periodeDari(d.tanggal);

    await db.$transaction(async (tx) => {
      const karyawan = await tx.karyawan.findUnique({
        where: { kode: d.karyawanKode },
        select: { aktif: true, jenis: true, settingGaji: { select: { aktif: true, jabatan: { select: { jadwalKerja: { select: { kode: true, jamMasuk: true } } } } } } },
      });
      if (!karyawan || !karyawan.aktif) throw new GalatAksi("Karyawan tidak ditemukan atau sudah nonaktif.", { karyawanKode: "Karyawan tidak ditemukan." });
      if (karyawan.jenis !== "INHOUSE") throw new GalatAksi("Crew event tidak memakai presensi bulanan. Catat kehadirannya di menu Event & Kehadiran.", { karyawanKode: "Karyawan event." });
      const jadwal = karyawan.settingGaji?.aktif ? karyawan.settingGaji.jabatan.jadwalKerja : null;
      if (!jadwal) throw new GalatAksi("Karyawan ini belum punya Setting Gaji, atau jabatannya belum punya jadwal kerja.", { karyawanKode: "Setting gaji atau jadwal kerja belum ada." });

      await pastikanBelumTerkunci(tx, d.karyawanKode, periode);

      let lama: { karyawanKode: string; tanggal: Date } | null = null;
      if (d.id) {
        lama = await tx.presensi.findUnique({ where: { id: d.id }, select: { karyawanKode: true, tanggal: true } });
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
        jadwalKode: jadwal.kode,
        absensi: d.absensi,
        jamMasuk: hadir ? d.jamMasuk : null,
        jamKeluar: hadir ? d.jamKeluar : null,
        terlambat: hitungTerlambat(d.absensi, hadir ? d.jamMasuk : null, jadwal.jamMasuk),
      };
      if (d.id) {
        await tx.presensi.update({ where: { id: d.id }, data });
        await catatLog(tx, pengguna.id, "presensi.ubah", "presensi", String(d.id), `${d.karyawanKode} ${d.tanggal}`);
      } else {
        const baru = await tx.presensi.create({ data: { ...data, dibuatOlehId: pengguna.id }, select: { id: true } });
        await catatLog(tx, pengguna.id, "presensi.buat", "presensi", String(baru.id), `${d.karyawanKode} ${d.tanggal}`);
      }
    });

    segarkan();
    return { pesan: "Presensi tersimpan." };
  });
}

export async function hapusPresensi(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["presensi.kelola"]);
    const { id } = validasi(skemaIdPresensi, input);
    await db.$transaction(async (tx) => {
      const p = await tx.presensi.findUnique({ where: { id }, select: { karyawanKode: true, tanggal: true } });
      if (!p) throw new GalatAksi("Presensi tidak ditemukan atau sudah dihapus.");
      const tanggal = p.tanggal.toISOString().slice(0, 10);
      await pastikanBelumTerkunci(tx, p.karyawanKode, periodeDari(tanggal));
      await tx.presensi.delete({ where: { id } });
      await catatLog(tx, pengguna.id, "presensi.hapus", "presensi", String(id), `${p.karyawanKode} ${tanggal}`);
    });
    segarkan();
    return { pesan: "Presensi dihapus." };
  });
}
