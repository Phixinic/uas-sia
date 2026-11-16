/*
 * Skema validasi siklus konversi selain pembelian: nilai sisa, penyusutan, pelepasan, ajukan jurnal, tambah cepat master.
 * Aturan sama dengan versi-statis/assets/js/views/{nilai-sisa,penyusutan,pelepasan,master}.js.
 */
import { z } from "zod";
import { POLA_PERIODE, POLA_TANGGAL } from "@/lib/inti/tanggal";
import { RUPIAH_MAKS } from "@/lib/skema/pembelian";

const periode = z.string().regex(POLA_PERIODE, "Pilih periode yang benar.");

/** Nilai sisa hasil hitung fisik per perlengkapan. Nilai kosong ditolak supaya semua barang wajib dihitung. */
export const skemaNilaiSisa = z.object({
  periode,
  nilai: z.array(
    z.object({
      perlengkapanKode: z.string().trim().min(1),
      nilaiSisa: z.preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number({ error: "Isi nilai sisa." }).int("Nilai sisa harus bilangan bulat.").min(0, "Nilai sisa tidak boleh negatif.").max(RUPIAH_MAKS, "Nilai terlalu besar."),
      ),
    }),
  ),
});

export const skemaProsesPenyusutan = z.object({ periode });

export const skemaNoJurnal = z.object({ no: z.string().trim().min(1, "Nomor jurnal kosong.") });

export const skemaAjukanPelepasan = z
  .object({
    asetKode: z.string().trim().min(1, "Pilih peralatan."),
    tanggal: z.string().regex(POLA_TANGGAL, "Isi tanggal pelepasan."),
    alasan: z.enum(["DIJUAL", "DIBUANG", "HILANG"]),
    /** Kosong untuk dibuang atau hilang. Untuk DIJUAL boleh 0 (dijual gratis) tetapi wajib diisi. */
    hargaJual: z.union([z.literal(""), z.coerce.number({ error: "Harga jual harus angka." }).int("Harga jual harus bilangan bulat.").min(0, "Harga jual tidak boleh negatif.").max(RUPIAH_MAKS, "Harga jual terlalu besar.")]).default(""),
  })
  .superRefine((d, ctx) => {
    if (d.alasan === "DIJUAL" && d.hargaJual === "") ctx.addIssue({ code: "custom", path: ["hargaJual"], message: "Isi harga jual." });
  });

export const skemaNoPelepasan = z.object({ no: z.string().trim().min(1, "Nomor pelepasan kosong.") });

export const skemaSupplierCepat = z.object({
  nama: z.string().trim().min(1, "Isi nama supplier.").max(100, "Nama maksimal 100 karakter."),
  telepon: z.string().trim().max(30, "Telepon maksimal 30 karakter.").default(""),
});

export const skemaBarangCepat = z.object({
  jenis: z.enum(["PERALATAN", "PERLENGKAPAN"]),
  nama: z.string().trim().min(1, "Isi nama barang.").max(100, "Nama maksimal 100 karakter."),
  satuan: z.string().trim().min(1, "Isi satuan.").max(20, "Satuan maksimal 20 karakter."),
  kategoriKode: z.string().trim().default(""),
});
