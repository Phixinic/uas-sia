"use client";

import { Calculator, CheckCheck } from "lucide-react";
import { prosesPenyusutan, setujuiSemuaPenyusutan } from "@/lib/aksi/konversi/penyusutan";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { labelPeriode } from "@/lib/inti/tanggal";
import { rupiah } from "@/lib/format";

/**
 * Admin: "Proses penyusutan" untuk satu periode. Owner: "Setujui semua", yang sekaligus menyetujui periode lebih lama
 * yang belum diproses (`sebelumnya`), berurutan dari yang paling lama.
 */
export default function TombolProses({ periode, jumlah, total, disabled, untukOwner, sebelumnya = [] }: { periode: string; jumlah: number; total: number; disabled?: boolean; untukOwner?: boolean; sebelumnya?: string[] }) {
  const label = untukOwner ? "Setujui semua" : "Proses penyusutan";
  const ikut = untukOwner && sebelumnya.length ? `Periode lebih lama yang belum diproses ikut disetujui lebih dulu: ${sebelumnya.map(labelPeriode).join(", ")}. ` : "";
  const ini = jumlah ? `Beban ${labelPeriode(periode)} ${rupiah(total)} dari ${jumlah} aset. ` : "";
  return (
    <TombolAksi
      aksi={() => (untukOwner ? setujuiSemuaPenyusutan({ periode }) : prosesPenyusutan({ periode }))}
      varian="utama"
      kecil={false}
      disabled={disabled}
      ikon={untukOwner ? <CheckCheck className="size-4" /> : <Calculator className="size-4" />}
      konfirmasi={{
        judul: `${untukOwner ? "Setujui semua" : "Proses"} penyusutan ${labelPeriode(periode)}?`,
        pesan: `${ikut}${ini}Tiap periode dibuatkan jurnal penyesuaian yang langsung disetujui dan masuk buku besar. Jadwal aset ditandai sudah diproses.`,
        labelKonfirmasi: label,
      }}
    >
      {label}
    </TombolAksi>
  );
}
