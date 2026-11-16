import type { Metadata } from "next";
import HalamanMaster from "@/komponen/master/HalamanMaster";

export const metadata: Metadata = { title: "Master Konversi" };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ tab?: string; form?: string }> }) {
  return <HalamanMaster kelompok="konversi" cari={await searchParams} />;
}
