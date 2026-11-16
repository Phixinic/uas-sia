import type { Metadata } from "next";
import HalamanPelepasan from "@/komponen/konversi/pelepasan/HalamanPelepasan";

export const metadata: Metadata = { title: "Pelepasan Peralatan" };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ form?: string; lihat?: string; aset?: string }> }) {
  return <HalamanPelepasan cari={await searchParams} />;
}
