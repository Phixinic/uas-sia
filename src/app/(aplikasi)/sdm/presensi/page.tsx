import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import HalamanBelumJadi from "@/komponen/ui/HalamanBelumJadi";

export const metadata: Metadata = { title: "Presensi" };

export default async function Halaman() {
  await wajibMasuk();
  return <HalamanBelumJadi judul="Presensi" keterangan="Catatan kehadiran harian dan rekapnya per periode." pemilik="SDM" />;
}
