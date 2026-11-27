"use server";

/*
 * Server action riwayat setting gaji (Master SDM, tab Setting gaji).
 *   ajukan : HRD mengajukan versi baru (setting awal, promosi, demosi, penyesuaian) dengan bulan berlaku. Owner tidak
 *            mengajukan.
 *   setujui: Owner menyetujui. Versi berlaku mulai bulan yang dipilih; tidak ada jurnal yang dibuat.
 *   tolak  : Owner menolak dengan alasan.
 * Baris setting tidak pernah ditimpa. Pengaman bulan berlaku (pengamanBerlaku) dicek saat mengajukan dan sekali lagi
 * saat menyetujui, karena slip bisa diajukan atau dibayar di antara keduanya. Setiap aksi mencatat nilai lama dan baru.
 */
import { db } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { catatLog } from "@/lib/server/log";
import { ajukanSettingDalam, bahanPengaman, isiVersi, kunciKaryawan, setujuiSettingDalam } from "@/lib/server/setting-gaji";
import { skemaAjukanSetting, skemaKodeSetting, skemaTolakSetting } from "@/lib/skema/setting-gaji";
import { keteranganLog, pilihVersiBerlaku, LABEL_JENIS_PERUBAHAN, type SlipRingkas } from "@/lib/inti/setting-gaji";
import { labelPeriode, periodeDariBulanTahun } from "@/lib/inti/tanggal";

const GALAT_BULAN = (pesan: string) => ({ bulan: pesan, tahun: pesan });
const daftarSlip = (s: SlipRingkas[]) => s.map((x) => x.no).join(", ");

export async function ajukanSettingGaji(input: unknown): Promise<HasilAksi<{ kode: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["setting-gaji.ajukan"]);
    const d = validasi(skemaAjukanSetting, input);
    const berlaku = periodeDariBulanTahun(d.bulan, d.tahun);
    if (!berlaku) throw new GalatAksi("Pilih bulan dan tahun berlaku.", GALAT_BULAN("Pilih bulan dan tahun berlaku."));

    const hasil = await db.$transaction((tx) => ajukanSettingDalam(tx, pengguna.id, d, berlaku));
    segarkan();
    const peringatan = hasil.draf.length ? ` Sesudah disetujui, slip draf ${daftarSlip(hasil.draf)} perlu dihitung ulang.` : "";
    return { pesan: `Pengajuan ${hasil.kode} (${LABEL_JENIS_PERUBAHAN[d.jenisPerubahan].toLowerCase()} ${hasil.nama}, berlaku ${labelPeriode(berlaku)}) dikirim ke Owner.${peringatan}`, data: { kode: hasil.kode } };
  });
}

export async function setujuiSettingGaji(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["setting-gaji.putuskan"]);
    const { kode } = validasi(skemaKodeSetting, input);
    const hasil = await db.$transaction((tx) => setujuiSettingDalam(tx, pengguna.id, kode));
    segarkan();
    const peringatan = hasil.draf.length ? ` Slip draf ${daftarSlip(hasil.draf)} ditandai perlu dihitung ulang di Hitung Gaji.` : "";
    return { pesan: `${kode} disetujui. Setting gaji ${hasil.nama} berlaku mulai ${labelPeriode(hasil.berlaku)}.${peringatan}` };
  });
}

export async function tolakSettingGaji(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["setting-gaji.putuskan"]);
    const { kode, alasan } = validasi(skemaTolakSetting, input);
    const nama = await db.$transaction(async (tx) => {
      const v = await tx.settingGaji.findUnique({ where: { kode }, include: { karyawan: { select: { nama: true } } } });
      if (!v) throw new GalatAksi(`Pengajuan ${kode} tidak ditemukan.`);
      await kunciKaryawan(tx, v.karyawanKode);
      const { versi } = await bahanPengaman(tx, v.karyawanKode);
      const isiLama = await isiVersi(tx, pilihVersiBerlaku(versi, v.berlakuMulai)?.kode);
      const klaim = await tx.settingGaji.updateMany({ where: { kode, status: "DIAJUKAN" }, data: { status: "DITOLAK", alasanTolak: alasan, diputuskanOlehId: pengguna.id, diputuskanPada: new Date() } });
      if (klaim.count !== 1) throw new GalatAksi(`Pengajuan ${kode} sudah diputuskan.`);
      const isiBaru = (await isiVersi(tx, kode))!;
      await catatLog(tx, pengguna.id, "setting-gaji.tolak", "setgaji", kode, `${v.karyawan.nama}. ${keteranganLog(v.jenisPerubahan, isiLama, isiBaru, `Alasan tolak: ${alasan}.`)}`);
      return v.karyawan.nama;
    });
    segarkan();
    return { pesan: `${kode} ditolak. Setting gaji ${nama} tidak berubah.` };
  });
}
