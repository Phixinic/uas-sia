import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import HalamanBelumJadi from "@/komponen/ui/HalamanBelumJadi";

export const metadata: Metadata = { title: "Hitung Gaji" };

export default async function Halaman() {
  await wajibMasuk();
  return <HalamanBelumJadi judul="Hitung Gaji" keterangan="Gaji dihitung dari setting gaji dan rekap presensi, disimpan sebagai slip draf." pemilik="SDM" />;
}
