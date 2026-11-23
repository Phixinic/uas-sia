"use client";

import { Check, X } from "lucide-react";
import { setujuiInvestasiKas, tolakInvestasiKas } from "@/lib/aksi/modal/investasi-kas";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { boleh, type Peran } from "@/lib/peran";
import { rupiah } from "@/lib/format";
import { labelTanggal } from "@/lib/inti/tanggal";
import type { StatusPersetujuan } from "@/generated/prisma/enums";

/** Tombol keputusan per setoran. Hanya Owner (IZIN["investasi-kas.putuskan"]) dan hanya untuk setoran DIAJUKAN. */
export default function AksiInvestasiKas({ no, status, jumlah, tanggal, peran }: { no: string; status: StatusPersetujuan; jumlah: number; tanggal: string; peran: Peran }) {
  if (status !== "DIAJUKAN" || !boleh(peran, "investasi-kas.putuskan")) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <TombolAksi
        aksi={() => setujuiInvestasiKas({ no })}
        varian="utama"
        ikon={<Check className="size-4" />}
        judul={`Setujui ${no}`}
        konfirmasi={{
          judul: `Setujui ${no}?`,
          pesan: `Jurnal umum langsung berlaku bertanggal ${labelTanggal(tanggal)}: Debit Kas ${rupiah(jumlah)}, Kredit Modal Pemilik ${rupiah(jumlah)}.`,
          labelKonfirmasi: "Setujui",
        }}
      >
        Setujui
      </TombolAksi>
      <TombolAksi
        aksi={(alasan) => tolakInvestasiKas({ no, alasan })}
        varian="bahaya"
        ikon={<X className="size-4" />}
        judul={`Tolak ${no}`}
        konfirmasi={{ judul: `Tolak ${no}`, perluAlasan: true, labelAlasan: "Alasan penolakan", labelKonfirmasi: "Tolak setoran" }}
      >
        Tolak
      </TombolAksi>
    </div>
  );
}
