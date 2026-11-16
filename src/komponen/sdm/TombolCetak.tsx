"use client";

import { Printer } from "lucide-react";
import Tombol from "@/komponen/ui/Tombol";

export default function TombolCetak({ label = "Cetak" }: { label?: string }) {
  return (
    <Tombol varian="utama" kecil ikon={<Printer className="size-4" />} onClick={() => window.print()}>
      {label}
    </Tombol>
  );
}
