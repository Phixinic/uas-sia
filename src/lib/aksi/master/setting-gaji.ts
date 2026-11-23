"use server";

/*
 * Server action riwayat setting gaji (Master SDM, tab Setting gaji).
 *   ajukan : HRD atau Owner mengajukan versi baru (setting awal, promosi, demosi, penyesuaian) dengan bulan berlaku.
 *   setujui: Owner menyetujui. Versi berlaku mulai bulan yang dipilih; tidak ada jurnal yang dibuat.
 *   tolak  : Owner menolak dengan alasan.
 * Baris setting tidak pernah ditimpa. Pengaman bulan berlaku (pengamanBerlaku) dicek saat mengajukan dan sekali lagi
 * saat menyetujui, karena slip bisa diajukan atau dibayar di antara keduanya. Setiap aksi mencatat nilai lama dan baru.
 */
import { db, type Tx } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { AWALAN, kodeBerikutnya } from "@/lib/server/nomor";
import { pastikanTerbuka } from "@/lib/server/periode";
import { catatLog } from "@/lib/server/log";
import { bahanPengaman, isiVersi, kunciKaryawan, tahanKunciSetting } from "@/lib/server/setting-gaji";
import { skemaAjukanSetting, skemaKodeSetting, skemaTolakSetting } from "@/lib/skema/setting-gaji";
import { isiSama, keteranganLog, pengamanBerlaku, pilihVersiBerlaku, LABEL_JENIS_PERUBAHAN, type SlipRingkas } from "@/lib/inti/setting-gaji";
import { labelPeriode, periodeDariBulanTahun } from "@/lib/inti/tanggal";

const GALAT_BULAN = (pesan: string) => ({ bulan: pesan, tahun: pesan });
const daftarSlip = (s: SlipRingkas[]) => s.map((x) => x.no).join(", ");

/** Karyawan inhouse aktif, jabatan inhouse aktif, golongan dan tunjangan aktif. */
async function pastikanRujukanAktif(tx: Tx, d: { karyawanKode: string; jabatanKode: string; golonganKode: string; tunjanganKodes: string[] }) {
  const k = await tx.karyawan.findUnique({ where: { kode: d.karyawanKode }, select: { aktif: true, jenis: true, nama: true } });
  const j = await tx.jabatan.findUnique({ where: { kode: d.jabatanKode }, select: { aktif: true, kelompok: true, nama: true } });
  const g = await tx.golongan.findUnique({ where: { kode: d.golonganKode }, select: { aktif: true, nama: true } });
  const t = await tx.tunjangan.findMany({ where: { kode: { in: d.tunjanganKodes } }, select: { kode: true, aktif: true, nama: true } });
  if (!k) throw new GalatAksi("Karyawan tidak ditemukan.", { karyawanKode: "Karyawan tidak ditemukan." });
  if (!k.aktif) throw new GalatAksi(`${k.nama} sudah dinonaktifkan.`, { karyawanKode: "Karyawan nonaktif." });
  if (k.jenis !== "INHOUSE") throw new GalatAksi("Karyawan event tidak memakai setting gaji. Fee-nya dihitung di menu Fee event.", { karyawanKode: "Karyawan event." });
  if (!j) throw new GalatAksi("Jabatan tidak ditemukan.", { jabatanKode: "Jabatan tidak ditemukan." });
  if (j.kelompok !== "INHOUSE") throw new GalatAksi("Jabatan event tidak dipakai untuk gaji inhouse.", { jabatanKode: "Jabatan event." });
  if (!j.aktif) throw new GalatAksi(`Jabatan ${j.nama} sudah dinonaktifkan.`, { jabatanKode: "Jabatan nonaktif." });
  if (!g) throw new GalatAksi("Gaji pokok tidak ditemukan.", { golonganKode: "Gaji pokok tidak ditemukan." });
  if (!g.aktif) throw new GalatAksi(`Gaji pokok ${g.nama} sudah dinonaktifkan.`, { golonganKode: "Gaji pokok nonaktif." });
  if (t.length !== d.tunjanganKodes.length) throw new GalatAksi("Ada tunjangan yang tidak ditemukan.", { tunjanganKodes: "Tunjangan tidak ditemukan." });
  const mati = t.find((x) => !x.aktif);
  if (mati) throw new GalatAksi(`Tunjangan ${mati.nama} sudah dinonaktifkan.`, { tunjanganKodes: "Tunjangan nonaktif dipilih." });
  return k.nama;
}

