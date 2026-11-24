/*
 * Skema validasi siklus konversi selain pembelian: nilai sisa, penyusutan, pelepasan, ajukan jurnal, tambah cepat master.
 * Aturan sama dengan versi-statis/assets/js/views/{nilai-sisa,penyusutan,pelepasan,master}.js.
 */
import { z } from "./zod";
import { POLA_PERIODE, POLA_TANGGAL } from "@/lib/inti/tanggal";
import { RUPIAH_MAKS } from "@/lib/skema/pembelian";

const periode = z.string({ error: "Pilih periode yang benar." }).regex(POLA_PERIODE, "Pilih periode yang benar.");

/** Nilai sisa hasil hitung fisik per perlengkapan. Nilai kosong ditolak supaya semua barang wajib dihitung. */
export const skemaNilaiSisa = z.object({
  periode,
  nilai: z.array(
    z.object({
      perlengkapanKode: z.string({ error: "Perlengkapan tidak valid." }).trim().min(1, "Perlengkapan tidak valid."),
      nilaiSisa: z.preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number({ error: "Isi nilai sisa." }).int("Nilai sisa harus bilangan bulat.").min(0, "Nilai sisa tidak boleh negatif.").max(RUPIAH_MAKS, "Nilai terlalu besar."),
      ),
    }),
    { error: "Isi hasil hitung fisik perlengkapan." },
  ),
});

export const skemaProsesPenyusutan = z.object({ periode });

export const skemaNoJurnal = z.object({ no: z.string({ error: "Nomor jurnal kosong." }).trim().min(1, "Nomor jurnal kosong.") });

export const skemaAjukanPelepasan = z
  .object({
    asetKode: z.string({ error: "Pilih peralatan." }).trim().min(1, "Pilih peralatan."),
    tanggal: z.string({ error: "Isi tanggal pelepasan." }).regex(POLA_TANGGAL, "Isi tanggal pelepasan."),
    alasan: z.enum(["DIJUAL", "DIBUANG", "HILANG"], { error: "Pilih alasan pelepasan." }),
    /** Kosong untuk dibuang atau hilang. Untuk DIJUAL boleh 0 (dijual gratis) tetapi wajib diisi. */
    hargaJual: z.union([z.literal(""), z.coerce.number({ error: "Harga jual harus angka." }).int("Harga jual harus bilangan bulat.").min(0, "Harga jual tidak boleh negatif.").max(RUPIAH_MAKS, "Harga jual terlalu besar.")], { error: "Harga jual harus angka." }).default(""),
  })
  .superRefine((d, ctx) => {
    if (d.alasan === "DIJUAL" && d.hargaJual === "") ctx.addIssue({ code: "custom", path: ["hargaJual"], message: "Isi harga jual." });
  });

export const skemaNoPelepasan = z.object({ no: z.string({ error: "Nomor pelepasan kosong." }).trim().min(1, "Nomor pelepasan kosong.") });

export const skemaSupplierCepat = z.object({
  nama: z.string({ error: "Isi nama supplier." }).trim().min(1, "Isi nama supplier.").max(100, "Nama maksimal 100 karakter."),
  telepon: z.string({ error: "Telepon tidak valid." }).trim().max(30, "Telepon maksimal 30 karakter.").default(""),
});

export const skemaBarangCepat = z.object({
  jenis: z.enum(["PERALATAN", "PERLENGKAPAN"], { error: "Jenis barang tidak valid." }),
  nama: z.string({ error: "Isi nama barang." }).trim().min(1, "Isi nama barang.").max(100, "Nama maksimal 100 karakter."),
  satuan: z.string({ error: "Isi satuan." }).trim().min(1, "Isi satuan.").max(20, "Satuan maksimal 20 karakter."),
  kategoriKode: z.string({ error: "Pilih kategori aset." }).trim().default(""),
});

/** Revisi nilai sisa yang sudah disetujui: nilai baru semua perlengkapan opname itu, alasan wajib. */
export const skemaRevisiNilaiSisa = skemaNilaiSisa.extend({
  alasan: z.string({ error: "Tulis alasan revisi." }).trim().min(1, "Tulis alasan revisi.").max(500, "Alasan maksimal 500 karakter."),
});

export const skemaNoRevisi = z.object({ no: z.string({ error: "Nomor revisi kosong." }).trim().min(1, "Nomor revisi kosong.") });

export const skemaKembalikanRevisi = skemaNoRevisi.extend({
  alasan: z.string({ error: "Tulis alasan." }).trim().min(1, "Tulis alasan.").max(500, "Alasan maksimal 500 karakter."),
});
