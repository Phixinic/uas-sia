import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import HalamanBelumJadi from "@/komponen/ui/HalamanBelumJadi";

export const metadata: Metadata = { title: "Nilai Sisa Perlengkapan" };

export default async function Halaman() {
  await wajibMasuk();
  return <HalamanBelumJadi judul="Nilai Sisa Perlengkapan" keterangan="Biaya perlengkapan = saldo buku − nilai sisa hasil hitung fisik. Sistem membuat jurnal penyesuaian draf." pemilik="konversi" />;
}
