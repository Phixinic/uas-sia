import type { Metadata } from "next";
import HalamanPembelian from "@/komponen/konversi/pembelian/HalamanPembelian";

export const metadata: Metadata = { title: "Pembelian Peralatan" };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ form?: string; lihat?: string }> }) {
  return <HalamanPembelian jenis="PERALATAN" cari={await searchParams} />;
}
