"use server";

/*
 * Server action Proses Penyusutan. Saat pembelian diposting sistem hanya membuat jadwal; beban tiap bulan baru dijurnal
 * di sini. Penyusutan dihitung dari jadwal, jadi jurnalnya langsung disetujui (tanpa ajukan, setujui, atau tolak).
 * Jalan pintas mengajukan jurnal nilai sisa dari halaman konversi juga ada di sini.
 */
import { db } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { ajukanJurnal } from "@/lib/server/jurnal";
import { prosesPenyusutanDalam } from "@/lib/server/penyusutan";
import { rupiah } from "@/lib/format";
import { skemaNoJurnal, skemaProsesPenyusutan } from "@/lib/skema/konversi";

export async function prosesPenyusutan(input: unknown): Promise<HasilAksi<{ jurnalNo: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["penyusutan.proses"]);
    const { periode: P } = validasi(skemaProsesPenyusutan, input);
    const hasil = await db.$transaction((tx) => prosesPenyusutanDalam(tx, pengguna.id, P));
    segarkan();
    return { pesan: `Jurnal ${hasil.jurnalNo} (${rupiah(hasil.total)}, ${hasil.jumlah} aset) sudah masuk buku besar.`, data: { jurnalNo: hasil.jurnalNo } };
  });
}

/**
 * Jalan pintas: Admin mengajukan draf jurnal nilai sisa (opname) langsung dari halaman Nilai Sisa.
 * Memakai layanan bersama ajukanJurnal, sama dengan tombol di halaman Jurnal Penyesuaian.
 */
export async function ajukanJurnalKonversi(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["jurnal-penyesuaian.ajukan"]);
    const { no } = validasi(skemaNoJurnal, input);
    await db.$transaction(async (tx) => {
      const j = await tx.jurnal.findUnique({ where: { no }, select: { sumberTipe: true } });
      if (!j || j.sumberTipe !== "OPNAME") throw new GalatAksi("Jurnal ini bukan jurnal nilai sisa.");
      const klaim = await tx.jurnal.count({ where: { no, status: "DRAFT" } });
      if (klaim !== 1) throw new GalatAksi(`${no} bukan draf.`);
      await ajukanJurnal(tx, no, pengguna.id);
    });
    segarkan();
    return { pesan: `${no} diajukan ke Owner.` };
  });
}
