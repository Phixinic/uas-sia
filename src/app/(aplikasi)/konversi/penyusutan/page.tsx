import type { Metadata } from "next";
import HalamanPenyusutan from "@/komponen/konversi/penyusutan/HalamanPenyusutan";

export const metadata: Metadata = { title: "Proses Penyusutan" };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ periode?: string; bulan?: string; tahun?: string }> }) {
  return <HalamanPenyusutan cari={await searchParams} />;
}
