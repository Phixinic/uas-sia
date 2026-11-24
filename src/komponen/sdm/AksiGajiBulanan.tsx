"use client";

/* Tombol paket Gaji Bulanan: HRD mengajukan satu bulan, Owner menyetujui (jurnal dan bayar) atau menolak dengan alasan. */
import { Check, Send, X } from "lucide-react";
import { ajukanGajiBulanan, setujuiPenggajian, tolakPenggajian } from "@/lib/aksi/sdm/gaji-bulanan";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { rupiah } from "@/lib/format";
import { labelPeriode } from "@/lib/inti/tanggal";

export function TombolAjukanGaji({ periode, jumlah, thp, tidakIkut, disabled }: { periode: string; jumlah: number; thp: number; tidakIkut: string[]; disabled?: boolean }) {
  return (
    <TombolAksi
      aksi={() => ajukanGajiBulanan({ periode })}
      varian="utama"
      kecil={false}
      disabled={disabled}
      ikon={<Send className="size-4" />}
      konfirmasi={{
        judul: `Ajukan gaji ${labelPeriode(periode)} ke Owner?`,
        pesan: `${jumlah} karyawan, total THP perkiraan ${rupiah(thp)}. Slip dihitung ulang dari data terbaru lalu terkunci sampai Owner memutuskan.${tidakIkut.length ? ` Tidak ikut karena belum ada presensi: ${tidakIkut.join(", ")}.` : ""}`,
        labelKonfirmasi: "Ajukan ke Owner",
      }}
    >
      Ajukan gaji {labelPeriode(periode)} ke Owner
    </TombolAksi>
  );
}

export function AksiPaketOwner({ no, thp }: { no: string; thp: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      <TombolAksi aksi={() => setujuiPenggajian({ no })} varian="utama" kecil={false} ikon={<Check className="size-4" />} konfirmasi={{ judul: `Setujui ${no}?`, pesan: `Jurnal gaji dibuat dan kas berkurang ${rupiah(thp)}. Slip menjadi Dibayar.`, labelKonfirmasi: "Setujui dan bayar" }}>
        Setujui dan bayar
      </TombolAksi>
      <TombolAksi aksi={(alasan) => tolakPenggajian({ no, alasan })} varian="bahaya" kecil={false} ikon={<X className="size-4" />} konfirmasi={{ judul: `Tolak ${no}`, pesan: "Slip kembali ke HRD untuk diperbaiki lalu diajukan ulang.", perluAlasan: true, labelAlasan: "Alasan penolakan", labelKonfirmasi: "Tolak" }}>
        Tolak
      </TombolAksi>
    </div>
  );
}
