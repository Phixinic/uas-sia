"use client";

import { Calculator, CheckCheck } from "lucide-react";
import { prosesPenyusutan } from "@/lib/aksi/konversi/penyusutan";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { labelPeriode } from "@/lib/inti/tanggal";
import { rupiah } from "@/lib/format";

/** Satu tombol untuk seluruh aset di periode itu. Owner melihatnya sebagai "Setujui semua", Admin "Proses penyusutan". */
export default function TombolProses({ periode, jumlah, total, disabled, untukOwner }: { periode: string; jumlah: number; total: number; disabled?: boolean; untukOwner?: boolean }) {
  const label = untukOwner ? "Setujui semua" : "Proses penyusutan";
  return (
    <TombolAksi
      aksi={() => prosesPenyusutan({ periode })}
      varian="utama"
      kecil={false}
      disabled={disabled}
      ikon={untukOwner ? <CheckCheck className="size-4" /> : <Calculator className="size-4" />}
      konfirmasi={{
        judul: `${untukOwner ? "Setujui semua" : "Proses"} penyusutan ${labelPeriode(periode)}?`,
        pesan: `Beban ${rupiah(total)} dari ${jumlah} aset dijurnal sebagai jurnal penyesuaian yang langsung disetujui dan masuk buku besar. Jadwal aset ditandai sudah diproses.`,
        labelKonfirmasi: label,
      }}
    >
      {label}
    </TombolAksi>
  );
}
