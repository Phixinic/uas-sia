/*
 * Skema validasi pengajuan dan keputusan perubahan nominal master (riwayat nominal). Dipakai server action dan form klien.
 */
import { z } from "./zod";
import { JENIS_NOMINAL } from "@/lib/inti/nominal";

const MAKS_RUPIAH = 2_000_000_000;
export const MAKS_TARIF = 100_000_000;

const rupiah = (label: string) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? 0 : v),
    z.coerce.number({ error: `${label} harus berupa angka.` }).int(`${label} harus bilangan bulat.`).min(0, `${label} tidak boleh kurang dari 0.`).max(MAKS_RUPIAH, `${label} terlalu besar.`),
  );

export const skemaAjukanNominal = z
  .object({
    jenis: z.enum(JENIS_NOMINAL, { error: "Jenis nominal tidak dikenal." }),
    itemKode: z.string({ error: "Pilih data master." }).trim().min(1, "Pilih data master."),
    nominal: rupiah("Nominal"),
    tunjJabatan: rupiah("Tunjangan jabatan"),
    tunjKeluarga: rupiah("Tunjangan istri/anak"),
    bulan: z.coerce.number({ error: "Pilih bulan berlaku." }).int("Pilih bulan berlaku.").min(1, "Pilih bulan berlaku.").max(12, "Pilih bulan berlaku."),
    tahun: z.coerce.number({ error: "Pilih tahun berlaku." }).int("Pilih tahun berlaku.").min(2000, "Pilih tahun berlaku.").max(2999, "Pilih tahun berlaku."),
    alasan: z.string({ error: "Tulis alasan perubahan." }).trim().min(5, "Tulis alasan perubahan, minimal 5 karakter.").max(300, "Alasan maksimal 300 karakter."),
  })
  .superRefine((v, ctx) => {
    if (v.jenis !== "JABATAN" && v.nominal <= 0) ctx.addIssue({ code: "custom", path: ["nominal"], message: v.jenis === "JABATAN_EVENT" ? "Tarif wajib diisi dan lebih dari 0." : "Nominal wajib diisi dan lebih dari 0." });
    if (v.jenis === "JABATAN_EVENT" && v.nominal > MAKS_TARIF) ctx.addIssue({ code: "custom", path: ["nominal"], message: `Tarif terlalu besar (maksimal ${MAKS_TARIF.toLocaleString("id-ID")}).` });
  });

export type InputAjukanNominal = z.input<typeof skemaAjukanNominal>;

export const skemaKodeNominal = z.object({
  kode: z.string({ error: "Kode pengajuan kosong." }).trim().min(1, "Kode pengajuan kosong."),
});

export const skemaTolakNominal = skemaKodeNominal.extend({
  alasan: z.string({ error: "Alasan penolakan wajib diisi." }).trim().min(3, "Alasan penolakan wajib diisi, minimal 3 karakter.").max(300, "Alasan maksimal 300 karakter."),
});
