import type { Metadata } from "next";
import HalamanKartuAset from "@/komponen/konversi/aset/HalamanKartuAset";

export const metadata: Metadata = { title: "Kartu Aset" };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ status?: string; aset?: string }> }) {
  return <HalamanKartuAset cari={await searchParams} />;
}
