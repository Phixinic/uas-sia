import { Construction } from "lucide-react";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu from "@/komponen/ui/Kartu";

/** Pengganti sementara untuk halaman yang belum dibangun. Hapus saat halamannya dikerjakan. */
export default function HalamanBelumJadi({ judul, keterangan, pemilik }: { judul: string; keterangan: string; pemilik: string }) {
  return (
    <>
      <KepalaHalaman judul={judul} keterangan={keterangan} />
      <Kartu className="flex items-start gap-3">
        <Construction className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden />
        <div>
          <p className="font-medium text-slate-800">Halaman ini sedang dibangun.</p>
          <p className="teks-redup">Dikerjakan oleh agen {pemilik}. Lihat docs/KONTRAK.md.</p>
        </div>
      </Kartu>
    </>
  );
}
