import type { Metadata } from "next";
import HalamanMaster from "@/komponen/master/HalamanMaster";

export const metadata: Metadata = { title: "Master SDM" };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ tab?: string; form?: string; jenis?: string; karyawan?: string; nominal?: string; riwayat?: string; kelompok?: string }> }) {
  return <HalamanMaster kelompok="sdm" cari={await searchParams} />;
}
