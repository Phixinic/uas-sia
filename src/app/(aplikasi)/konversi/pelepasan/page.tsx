import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import HalamanBelumJadi from "@/komponen/ui/HalamanBelumJadi";

export const metadata: Metadata = { title: "Pelepasan Peralatan" };

export default async function Halaman() {
  await wajibMasuk();
  return <HalamanBelumJadi judul="Pelepasan Peralatan" keterangan="Peralatan yang dijual, dibuang, atau hilang. Diajukan Admin, diputuskan Owner." pemilik="konversi" />;
}
