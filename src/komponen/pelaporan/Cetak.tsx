"use client";

import { Printer } from "lucide-react";
import Tombol from "@/komponen/ui/Tombol";

/** Tombol cetak browser. Gaya cetak (sidebar dan topbar disembunyikan) ada di GayaCetak. */
export function TombolCetak() {
  return (
    <Tombol varian="garis" ikon={<Printer className="size-4" />} onClick={() => window.print()} className="tanpa-cetak">
      Cetak
    </Tombol>
  );
}

/** Pasang sekali per halaman laporan. Menyembunyikan kerangka aplikasi saat dicetak dan merapikan tabel. */
export function GayaCetak() {
  return (
    <style>{`
      .hanya-cetak { display: none; }
      @media print {
        @page { margin: 14mm; }
        aside, header, footer, .tanpa-cetak, nav { display: none !important; }
        .hanya-cetak { display: block; }
        body { background: #fff !important; }
        div[class*="lg:pl-"] { padding-left: 0 !important; }
        main { max-width: none !important; padding: 0 !important; }
        .kartu { box-shadow: none !important; border-color: #cbd5e1 !important; }
        .bungkus-tabel { overflow: visible !important; }
        tr { break-inside: avoid; }
      }
    `}</style>
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
