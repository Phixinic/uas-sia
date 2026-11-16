import type { Metadata } from "next";
import HalamanHitungGaji, { type CariGaji } from "@/komponen/sdm/HalamanHitungGaji";

export const metadata: Metadata = { title: "Hitung Gaji" };

export default async function Halaman({ searchParams }: { searchParams: Promise<CariGaji> }) {
  return <HalamanHitungGaji cari={await searchParams} />;
}
