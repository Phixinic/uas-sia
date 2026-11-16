import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

/** Isi pengganti saat daftar masih kosong. */
export default function KeadaanKosong({ judul, keterangan, aksi }: { judul: string; keterangan?: ReactNode; aksi?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Inbox className="size-8 text-slate-300" aria-hidden />
      <p className="font-medium text-slate-700">{judul}</p>
      {keterangan && <p className="max-w-md text-sm text-slate-500">{keterangan}</p>}
      {aksi && <div className="mt-2">{aksi}</div>}
    </div>
  );
}
