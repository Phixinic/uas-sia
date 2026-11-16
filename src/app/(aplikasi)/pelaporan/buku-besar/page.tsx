import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import HalamanBelumJadi from "@/komponen/ui/HalamanBelumJadi";

export const metadata: Metadata = { title: "Buku Besar" };

export default async function Halaman() {
  await wajibMasuk();
  return <HalamanBelumJadi judul="Buku Besar" keterangan="Saldo berjalan per akun dari jurnal yang disetujui." pemilik="pelaporan dan master" />;
}
