/*
 * Skema validasi pembelian (zod). Dipakai server action dan boleh dipakai form klien untuk validasi awal.
 * Aturan sama dengan validasiBeli() di versi-statis/assets/js/views/pembelian.js.
 */
import { z } from "./zod";
import { POLA_TANGGAL, periodeDari } from "@/lib/inti/tanggal";
import { hitungJadwal, nDariDasar } from "@/lib/inti/penyusutan";

/** Batas aman kolom Int PostgreSQL untuk rupiah. */
export const RUPIAH_MAKS = 2_000_000_000;

const bulat = (pesan: string) => z.coerce.number({ error: pesan }).int(pesan);

export const skemaBarisPembelian = z.object({
  barangKode: z.string({ error: "Pilih barang." }).trim().min(1, "Pilih barang."),
  qty: bulat("Jumlah harus bilangan bulat.").min(1, "Jumlah minimal 1."),
  harga: bulat("Harga harus bilangan bulat.").min(1, "Harga harus lebih dari 0.").max(RUPIAH_MAKS, "Harga terlalu besar."),
  // Kolom berikut hanya untuk peralatan
  residu: bulat("Residu harus bilangan bulat.").min(0, "Residu tidak boleh negatif.").default(0),
  garansiBulan: bulat("Garansi harus bilangan bulat.").min(0, "Garansi tidak boleh negatif.").max(600, "Garansi maksimal 600 bulan.").default(0),
  masaManfaatBulan: bulat("Masa manfaat harus bilangan bulat.").min(0, "Masa manfaat tidak boleh negatif.").max(600, "Masa manfaat maksimal 600 bulan.").default(0),
  dasarN: z.enum(["GARANSI", "MASA_MANFAAT"], { error: "Pilih dasar n (garansi atau masa manfaat)." }).default("GARANSI"),
});

export const skemaPembelian = z
  .object({
    /** Diisi saat mengubah draf. */
    no: z.string({ error: "Nomor pembelian tidak valid." }).trim().optional().nullable(),
    jenis: z.enum(["PERALATAN", "PERLENGKAPAN"], { error: "Jenis pembelian tidak valid." }),
    tanggal: z.string({ error: "Isi tanggal pembelian." }).regex(POLA_TANGGAL, "Isi tanggal pembelian."),
    caraBayar: z.enum(["TUNAI", "KREDIT", "INVESTASI"], { error: "Pilih cara bayar." }),
    jatuhTempo: z.string({ error: "Isi jatuh tempo utang." }).optional().default(""),
    supplierKode: z.string({ error: "Pilih supplier." }).trim().optional().default(""),
    keterangan: z.string({ error: "Keterangan tidak valid." }).trim().max(200, "Keterangan maksimal 200 karakter.").default(""),
    baris: z.array(skemaBarisPembelian, { error: "Isi minimal satu baris barang." }).min(1, "Isi minimal satu baris barang.").max(50, "Maksimal 50 baris."),
    /** true = simpan lalu langsung posting. */
    posting: z.boolean({ error: "Pilihan posting tidak valid." }).default(false),
  })
  .superRefine((d, ctx) => {
    if (d.caraBayar !== "INVESTASI" && !d.supplierKode) {
      ctx.addIssue({ code: "custom", path: ["supplierKode"], message: "Pilih supplier, atau pilih cara bayar Investasi untuk setoran pemilik." });
    }
    if (d.caraBayar === "KREDIT" && (!POLA_TANGGAL.test(d.jatuhTempo) || d.jatuhTempo < d.tanggal)) {
      ctx.addIssue({ code: "custom", path: ["jatuhTempo"], message: "Isi jatuh tempo utang, minimal sama dengan tanggal pembelian." });
    }
    const total = d.baris.reduce((s, b) => s + b.qty * b.harga, 0);
    if (total > RUPIAH_MAKS) ctx.addIssue({ code: "custom", path: ["baris"], message: "Total pembelian terlalu besar untuk satu dokumen." });
    if (d.jenis !== "PERALATAN") return;
    d.baris.forEach((b, i) => {
      const ke = `Baris ${i + 1}: `;
      if (b.dasarN === "GARANSI" && b.garansiBulan < 1) {
        ctx.addIssue({ code: "custom", path: ["baris", i, "garansiBulan"], message: `${ke}dasar n adalah garansi, jadi isi garansi minimal 1 bulan.` });
        return;
      }
      if (b.dasarN === "MASA_MANFAAT" && b.masaManfaatBulan < 1) {
        ctx.addIssue({ code: "custom", path: ["baris", i, "masaManfaatBulan"], message: `${ke}isi masa manfaat minimal 1 bulan.` });
        return;
      }
      try {
        hitungJadwal(b.harga, b.residu, nDariDasar(b.dasarN, b.garansiBulan, b.masaManfaatBulan), periodeDari(d.tanggal));
      } catch (e) {
        ctx.addIssue({ code: "custom", path: ["baris", i, "residu"], message: ke + (e as Error).message });
      }
    });
  });

export type InputPembelian = z.input<typeof skemaPembelian>;

export const skemaNoDokumen = z.object({ no: z.string({ error: "Nomor dokumen kosong." }).trim().min(1, "Nomor dokumen kosong.") });
export const skemaNoDanAlasan = skemaNoDokumen.extend({ alasan: z.string({ error: "Tulis alasannya." }).trim().min(1, "Tulis alasannya.").max(300, "Alasan maksimal 300 karakter.") });
