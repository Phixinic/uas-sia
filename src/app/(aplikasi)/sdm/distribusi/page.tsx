import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import HalamanBelumJadi from "@/komponen/ui/HalamanBelumJadi";

export const metadata: Metadata = { title: "Distribusi Gaji" };

export default async function Halaman() {
  await wajibMasuk();
  return <HalamanBelumJadi judul="Distribusi Gaji" keterangan="Slip draf diajukan HRD, disetujui Owner, lalu dijurnal dan dibayar." pemilik="SDM" />;
}
