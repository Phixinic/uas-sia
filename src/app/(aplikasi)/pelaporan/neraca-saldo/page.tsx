import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import HalamanBelumJadi from "@/komponen/ui/HalamanBelumJadi";

export const metadata: Metadata = { title: "Neraca Saldo" };

export default async function Halaman() {
  await wajibMasuk();
  return <HalamanBelumJadi judul="Neraca Saldo" keterangan="Saldo semua akun sampai akhir periode." pemilik="pelaporan dan master" />;
}
