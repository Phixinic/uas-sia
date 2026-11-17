/*
 * Skema validasi aksi pelaporan: jurnal penyesuaian dan tutup periode.
 */
import { z } from "./zod";
import { POLA_PERIODE } from "@/lib/inti/tanggal";

export const skemaNoJurnal = z.object({ no: z.string({ error: "Nomor jurnal kosong." }).trim().min(1, "Nomor jurnal kosong.") });
export const skemaTolakJurnal = skemaNoJurnal.extend({ alasan: z.string({ error: "Tulis alasan penolakan." }).trim().min(1, "Tulis alasan penolakan.").max(300, "Alasan maksimal 300 karakter.") });

export const skemaPeriode = z.object({ periode: z.string({ error: "Periode tidak valid." }).regex(POLA_PERIODE, "Periode tidak valid.") });
export const skemaBukaPeriode = skemaPeriode.extend({ alasan: z.string({ error: "Tulis alasan membuka kunci." }).trim().min(1, "Tulis alasan membuka kunci.").max(300, "Alasan maksimal 300 karakter.") });
