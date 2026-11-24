"use client";

import { Check, Send, Undo2, X } from "lucide-react";
import { ajukanJurnalPenyesuaian, setujuiJurnalPenyesuaian, tolakJurnalPenyesuaian } from "@/lib/aksi/pelaporan/jurnal";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { boleh, type Peran } from "@/lib/peran";
import type { StatusPersetujuan, SumberJurnal } from "@/generated/prisma/enums";

/**
 * Tombol per jurnal penyesuaian. Server action tetap memeriksa peran sendiri; ini hanya soal tampilan.
 * Jurnal penyusutan tidak punya tombol: langsung disetujui saat diproses.
 */
export default function AksiJurnal({ no, status, dibuatOlehId, penggunaId, peran, sumber }: {
  no: string;
  status: StatusPersetujuan;
  dibuatOlehId: number;
  penggunaId: number;
  peran: Peran;
  sumber?: SumberJurnal | null;
}) {
  if (sumber === "PENYUSUTAN") return null;
  if (status === "DRAFT" && boleh(peran, "jurnal-penyesuaian.ajukan")) {
    return (
      <TombolAksi aksi={() => ajukanJurnalPenyesuaian({ no })} varian="utama" ikon={<Send className="size-4" />} konfirmasi={{ judul: `Ajukan ${no} ke Owner?`, pesan: "Sesudah diajukan, jurnal menunggu keputusan Owner dan tidak bisa diubah." }}>
        Ajukan ke Owner
      </TombolAksi>
    );
  }
  if (status === "DIAJUKAN" && boleh(peran, "jurnal-penyesuaian.putuskan")) {
    if (dibuatOlehId === penggunaId) return <span className="text-xs text-slate-500">Pembuat tidak boleh menyetujui jurnalnya sendiri</span>;
    return (
      <>
        <TombolAksi aksi={() => setujuiJurnalPenyesuaian({ no })} varian="utama" ikon={<Check className="size-4" />} konfirmasi={{ judul: `Setujui ${no}?`, pesan: "Jurnal langsung masuk buku besar dan neraca saldo." }}>
          Setujui
        </TombolAksi>
        {sumber === "OPNAME" ? (
          <TombolAksi aksi={(alasan) => tolakJurnalPenyesuaian({ no, alasan })} varian="bahaya" ikon={<Undo2 className="size-4" />} konfirmasi={{ judul: `Kembalikan ${no} untuk revisi`, pesan: "Admin melihat alasanmu, mengubah nilai sisanya, lalu mengajukan ulang. Jurnal ini tetap tercatat di riwayat.", perluAlasan: true, labelAlasan: "Alasan dikembalikan", labelKonfirmasi: "Kembalikan untuk revisi" }}>
            Kembalikan untuk revisi
          </TombolAksi>
        ) : (
          <TombolAksi aksi={(alasan) => tolakJurnalPenyesuaian({ no, alasan })} varian="bahaya" ikon={<X className="size-4" />} konfirmasi={{ judul: `Tolak ${no}`, pesan: "Dokumen sumbernya dibuka lagi supaya Admin bisa memproses ulang.", perluAlasan: true, labelAlasan: "Alasan penolakan", labelKonfirmasi: "Tolak jurnal" }}>
            Tolak
          </TombolAksi>
        )}
      </>
    );
  }
  return null;
}
