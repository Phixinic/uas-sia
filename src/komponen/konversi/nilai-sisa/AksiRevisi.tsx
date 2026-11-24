"use client";

import { Check, Undo2 } from "lucide-react";
import { kembalikanRevisiNilaiSisa, setujuiRevisiNilaiSisa } from "@/lib/aksi/konversi/nilai-sisa";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { rupiah } from "@/lib/format";

/** Tombol keputusan Owner untuk satu revisi nilai sisa. Server action tetap memeriksa peran sendiri. */
export default function AksiRevisi({ no, totalLama, totalBaru }: { no: string; totalLama: number; totalBaru: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TombolAksi
        aksi={() => setujuiRevisiNilaiSisa({ no })}
        varian="utama"
        ikon={<Check className="size-4" />}
        konfirmasi={{ judul: `Setujui revisi ${no}?`, pesan: `Jurnal biaya perlengkapan yang berlaku (${rupiah(totalLama)}) dibalik, lalu jurnal baru ${rupiah(totalBaru)} dibuat. Keduanya langsung masuk buku besar.` }}
      >
        Setujui revisi
      </TombolAksi>
      <TombolAksi
        aksi={(alasan) => kembalikanRevisiNilaiSisa({ no, alasan })}
        varian="bahaya"
        ikon={<Undo2 className="size-4" />}
        konfirmasi={{ judul: `Kembalikan revisi ${no}`, pesan: "Nilai sisa yang berlaku tidak berubah. Admin melihat alasanmu lalu bisa mengajukan revisi baru.", perluAlasan: true, labelAlasan: "Alasan dikembalikan", labelKonfirmasi: "Kembalikan untuk revisi" }}
      >
        Kembalikan untuk revisi
      </TombolAksi>
    </div>
  );
}
