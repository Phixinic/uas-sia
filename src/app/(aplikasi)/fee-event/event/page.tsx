import type { Metadata } from "next";
import HalamanEvent, { type CariEvent } from "@/komponen/fee-event/HalamanEvent";

export const metadata: Metadata = { title: "Event & Kehadiran" };

export default async function Halaman({ searchParams }: { searchParams: Promise<CariEvent> }) {
  return <HalamanEvent cari={await searchParams} />;
}
