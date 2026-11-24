"use server";

/*
 * Server action presensi (use case: Rekap Presensi). Hanya HRD yang boleh mengelola presensi.
 * Aturannya di src/lib/server/presensi.ts (dipakai juga seed).
 */
import { db } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { catatLog } from "@/lib/server/log";
import { pastikanBelumTerkunci, simpanPresensiDalam } from "@/lib/server/presensi";
import { skemaIdPresensi, skemaPresensi } from "@/lib/skema/sdm";
import { periodeDari } from "@/lib/inti/tanggal";

export async function simpanPresensi(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["presensi.kelola"]);
    const d = validasi(skemaPresensi, input);
    await db.$transaction((tx) => simpanPresensiDalam(tx, pengguna.id, d));
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
