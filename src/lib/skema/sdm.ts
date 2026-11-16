/*
 * Skema validasi siklus SDM (zod). Aturan sama dengan prsSave() di versi-statis/assets/js/views/presensi.js.
 */
import { z } from "zod";
import { POLA_PERIODE, POLA_TANGGAL, keMenit } from "@/lib/inti/tanggal";

const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const skemaPresensi = z
  .object({
    /** Diisi saat mengubah presensi yang sudah ada. */
    id: z.coerce.number().int().positive().optional().nullable(),
    karyawanKode: z.string().trim().min(1, "Pilih karyawan."),
    tanggal: z.string().regex(POLA_TANGGAL, "Isi tanggal."),
    absensi: z.enum(["HADIR", "IZIN", "SAKIT", "CUTI", "ALPA"], { error: "Pilih jenis absensi." }),
    jamMasuk: z.string().trim().optional().default(""),
    jamKeluar: z.string().trim().optional().default(""),
  })
  .superRefine((d, ctx) => {
    if (d.absensi !== "HADIR") return;
    if (!POLA_JAM.test(d.jamMasuk)) ctx.addIssue({ code: "custom", path: ["jamMasuk"], message: "Jam masuk wajib diisi untuk status Hadir." });
    if (!POLA_JAM.test(d.jamKeluar)) ctx.addIssue({ code: "custom", path: ["jamKeluar"], message: "Jam keluar wajib diisi untuk status Hadir." });
    if (POLA_JAM.test(d.jamMasuk) && POLA_JAM.test(d.jamKeluar) && keMenit(d.jamKeluar) <= keMenit(d.jamMasuk)) {
      ctx.addIssue({ code: "custom", path: ["jamKeluar"], message: "Jam keluar harus setelah jam masuk." });
    }
  });

export const skemaIdPresensi = z.object({ id: z.coerce.number().int().positive("Presensi tidak valid.") });

export const skemaPeriode = z.object({ periode: z.string().regex(POLA_PERIODE, "Periode tidak valid.") });

export const skemaHitungSatu = z.object({
  periode: z.string().regex(POLA_PERIODE, "Periode tidak valid."),
  karyawanKode: z.string().trim().min(1, "Karyawan tidak valid."),
});

export const skemaNoDokumen = z.object({ no: z.string().trim().min(1, "Nomor dokumen kosong.") });

export const skemaNoDanAlasan = z.object({
  no: z.string().trim().min(1, "Nomor dokumen kosong."),
  alasan: z.string().trim().min(1, "Tulis alasan penolakan.").max(500, "Alasan terlalu panjang (maksimal 500 huruf)."),
});
