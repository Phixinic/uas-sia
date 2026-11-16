"use client";

import { Check, Eye, X } from "lucide-react";
import { setujuiPelepasan, tolakPelepasan } from "@/lib/aksi/konversi/pelepasan";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { TautanTombol } from "@/komponen/ui/Tombol";
import { boleh, type Peran } from "@/lib/peran";
import type { StatusPersetujuan } from "@/generated/prisma/enums";

/** Tombol per baris pengajuan. Setujui dan tolak hanya untuk Owner (IZIN["pelepasan.putuskan"]). */
export default function AksiPelepasan({ no, status, peran, alamat, tanpaLihat }: { no: string; status: StatusPersetujuan; peran: Peran; alamat: string; tanpaLihat?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {!tanpaLihat && <TautanTombol href={`${alamat}?lihat=${no}`} kecil varian="hantu" ikon={<Eye className="size-4" />}>Lihat</TautanTombol>}
      {status === "DIAJUKAN" && boleh(peran, "pelepasan.putuskan") && (
        <>
          <TombolAksi
            aksi={() => setujuiPelepasan({ no })}
            varian="utama"
            ikon={<Check className="size-4" />}
            konfirmasi={{ judul: `Setujui ${no}?`, pesan: "Jurnal pelepasan langsung berlaku, aset berstatus dilepas, dan jadwal penyusutan yang belum dijurnal dibatalkan.", labelKonfirmasi: "Setujui" }}
          >
            Setujui
          </TombolAksi>
          <TombolAksi
            aksi={(alasan) => tolakPelepasan({ no, alasan })}
            varian="bahaya"
            ikon={<X className="size-4" />}
            konfirmasi={{ judul: `Tolak ${no}`, perluAlasan: true, labelAlasan: "Alasan penolakan", labelKonfirmasi: "Tolak pengajuan" }}
          >
            Tolak
          </TombolAksi>
        </>
      )}
    </div>
  );
}
