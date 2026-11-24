"use client";

import { Calculator } from "lucide-react";
import { prosesPenyusutan } from "@/lib/aksi/konversi/penyusutan";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { labelPeriode } from "@/lib/inti/tanggal";
import { rupiah } from "@/lib/format";

export default function TombolProses({ periode, jumlah, total, disabled }: { periode: string; jumlah: number; total: number; disabled?: boolean }) {
  return (
    <TombolAksi
      aksi={() => prosesPenyusutan({ periode })}
      varian="utama"
      kecil={false}
      disabled={disabled}
      ikon={<Calculator className="size-4" />}
      konfirmasi={{
        judul: `Proses penyusutan ${labelPeriode(periode)}?`,
        pesan: `Beban ${rupiah(total)} dari ${jumlah} aset dijurnal sebagai jurnal penyesuaian yang langsung disetujui dan masuk buku besar. Jadwal aset ditandai sudah diproses.`,
        labelKonfirmasi: "Proses penyusutan",
      }}
    >
      Proses penyusutan
    </TombolAksi>
  );
}
