/*
 * Skema validasi fee event (zod). Aman diimpor komponen klien.
 * Aturan bisnis yang butuh database (status event, kepemilikan kapten, batas menit diakui) diperiksa di server action.
 */
import { z } from "./zod";
import { POLA_TANGGAL } from "@/lib/inti/tanggal";
import { POLA_DURASI, POLA_JAM } from "@/lib/inti/fee-event";

const teks = (label: string, maks: number, wajib = true) => {
  const s = z.string({ error: wajib ? `${label} wajib diisi.` : `${label} tidak valid.` }).trim().max(maks, `${label} maksimal ${maks} karakter.`);
  return wajib ? s.min(1, `${label} wajib diisi.`) : s.default("");
};
const tanggal = (label: string) => z.string({ error: `Isi ${label}.` }).regex(POLA_TANGGAL, `Isi ${label}.`);
const jam = (label: string) => z.string({ error: `${label} wajib diisi.` }).trim().regex(POLA_JAM, `${label} wajib diisi (HH:MM).`);
const id = (label: string) => z.coerce.number({ error: `${label} tidak valid.` }).int(`${label} tidak valid.`).positive(`${label} tidak valid.`);
export const skemaKodeEvent = z.object({ eventKode: z.string({ error: "Event tidak valid." }).trim().min(1, "Event tidak valid.") });

export const skemaEvent = z
  .object({
    /** Diisi saat mengubah event. */
    kode: z.string({ error: "Event tidak valid." }).trim().optional().nullable(),
    nama: teks("Nama event", 120),
    klien: teks("Klien", 120, false),
    tanggalMulai: tanggal("tanggal mulai"),
    tanggalSelesai: tanggal("tanggal selesai"),
  })
  .superRefine((d, ctx) => {
    if (POLA_TANGGAL.test(d.tanggalMulai) && POLA_TANGGAL.test(d.tanggalSelesai) && d.tanggalSelesai < d.tanggalMulai) {
      ctx.addIssue({ code: "custom", path: ["tanggalSelesai"], message: "Tanggal selesai tidak boleh sebelum tanggal mulai." });
    }
  });

export const skemaSesi = z
  .object({
    id: id("Sesi").optional().nullable(),
    eventKode: z.string({ error: "Event tidak valid." }).trim().min(1, "Event tidak valid."),
    nama: teks("Nama sesi", 80),
    tanggal: tanggal("tanggal sesi"),
    jamMulai: jam("Jam mulai"),
    jamSelesai: jam("Jam selesai"),
  })
  .superRefine((d, ctx) => {
    if (POLA_JAM.test(d.jamMulai) && POLA_JAM.test(d.jamSelesai) && d.jamSelesai <= d.jamMulai) {
      ctx.addIssue({ code: "custom", path: ["jamSelesai"], message: "Jam selesai harus sesudah jam mulai. Sesi yang lewat tengah malam dipecah jadi dua sesi." });
    }
  });

export const skemaIdSesi = z.object({ id: id("Sesi") });

export const skemaPenugasan = z.object({
  /** Diisi saat mengganti jabatan penugasan (misalnya mengganti kapten). */
  id: id("Penugasan").optional().nullable(),
  eventKode: z.string({ error: "Event tidak valid." }).trim().min(1, "Event tidak valid."),
  karyawanKode: z.string({ error: "Pilih crew." }).trim().min(1, "Pilih crew."),
  jabatanKode: z.string({ error: "Pilih jabatan event." }).trim().min(1, "Pilih jabatan event."),
});

export const skemaIdPenugasan = z.object({ id: id("Penugasan") });

export const skemaKehadiran = z
  .object({
    id: id("Kehadiran").optional().nullable(),
    sesiId: id("Sesi"),
    karyawanKode: z.string({ error: "Pilih crew." }).trim().min(1, "Pilih crew."),
    jamMasuk: jam("Jam masuk"),
    jamPulang: jam("Jam pulang"),
    catatanProgres: teks("Catatan progres", 500, false),
  })
  .superRefine((d, ctx) => {
    if (POLA_JAM.test(d.jamMasuk) && POLA_JAM.test(d.jamPulang) && d.jamPulang <= d.jamMasuk) {
      ctx.addIssue({ code: "custom", path: ["jamPulang"], message: "Jam pulang harus sesudah jam masuk." });
    }
  });

export const skemaIdKehadiran = z.object({ id: id("Kehadiran") });

/** Penilaian progres satu kehadiran. KURANG wajib catatan dan jam diakui ("H:MM"). */
export const skemaPenilaian = z
  .object({
    id: id("Kehadiran"),
    penilaian: z.enum(["SESUAI", "KURANG"], { error: "Pilih Sesuai atau Kurang." }),
    jamDiakui: z.string({ error: "Jam diakui tidak valid." }).trim().optional().default(""),
    catatan: z.string({ error: "Catatan tidak valid." }).trim().max(500, "Catatan maksimal 500 karakter.").optional().default(""),
  })
  .superRefine((d, ctx) => {
    if (d.penilaian !== "KURANG") return;
    if (!d.catatan) ctx.addIssue({ code: "custom", path: ["catatan"], message: "Tulis catatan: apa yang kurang dari progres crew ini." });
    if (!POLA_DURASI.test(d.jamDiakui)) ctx.addIssue({ code: "custom", path: ["jamDiakui"], message: "Isi jam yang diakui dengan bentuk jam:menit, contoh 4:30." });
  });

export const skemaKirimLaporan = z.object({
  eventKode: z.string({ error: "Event tidak valid." }).trim().min(1, "Event tidak valid."),
  catatan: z.string({ error: "Catatan tidak valid." }).trim().max(1000, "Catatan maksimal 1000 karakter.").optional().default(""),
});

const MAKS_FEE = 100_000_000;

/** Keputusan Owner: setujui dengan fee akhir per orang. Alasan wajib bila fee akhir berbeda dari usulan (dicek server). */
export const skemaSetujuiFee = z.object({
  no: z.string({ error: "Nomor laporan kosong." }).trim().min(1, "Nomor laporan kosong."),
  fee: z
    .array(
      z.object({
        karyawanKode: z.string({ error: "Crew tidak valid." }).trim().min(1, "Crew tidak valid."),
        feeAkhir: z.coerce
          .number({ error: "Fee akhir harus berupa angka." })
          .int("Fee akhir harus bilangan bulat.")
          .min(0, "Fee akhir tidak boleh negatif.")
          .max(MAKS_FEE, "Fee akhir terlalu besar (maksimal Rp100.000.000 per orang)."),
        alasan: z.string({ error: "Alasan tidak valid." }).trim().max(300, "Alasan maksimal 300 karakter.").optional().default(""),
      }),
      { error: "Daftar fee tidak terkirim. Muat ulang halaman lalu coba lagi." },
    )
    .min(1, "Daftar fee kosong."),
});

export const skemaTolakFee = z.object({
  no: z.string({ error: "Nomor laporan kosong." }).trim().min(1, "Nomor laporan kosong."),
  alasan: z.string({ error: "Tulis alasan penolakan." }).trim().min(1, "Tulis alasan penolakan.").max(500, "Alasan terlalu panjang (maksimal 500 huruf)."),
});
