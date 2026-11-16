import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import HalamanBelumJadi from "@/komponen/ui/HalamanBelumJadi";

export const metadata: Metadata = { title: "Tutup Periode" };

export default async function Halaman() {
  await wajibMasuk();
  return <HalamanBelumJadi judul="Tutup Periode" keterangan="Daftar periksa, kunci, dan buka kunci periode dengan alasan." pemilik="pelaporan dan master" />;
}
