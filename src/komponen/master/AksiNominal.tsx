"use client";

import { Check, X } from "lucide-react";
import { setujuiNominal, tolakNominal } from "@/lib/aksi/master/nominal";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { labelBulanTahun } from "@/lib/inti/tanggal";

/** Tombol keputusan Owner untuk satu pengajuan nominal. Server action tetap memeriksa peran dan pengamannya. */
export default function AksiNominal({ kode, judul, berlaku, draf, tarif, terhalang }: {
  kode: string;
  /** Contoh "Gaji pokok Golongan II". */
  judul: string;
  berlaku: string;
  /** Slip draf (atau event penilaian untuk tarif) yang ikut nominal baru bila disetujui. */
  draf: string[];
  tarif: boolean;
  /** Pesan pengaman bila pengajuan ini tidak bisa disetujui lagi. */
  terhalang: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <TombolAksi
        aksi={() => setujuiNominal({ kode })}
        varian="utama"
        ikon={<Check className="size-4" />}
        judul={`Setujui ${kode}`}
        disabled={!!terhalang}
        konfirmasi={{
          judul: `Setujui ${kode}?`,
          pesan: (
            <span className="block space-y-2">
              <span className="block">{judul} berlaku mulai {labelBulanTahun(berlaku)}. Tidak ada jurnal yang dibuat sekarang; nominal ini dipakai {tarif ? "fee event yang selesai" : "slip gaji"} bulan itu dan sesudahnya.</span>
              {draf.length > 0 && (
                <span className="block font-medium text-amber-800">
                  {tarif ? `Usulan fee ${draf.join(", ")} akan memakai tarif baru.` : `Slip draf ${draf.join(", ")} akan ditandai perlu dihitung ulang sebelum bisa diajukan.`}
                </span>
              )}
            </span>
          ),
          labelKonfirmasi: "Setujui",
        }}
      >
        Setujui
      </TombolAksi>
      <TombolAksi
        aksi={(alasan) => tolakNominal({ kode, alasan })}
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
