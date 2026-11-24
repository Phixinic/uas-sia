"use server";

/*
 * Keputusan Owner atas laporan kapten (izin fee-event.putuskan). Logikanya di src/lib/server/keputusan-fee.ts
 * (dipakai juga seed): crew freelance dibayar lewat slip fee dan jurnal fee, karyawan inhouse lewat Gaji Bulanan.
 */
import { db } from "@/lib/server/db";
import { aksiAman, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { rupiah } from "@/lib/format";
import { labelPeriode } from "@/lib/inti/tanggal";
import { setujuiFeeDalam, tolakFeeDalam } from "@/lib/server/keputusan-fee";
import { skemaSetujuiFee, skemaTolakFee } from "@/lib/skema/fee-event";

export async function setujuiFee(input: unknown): Promise<HasilAksi<{ jurnalNo: string | null }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["fee-event.putuskan"]);
    const d = validasi(skemaSetujuiFee, input);
    const h = await db.$transaction((tx) => setujuiFeeDalam(tx, pengguna.id, d));
    segarkan();
    const bagian = [
      h.jurnalNo ? `Jurnal ${h.jurnalNo} dibuat dan fee ${rupiah(h.totalDibayar)} dibayar.` : "",
      h.lewatGaji.length ? `Upah event ${h.lewatGaji.map((x) => `${x.nama} ${rupiah(x.fee)}`).join(", ")} dibayar lewat gaji ${[...new Set(h.lewatGaji.map((x) => labelPeriode(x.periode)))].join(", ")}.` : "",
    ].filter(Boolean);
    return { pesan: `${d.no} disetujui. ${bagian.join(" ")}`, data: { jurnalNo: h.jurnalNo } };
  });
}

export async function tolakFee(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["fee-event.putuskan"]);
    const { no, alasan } = validasi(skemaTolakFee, input);
    await db.$transaction((tx) => tolakFeeDalam(tx, pengguna.id, no, alasan));
    segarkan();
    return { pesan: `${no} ditolak. Laporan kembali ke kapten untuk dinilai ulang.` };
  });
}
