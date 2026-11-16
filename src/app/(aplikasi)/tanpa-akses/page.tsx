import { ShieldAlert } from "lucide-react";
import { wajibMasuk } from "@/lib/server/auth";
import { LABEL_PERAN } from "@/lib/peran";
import Kartu from "@/komponen/ui/Kartu";
import { TautanTombol } from "@/komponen/ui/Tombol";

export default async function TanpaAkses() {
  const p = await wajibMasuk();
  return (
    <Kartu className="mx-auto max-w-lg space-y-3 text-center">
      <ShieldAlert className="mx-auto size-10 text-amber-500" aria-hidden />
      <h1 className="text-lg font-semibold">Halaman ini bukan untuk peran {LABEL_PERAN[p.peran]}</h1>
      <p className="teks-redup">Kalau kamu perlu membukanya, minta Owner mengubah peran akunmu.</p>
      <TautanTombol href="/" varian="utama">Kembali ke dashboard</TautanTombol>
    </Kartu>
  );
}