export async function ajukanSettingGaji(input: unknown): Promise<HasilAksi<{ kode: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["setting-gaji.ajukan"]);
    const d = validasi(skemaAjukanSetting, input);
    const berlaku = periodeDariBulanTahun(d.bulan, d.tahun);
    if (!berlaku) throw new GalatAksi("Pilih bulan dan tahun berlaku.", GALAT_BULAN("Pilih bulan dan tahun berlaku."));
    const tunjanganKodes = [...new Set(d.tunjanganKodes)].sort();

    const hasil = await db.$transaction(async (tx) => {
      await pastikanTerbuka(tx, berlaku, GALAT_BULAN("Periode ini sudah tertutup."));
      await kunciKaryawan(tx, d.karyawanKode);
      const nama = await pastikanRujukanAktif(tx, { ...d, tunjanganKodes });
      const { versi, slip } = await bahanPengaman(tx, d.karyawanKode);

      const adaDisetujui = versi.some((v) => v.status === "DISETUJUI");
      if (!adaDisetujui && d.jenisPerubahan !== "SETTING_AWAL") {
        throw new GalatAksi(`${nama} belum punya setting gaji yang disetujui, jadi pengajuan pertamanya berjenis Setting awal.`, { jenisPerubahan: "Pilih Setting awal." });
      }
      if (adaDisetujui && d.jenisPerubahan === "SETTING_AWAL") {
        throw new GalatAksi(`${nama} sudah punya setting gaji. Pilih Promosi, Demosi, atau Penyesuaian.`, { jenisPerubahan: "Sudah punya setting gaji." });
      }
      if (versi.some((v) => v.status === "DIAJUKAN" && v.berlakuMulai === berlaku)) {
        throw new GalatAksi(`Sudah ada pengajuan setting gaji ${nama} berlaku ${labelPeriode(berlaku)} yang menunggu Owner. Tunggu keputusannya dulu.`, GALAT_BULAN("Sudah ada pengajuan di bulan ini."));
      }
      const p = pengamanBerlaku(berlaku, slip, versi);
      if (p.galat) throw new GalatAksi(p.galat, GALAT_BULAN(p.galat));

      const lama = pilihVersiBerlaku(versi, berlaku);
      const isiLama = await isiVersi(tx, lama?.kode);
      if (isiLama && isiSama(isiLama, { jabatanKode: d.jabatanKode, golonganKode: d.golonganKode, tunjangan: tunjanganKodes.map((kode) => ({ kode, nama: "", nominal: 0 })) })) {
        throw new GalatAksi(`Isian sama dengan setting ${lama!.kode} yang berlaku di ${labelPeriode(berlaku)}. Tidak ada yang berubah.`, { jabatanKode: "Belum ada perubahan." });
      }

      const kode = await kodeBerikutnya(tx, AWALAN.SETTING_GAJI);
      await tx.settingGaji.create({
        data: {
          kode,
          karyawanKode: d.karyawanKode,
          jabatanKode: d.jabatanKode,
          golonganKode: d.golonganKode,
          berlakuMulai: berlaku,
          jenisPerubahan: d.jenisPerubahan,
          alasan: d.alasan,
          status: "DIAJUKAN",
          diajukanOlehId: pengguna.id,
          tunjangan: { create: tunjanganKodes.map((tunjanganKode) => ({ tunjanganKode })) },
        },
      });
      const isiBaru = (await isiVersi(tx, kode))!;
      const catatan = [`Alasan: ${d.alasan}.`, p.drafTerdampak.length ? `Bila disetujui, slip draf ${daftarSlip(p.drafTerdampak)} perlu dihitung ulang.` : ""].join(" ").trim();
      await catatLog(tx, pengguna.id, "setting-gaji.ajukan", "setgaji", kode, `${nama}. ${keteranganLog(d.jenisPerubahan, isiLama, isiBaru, catatan)}`);
      return { kode, nama, draf: p.drafTerdampak };
    });
    segarkan();
    const peringatan = hasil.draf.length ? ` Sesudah disetujui, slip draf ${daftarSlip(hasil.draf)} perlu dihitung ulang.` : "";
    return { pesan: `Pengajuan ${hasil.kode} (${LABEL_JENIS_PERUBAHAN[d.jenisPerubahan].toLowerCase()} ${hasil.nama}, berlaku ${labelPeriode(berlaku)}) dikirim ke Owner.${peringatan}`, data: { kode: hasil.kode } };
  });
}

export async function setujuiSettingGaji(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["setting-gaji.putuskan"]);
    const { kode } = validasi(skemaKodeSetting, input);
    const hasil = await db.$transaction(async (tx) => {
      const v = await tx.settingGaji.findUnique({ where: { kode }, include: { tunjangan: true } });
      if (!v) throw new GalatAksi(`Pengajuan ${kode} tidak ditemukan.`);
      if (v.status !== "DIAJUKAN") throw new GalatAksi(`Pengajuan ${kode} sudah diputuskan.`);
      await pastikanTerbuka(tx, v.berlakuMulai);
      // Kunci eksklusif: Hitung Gaji dan pengajuan penggajian menunggu sampai keputusan ini selesai.
      await tahanKunciSetting(tx, true);
      await kunciKaryawan(tx, v.karyawanKode);
      const nama = await pastikanRujukanAktif(tx, { karyawanKode: v.karyawanKode, jabatanKode: v.jabatanKode, golonganKode: v.golonganKode, tunjanganKodes: v.tunjangan.map((t) => t.tunjanganKode) });

      // Pengaman dicek ulang: slip bisa sudah diajukan atau dibayar sejak pengajuan ini dibuat.
      const { versi, slip } = await bahanPengaman(tx, v.karyawanKode);
      const p = pengamanBerlaku(v.berlakuMulai, slip, versi);
      if (p.galat) throw new GalatAksi(`${p.galat} Tolak pengajuan ini, lalu minta HRD mengajukan ulang dengan bulan berlaku yang benar.`);
      const lama = pilihVersiBerlaku(versi, v.berlakuMulai);
      const isiLama = await isiVersi(tx, lama?.kode);

      const klaim = await tx.settingGaji.updateMany({ where: { kode, status: "DIAJUKAN" }, data: { status: "DISETUJUI", diputuskanOlehId: pengguna.id, diputuskanPada: new Date() } });
      if (klaim.count !== 1) throw new GalatAksi(`Pengajuan ${kode} baru saja diputuskan pengguna lain.`);
      const isiBaru = (await isiVersi(tx, kode))!;
      const catatan = p.drafTerdampak.length ? `Slip draf ${daftarSlip(p.drafTerdampak)} perlu dihitung ulang.` : "Tidak ada slip draf yang terdampak.";
      await catatLog(tx, pengguna.id, "setting-gaji.setujui", "setgaji", kode, `${nama}. ${keteranganLog(v.jenisPerubahan, isiLama, isiBaru, catatan)}`);
      return { nama, berlaku: v.berlakuMulai, draf: p.drafTerdampak };
    });
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
