"use server";

/*
 * Server action Investasi Kas (setoran modal pemilik berupa kas).
 *   catat     : Admin atau Owner, dokumen dibuat DIAJUKAN (periode tanggal setoran harus terbuka);
 *   setujui   : Owner, jurnal umum DISETUJUI Dr Kas 1-110, Kr Modal Pemilik 3-110 bertanggal setoran (periode harus terbuka);
 *   tolak     : Owner, alasan wajib, tanpa jurnal.
 * Owner boleh menyetujui setoran yang ia catat sendiri: setoran ini uang Owner sendiri dan hanya ada satu Owner.
 */
import { db } from "@/lib/server/db";
import { aksiAman, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { skemaInvestasiKas } from "@/lib/skema/modal";
import { skemaNoDanAlasan, skemaNoDokumen } from "@/lib/skema/pembelian";
import { catatInvestasiKasDalam, setujuiInvestasiKasDalam, tolakInvestasiKasDalam } from "@/lib/server/investasi-kas";

export async function catatInvestasiKas(input: unknown): Promise<HasilAksi<{ no: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["investasi-kas.catat"]);
    const d = validasi(skemaInvestasiKas, input);
    const no = await db.$transaction((tx) => catatInvestasiKasDalam(tx, pengguna, d));
    segarkan();
    return { pesan: `${no} dicatat dan menunggu keputusan Owner.`, data: { no } };
  });
}

export async function setujuiInvestasiKas(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["investasi-kas.putuskan"]);
    const { no } = validasi(skemaNoDokumen, input);
    const jurnalNo = await db.$transaction((tx) => setujuiInvestasiKasDalam(tx, pengguna, no));
    segarkan();
    return { pesan: `${no} disetujui. Jurnal ${jurnalNo} dibuat, kas dan modal pemilik bertambah.` };
  });
}

export async function tolakInvestasiKas(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["investasi-kas.putuskan"]);
    const { no, alasan } = validasi(skemaNoDanAlasan, input);
    await db.$transaction((tx) => tolakInvestasiKasDalam(tx, pengguna, no, alasan));
    segarkan();
    return { pesan: `${no} ditolak.` };
  });
}
