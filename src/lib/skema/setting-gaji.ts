/*
 * Skema validasi pengajuan dan keputusan setting gaji (riwayat). Dipakai server action dan form klien.
 */
import { z } from "./zod";

export const JENIS_PERUBAHAN = ["SETTING_AWAL", "PROMOSI", "DEMOSI", "PENYESUAIAN"] as const;

export const skemaAjukanSetting = z.object({
  karyawanKode: z.string({ error: "Pilih karyawan." }).trim().min(1, "Pilih karyawan."),
  jenisPerubahan: z.enum(JENIS_PERUBAHAN, { error: "Pilih jenis perubahan." }),
  jabatanKode: z.string({ error: "Pilih jabatan." }).trim().min(1, "Pilih jabatan."),
  golonganKode: z.string({ error: "Pilih gaji pokok." }).trim().min(1, "Pilih gaji pokok."),
  tunjanganKodes: z.array(z.string({ error: "Tunjangan tidak valid." }), { error: "Tunjangan tidak valid." }).default([]),
  bulan: z.coerce.number({ error: "Pilih bulan berlaku." }).int("Pilih bulan berlaku.").min(1, "Pilih bulan berlaku.").max(12, "Pilih bulan berlaku."),
  tahun: z.coerce.number({ error: "Pilih tahun berlaku." }).int("Pilih tahun berlaku.").min(2000, "Pilih tahun berlaku.").max(2999, "Pilih tahun berlaku."),
  alasan: z.string({ error: "Tulis alasan pengajuan." }).trim().min(5, "Tulis alasan pengajuan, minimal 5 karakter.").max(300, "Alasan maksimal 300 karakter."),
});

export type InputAjukanSetting = z.input<typeof skemaAjukanSetting>;

export const skemaKodeSetting = z.object({
  kode: z.string({ error: "Kode pengajuan kosong." }).trim().min(1, "Kode pengajuan kosong."),
});

export const skemaTolakSetting = skemaKodeSetting.extend({
  alasan: z.string({ error: "Alasan penolakan wajib diisi." }).trim().min(3, "Alasan penolakan wajib diisi, minimal 3 karakter.").max(300, "Alasan maksimal 300 karakter."),
});
