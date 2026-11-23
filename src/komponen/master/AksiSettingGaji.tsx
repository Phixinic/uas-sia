"use client";

import { Check, X } from "lucide-react";
import { setujuiSettingGaji, tolakSettingGaji } from "@/lib/aksi/master/setting-gaji";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { labelBulanTahun } from "@/lib/inti/tanggal";

/** Tombol keputusan Owner untuk satu pengajuan setting gaji. Server action tetap memeriksa peran dan pengamannya. */
export default function AksiSettingGaji({ kode, karyawan, berlaku, draf, terhalang }: {
  kode: string;
  karyawan: string;
  berlaku: string;
  /** Nomor slip draf di bulan berlaku atau sesudahnya yang perlu dihitung ulang bila disetujui. */
  draf: string[];
  /** Pesan pengaman bila pengajuan ini tidak bisa disetujui lagi. */
  terhalang: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <TombolAksi
        aksi={() => setujuiSettingGaji({ kode })}
        varian="utama"
        ikon={<Check className="size-4" />}
        judul={`Setujui ${kode}`}
        disabled={!!terhalang}
        konfirmasi={{
          judul: `Setujui ${kode}?`,
          pesan: (
            <span className="block space-y-2">
              <span className="block">Setting gaji {karyawan} berlaku mulai {labelBulanTahun(berlaku)}. Tidak ada jurnal yang dibuat sekarang; gajinya masuk penggajian bulan itu dan sesudahnya.</span>
              {draf.length > 0 && <span className="block font-medium text-amber-800">Slip draf {draf.join(", ")} akan ditandai perlu dihitung ulang sebelum bisa diajukan.</span>}
            </span>
          ),
          labelKonfirmasi: "Setujui",
        }}
      >
        Setujui
      </TombolAksi>
      <TombolAksi
        aksi={(alasan) => tolakSettingGaji({ kode, alasan })}
        varian="bahaya"
        ikon={<X className="size-4" />}
        judul={`Tolak ${kode}`}
        konfirmasi={{ judul: `Tolak ${kode}`, perluAlasan: true, labelAlasan: "Alasan penolakan", labelKonfirmasi: "Tolak pengajuan" }}
      >
        Tolak
      </TombolAksi>
    </div>
  );
}
