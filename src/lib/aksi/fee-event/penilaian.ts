"use server";

/*
 * Server action penilaian progres dan laporan kapten.
 *   nilaiKehadiran : Kapten menilai kehadiran CREW di event yang ia pegang (selama PENILAIAN). Kapten tidak boleh menilai
 *                    dirinya sendiri atau kapten lain; kehadiran kapten dinilai Owner (selama PENILAIAN atau DIAJUKAN).
 *                    SESUAI = menit tercatat diakui penuh. KURANG = catatan wajib dan jam diakui, paling banyak menit
 *                    tercatat yang dipotong ke jadwal sesi.
 *   kirimLaporan   : Kapten mengirim laporan ke Owner setelah semua kehadiran crew dinilai -> laporan FEE-YYYY-NNNN
 *                    DIAJUKAN, event DIAJUKAN (data event terkunci sampai Owner memutuskan).
 * Kepemilikan kapten selalu dicek di server (pastikanKaptenEvent), bukan hanya disembunyikan di UI.
 */
import { db } from "@/lib/server/db";
import { aksiAman, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { skemaKirimLaporan, skemaPenilaian } from "@/lib/skema/fee-event";
import { nilaiKehadiranDalam, kirimLaporanDalam } from "@/lib/server/penilaian";

export async function nilaiKehadiran(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.nilai"]);
    const d = validasi(skemaPenilaian, input);
    const nama = await db.$transaction((tx) => nilaiKehadiranDalam(tx, pengguna, d));
    segarkan();
    return { pesan: `Penilaian ${nama} tersimpan.` };
  });
}

export async function kirimLaporan(input: unknown): Promise<HasilAksi<{ no: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.lapor"]);
    const { eventKode, catatan } = validasi(skemaKirimLaporan, input);
    const no = await db.$transaction((tx) => kirimLaporanDalam(tx, pengguna, eventKode, catatan));
    segarkan();
    return { pesan: `Laporan ${no} dikirim ke Owner.`, data: { no } };
  });
}

