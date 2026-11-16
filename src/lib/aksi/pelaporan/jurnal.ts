"use server";

/*
 * Server action jurnal penyesuaian: ajukan (Admin), setujui dan tolak (Owner).
 * Efek ke dokumen sumber (jadwal penyusutan, opname) ditangani src/lib/server/jurnal.ts.
 */
import { db, type Tx } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { ajukanJurnal, setujuiJurnal, tolakJurnal } from "@/lib/server/jurnal";
import { skemaNoJurnal, skemaTolakJurnal } from "@/lib/skema/pelaporan";

/** Pastikan yang diproses memang jurnal penyesuaian (jurnal otomatis tidak lewat jalur ini). */
async function pastikanPenyesuaian(no: string) {
  const j = await db.jurnal.findUnique({ where: { no }, select: { jenis: true } });
  if (!j) throw new GalatAksi(`Jurnal ${no} tidak ditemukan.`);
  if (j.jenis !== "PENYESUAIAN") throw new GalatAksi(`${no} bukan jurnal penyesuaian.`);
}

/** Kunci baris jurnal sampai transaksi selesai, supaya dua klik bersamaan diproses berurutan dan yang kedua melihat status baru. */
const kunciJurnal = (tx: Tx, no: string) => tx.$queryRaw`SELECT no_jurnal FROM jurnal WHERE no_jurnal = ${no} FOR UPDATE`;

export async function ajukanJurnalPenyesuaian(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["jurnal-penyesuaian.ajukan"]);
    const { no } = validasi(skemaNoJurnal, input);
    await pastikanPenyesuaian(no);
    await db.$transaction(async (tx) => {
      await kunciJurnal(tx, no);
      await ajukanJurnal(tx, no, pengguna.id);
    });
    segarkan();
    return { pesan: `${no} diajukan ke Owner.` };
  });
}

export async function setujuiJurnalPenyesuaian(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["jurnal-penyesuaian.putuskan"]);
    const { no } = validasi(skemaNoJurnal, input);
    await pastikanPenyesuaian(no);
    await db.$transaction(async (tx) => {
      await kunciJurnal(tx, no);
      await setujuiJurnal(tx, no, pengguna.id);
    });
    segarkan();
    return { pesan: `${no} disetujui dan masuk buku besar.` };
  });
}

export async function tolakJurnalPenyesuaian(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["jurnal-penyesuaian.putuskan"]);
    const { no, alasan } = validasi(skemaTolakJurnal, input);
    await pastikanPenyesuaian(no);
    await db.$transaction(async (tx) => {
      await kunciJurnal(tx, no);
      await tolakJurnal(tx, no, pengguna.id, alasan);
    });
    segarkan();
    return { pesan: `${no} ditolak. Dokumen sumbernya dibuka lagi supaya Admin bisa memproses ulang.` };
  });
}
