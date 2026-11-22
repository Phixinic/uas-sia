import type { Metadata } from "next";
import HalamanKapten from "@/komponen/fee-event/HalamanKapten";

export const metadata: Metadata = { title: "Penilaian Crew" };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ lihat?: string }> }) {
  return <HalamanKapten cari={await searchParams} />;
}
