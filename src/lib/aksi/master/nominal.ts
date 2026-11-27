"use server";

/*
 * Server action riwayat nominal master (Master SDM, tab Struktur gaji).
 *   ajukan : HRD mengajukan perubahan gaji pokok, nominal tunjangan, tunjangan jabatan, atau tarif jabatan event
 *            dengan bulan berlaku. Owner tidak mengajukan.
 *   setujui: Owner menyetujui. Tidak ada jurnal; nominal berlaku mulai bulan yang dipilih.
 *   tolak  : Owner menolak dengan alasan.
 * Aturan dan pengamannya ada di src/lib/server/nominal.ts (ajukanNominalDalam, setujuiNominalDalam, tolakNominalDalam).
 */
import { db } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { ajukanNominalDalam, setujuiNominalDalam, tolakNominalDalam } from "@/lib/server/nominal";
import { skemaAjukanNominal, skemaKodeNominal, skemaTolakNominal } from "@/lib/skema/nominal";
import { LABEL_JENIS_NOMINAL } from "@/lib/inti/nominal";
import { labelPeriode, periodeDariBulanTahun } from "@/lib/inti/tanggal";

export async function ajukanNominal(input: unknown): Promise<HasilAksi<{ kode: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["nominal.ajukan"]);
    const d = validasi(skemaAjukanNominal, input);
    const berlaku = periodeDariBulanTahun(d.bulan, d.tahun);
    if (!berlaku) throw new GalatAksi("Pilih bulan dan tahun berlaku.", { bulan: "Pilih bulan dan tahun berlaku.", tahun: "Pilih bulan dan tahun berlaku." });
    const hasil = await db.$transaction((tx) => ajukanNominalDalam(tx, pengguna.id, { ...d, berlaku }));
    segarkan();
    const jenis = LABEL_JENIS_NOMINAL[d.jenis].toLowerCase();
    const peringatan = hasil.draf.length
      ? d.jenis === "JABATAN_EVENT" ? ` Bila disetujui, usulan fee ${hasil.draf.join(", ")} ikut tarif baru.` : ` Sesudah disetujui, slip draf ${hasil.draf.join(", ")} perlu dihitung ulang.`
      : "";
    return { pesan: `Pengajuan ${hasil.kode} (${jenis} ${hasil.nama}, berlaku ${labelPeriode(berlaku)}) dikirim ke Owner.${peringatan}`, data: { kode: hasil.kode } };
  });
}

export async function setujuiNominal(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["nominal.putuskan"]);
    const { kode } = validasi(skemaKodeNominal, input);
    const h = await db.$transaction((tx) => setujuiNominalDalam(tx, pengguna.id, kode));
    segarkan();
    const peringatan = h.draf.length
      ? h.jenis === "JABATAN_EVENT" ? ` Usulan fee ${h.draf.join(", ")} memakai tarif baru.` : ` Slip draf ${h.draf.join(", ")} ditandai perlu dihitung ulang di Hitung Gaji.`
      : "";
    return { pesan: `${kode} disetujui. ${LABEL_JENIS_NOMINAL[h.jenis]} ${h.nama} berlaku mulai ${labelPeriode(h.berlaku)}.${peringatan}` };
  });
}

export async function tolakNominal(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["nominal.putuskan"]);
    const { kode, alasan } = validasi(skemaTolakNominal, input);
    const h = await db.$transaction((tx) => tolakNominalDalam(tx, pengguna.id, kode, alasan));
    segarkan();
    return { pesan: `${kode} ditolak. ${LABEL_JENIS_NOMINAL[h.jenis]} ${h.nama} tidak berubah.` };
  });
}
