import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import HalamanBelumJadi from "@/komponen/ui/HalamanBelumJadi";

export const metadata: Metadata = { title: "Jurnal Umum" };

export default async function Halaman() {
  await wajibMasuk();
  return <HalamanBelumJadi judul="Jurnal Umum" keterangan="Jurnal umum dan pembalik yang sudah disetujui." pemilik="pelaporan dan master" />;
}
