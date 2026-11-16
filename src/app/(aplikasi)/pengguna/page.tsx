import type { Metadata } from "next";
import { wajibPeranHalaman } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import HalamanBelumJadi from "@/komponen/ui/HalamanBelumJadi";

export const metadata: Metadata = { title: "Pengguna" };

export default async function Halaman() {
  await wajibPeranHalaman(IZIN["pengguna.kelola"]);
  return <HalamanBelumJadi judul="Pengguna" keterangan="Kelola akun Admin, HRD, dan Owner." pemilik="pelaporan dan master" />;
}
