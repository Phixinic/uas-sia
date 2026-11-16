import type { ReactNode } from "react";
import { rupiah } from "@/lib/format";

/** Kartu angka ringkas untuk dashboard dan kepala halaman. Angka number ditampilkan sebagai rupiah kecuali `bukanUang`. */
export default function KartuRingkasan({ judul, nilai, keterangan, ikon, bukanUang, nada = "netral" }: {
  judul: string;
  nilai: number | string;
  keterangan?: ReactNode;
  ikon?: ReactNode;
  bukanUang?: boolean;
  nada?: "netral" | "hijau" | "kuning" | "merah";
}) {
  const warnaIkon = { netral: "bg-slate-100 text-slate-600", hijau: "bg-emerald-50 text-emerald-700", kuning: "bg-amber-50 text-amber-700", merah: "bg-rose-50 text-rose-700" }[nada];
  return (
    <div className="kartu flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        {ikon && <span className={`grid size-7 place-items-center rounded-md ${warnaIkon}`}>{ikon}</span>}
        <span className="truncate">{judul}</span>
      </div>
      <div className="angka text-xl font-bold tracking-tight text-slate-900">{typeof nilai === "number" && !bukanUang ? rupiah(nilai) : nilai}</div>
      {keterangan && <div className="truncate text-[12px] text-slate-500">{keterangan}</div>}
    </div>
  );
}
