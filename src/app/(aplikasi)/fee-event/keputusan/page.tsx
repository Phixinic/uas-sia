import type { Metadata } from "next";
import HalamanKeputusan, { type CariKeputusan } from "@/komponen/fee-event/HalamanKeputusan";

export const metadata: Metadata = { title: "Laporan & Fee" };

export default async function Halaman({ searchParams }: { searchParams: Promise<CariKeputusan> }) {
  return <HalamanKeputusan cari={await searchParams} />;
}
