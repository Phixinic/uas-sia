import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import HalamanBelumJadi from "@/komponen/ui/HalamanBelumJadi";

export const metadata: Metadata = { title: "Proses Penyusutan" };

export default async function Halaman() {
  await wajibMasuk();
  return <HalamanBelumJadi judul="Proses Penyusutan" keterangan="Beban penyusutan tiap bulan dijurnal di sini, satu jurnal penyesuaian per periode dengan rincian per aset." pemilik="konversi" />;
}
