import type { Metadata } from "next";
import HalamanDistribusi, { type CariDistribusi } from "@/komponen/sdm/HalamanDistribusi";

export const metadata: Metadata = { title: "Distribusi Gaji" };

export default async function Halaman({ searchParams }: { searchParams: Promise<CariDistribusi> }) {
  return <HalamanDistribusi cari={await searchParams} />;
}
