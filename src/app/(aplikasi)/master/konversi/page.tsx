import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import HalamanBelumJadi from "@/komponen/ui/HalamanBelumJadi";

export const metadata: Metadata = { title: "Master Konversi" };

export default async function Halaman() {
  await wajibMasuk();
  return <HalamanBelumJadi judul="Master Konversi" keterangan="Supplier, peralatan, perlengkapan, kategori aset, bagan akun, dan profil usaha." pemilik="pelaporan dan master" />;
}
