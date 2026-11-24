import type { Metadata } from "next";
import HalamanGajiBulanan, { type CariGajiBulanan } from "@/komponen/sdm/HalamanGajiBulanan";

export const metadata: Metadata = { title: "Gaji Bulanan" };

export default async function Halaman({ searchParams }: { searchParams: Promise<CariGajiBulanan> }) {
  return <HalamanGajiBulanan cari={await searchParams} />;
}
