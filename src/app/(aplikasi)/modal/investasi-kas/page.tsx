import type { Metadata } from "next";
import HalamanInvestasiKas from "@/komponen/modal/HalamanInvestasiKas";

export const metadata: Metadata = { title: "Investasi Kas" };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ form?: string; periode?: string; bulan?: string; tahun?: string }> }) {
  return <HalamanInvestasiKas cari={await searchParams} />;
}
