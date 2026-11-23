import Lencana from "@/komponen/ui/Lencana";
import { labelBulanTahun } from "@/lib/inti/tanggal";

/**
 * Penanda periode di judul layar: "Bulan: November · Tahun: 2026". `sampai` untuk laporan saldo kumulatif
 * ("Sampai akhir · Bulan: November · Tahun: 2026").
 */
export default function LencanaPeriode({ periode, sampai }: { periode: string; sampai?: boolean }) {
  if (periode === "semua") return <Lencana warna="abu">Semua periode</Lencana>;
  return <Lencana warna="abu">{sampai ? "Sampai akhir · " : ""}{labelBulanTahun(periode)}</Lencana>;
}
