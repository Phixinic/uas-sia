import type { Metadata } from "next";
import HalamanSettingGaji, { type CariSettingGaji } from "@/komponen/master/HalamanSettingGaji";

export const metadata: Metadata = { title: "Setting Gaji" };

export default async function Halaman({ searchParams }: { searchParams: Promise<CariSettingGaji> }) {
  return <HalamanSettingGaji cari={await searchParams} />;
}
