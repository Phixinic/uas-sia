import type { Metadata } from "next";
import HalamanPembelian from "@/komponen/konversi/pembelian/HalamanPembelian";

export const metadata: Metadata = { title: "Pembelian Perlengkapan" };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ form?: string; lihat?: string }> }) {
  return <HalamanPembelian jenis="PERLENGKAPAN" cari={await searchParams} />;
}
