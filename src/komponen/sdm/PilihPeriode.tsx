"use client";

/* Pilih periode halaman SDM lewat Bulan dan Tahun terpisah (?bulan=11&tahun=2026); keadaan lain di URL dibuang supaya tampilan konsisten. */
import PilihBulanTahun from "@/komponen/ui/PilihBulanTahun";

export default function PilihPeriode({ terpilih, opsi }: { terpilih: string; opsi: string[] }) {
  return <PilihBulanTahun periode={terpilih} tersedia={opsi} pertahankan={false} idAwalan="pilih" />;
}
