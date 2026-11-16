import type { Metadata } from "next";
import HalamanPresensi, { type CariPresensi } from "@/komponen/sdm/HalamanPresensi";

export const metadata: Metadata = { title: "Presensi" };

export default async function Halaman({ searchParams }: { searchParams: Promise<CariPresensi> }) {
  return <HalamanPresensi cari={await searchParams} />;
}
