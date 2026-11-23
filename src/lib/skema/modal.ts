/*
 * Skema validasi Investasi Kas (setoran modal pemilik berupa kas). Dipakai server action dan form klien.
 */
import { z } from "./zod";
import { POLA_TANGGAL } from "@/lib/inti/tanggal";
import { RUPIAH_MAKS } from "@/lib/skema/pembelian";

export const skemaInvestasiKas = z.object({
  tanggal: z.string({ error: "Isi tanggal setoran." }).regex(POLA_TANGGAL, "Isi tanggal setoran."),
  jumlah: z.coerce
    .number({ error: "Isi jumlah setoran." })
    .int("Jumlah harus bilangan bulat.")
    .min(1, "Jumlah setoran harus lebih dari 0.")
    .max(RUPIAH_MAKS, "Jumlah terlalu besar untuk satu setoran."),
  keterangan: z.string({ error: "Isi keterangan atau sumber dana." }).trim().min(3, "Isi keterangan atau sumber dana, minimal 3 karakter.").max(200, "Keterangan maksimal 200 karakter."),
});

export type InputInvestasiKas = z.input<typeof skemaInvestasiKas>;
