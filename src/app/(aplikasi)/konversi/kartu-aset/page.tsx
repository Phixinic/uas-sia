import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import HalamanBelumJadi from "@/komponen/ui/HalamanBelumJadi";

export const metadata: Metadata = { title: "Kartu Aset" };

export default async function Halaman() {
  await wajibMasuk();
  return <HalamanBelumJadi judul="Kartu Aset" keterangan="Satu kartu untuk setiap unit peralatan, lengkap dengan rumus dan jadwal penyusutan." pemilik="konversi" />;
}
