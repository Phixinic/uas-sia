import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import HalamanBelumJadi from "@/komponen/ui/HalamanBelumJadi";

export const metadata: Metadata = { title: "Jurnal Penyesuaian" };

export default async function Halaman() {
  await wajibMasuk();
  return <HalamanBelumJadi judul="Jurnal Penyesuaian" keterangan="Admin mengajukan, Owner menyetujui atau menolak dengan alasan." pemilik="pelaporan dan master" />;
}
