"use client";

/* Tombol tingkat halaman untuk hitung gaji dan distribusi. Visibilitas dijaga pemanggil; server action memeriksa peran sendiri. */
import { Calculator, Check, Send, X } from "lucide-react";
import { hitungSlipSemua } from "@/lib/aksi/sdm/gaji";
import { ajukanPenggajian, setujuiPenggajian, tolakPenggajian } from "@/lib/aksi/sdm/distribusi";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { labelPeriode, rupiah } from "@/lib/format";

export function TombolHitungSemua({ periode, jumlah }: { periode: string; jumlah: number }) {
  return (
    <TombolAksi
      aksi={() => hitungSlipSemua({ periode })}
      varian="utama"
      kecil={false}
      ikon={<Calculator className="size-4" />}
      disabled={jumlah === 0}
      konfirmasi={{ judul: `Hitung dan simpan ${jumlah} slip?`, pesan: `Slip draf ${labelPeriode(periode)} dibuat atau dihitung ulang dari presensi dan setting gaji terbaru. Slip yang sudah diajukan tidak disentuh.`, labelKonfirmasi: "Hitung dan simpan" }}
    >
      Hitung dan simpan semua ({jumlah})
    </TombolAksi>
  );
}

export function TombolAjukan({ periode, jumlah, thp }: { periode: string; jumlah: number; thp: number }) {
  return (
    <TombolAksi
      aksi={() => ajukanPenggajian({ periode })}
      varian="utama"
      kecil={false}
      ikon={<Send className="size-4" />}
      konfirmasi={{ judul: "Ajukan penggajian ke Owner?", pesan: `${jumlah} slip ${labelPeriode(periode)} dengan total THP ${rupiah(thp)} diajukan. Presensi periode ini terkunci sampai Owner memutuskan.`, labelKonfirmasi: "Ajukan" }}
    >
      Ajukan ke Owner
    </TombolAksi>
  );
}

export function AksiPengajuan({ no, thp }: { no: string; thp: number }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <TombolAksi
        aksi={() => setujuiPenggajian({ no })}
        varian="utama"
        ikon={<Check className="size-4" />}
        konfirmasi={{ judul: `Setujui ${no}?`, pesan: `Jurnal umum dibuat dan kas berkurang ${rupiah(thp)}. Slip menjadi Dibayar.`, labelKonfirmasi: "Setujui dan bayar" }}
      >
        Setujui dan bayar
      </TombolAksi>
      <TombolAksi
        aksi={(alasan) => tolakPenggajian({ no, alasan })}
        varian="bahaya"
        ikon={<X className="size-4" />}
        konfirmasi={{ judul: `Tolak ${no}`, pesan: "Slip kembali menjadi draf dan bisa diajukan ulang oleh HRD.", perluAlasan: true, labelAlasan: "Alasan penolakan", labelKonfirmasi: "Tolak pengajuan" }}
      >
        Tolak
      </TombolAksi>
    </div>
  );
}
