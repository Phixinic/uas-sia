"use client";

import { Printer } from "lucide-react";
import Tombol from "@/komponen/ui/Tombol";

/** Tombol cetak browser. Gaya cetak ada di globals.css (bagian "Cetak"). */
export function TombolCetak() {
  return (
    <Tombol varian="garis" ikon={<Printer className="size-4" />} onClick={() => window.print()} className="tanpa-cetak">
      Cetak
    </Tombol>
  );
}

/** Judul laporan yang hanya muncul di kertas. */
export function KepalaCetak({ usaha, judul, keterangan }: { usaha: string; judul: string; keterangan?: string }) {
  return (
    <div className="hanya-cetak mb-3 border-b border-slate-300 pb-2">
      <div className="text-sm font-semibold">{usaha}</div>
      <div className="text-lg font-bold">{judul}</div>
      {keterangan && <div className="text-xs text-slate-600">{keterangan}</div>}
    </div>
  );
}
