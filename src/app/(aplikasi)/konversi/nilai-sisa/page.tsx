import type { Metadata } from "next";
import HalamanNilaiSisa from "@/komponen/konversi/nilai-sisa/HalamanNilaiSisa";

export const metadata: Metadata = { title: "Nilai Sisa Perlengkapan" };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ periode?: string; bulan?: string; tahun?: string; revisi?: string }> }) {
  return <HalamanNilaiSisa cari={await searchParams} />;
}
