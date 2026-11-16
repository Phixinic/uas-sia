import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import HalamanBelumJadi from "@/komponen/ui/HalamanBelumJadi";

export const metadata: Metadata = { title: "Master SDM" };

export default async function Halaman() {
  await wajibMasuk();
  return <HalamanBelumJadi judul="Master SDM" keterangan="Karyawan, jabatan, gaji pokok, tunjangan, jadwal kerja, dan setting gaji." pemilik="pelaporan dan master" />;
}
