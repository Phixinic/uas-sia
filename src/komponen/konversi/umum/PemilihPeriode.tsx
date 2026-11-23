"use client";

import PilihBulanTahun from "@/komponen/ui/PilihBulanTahun";

/** Pilihan periode lewat Bulan dan Tahun terpisah (?bulan=11&tahun=2026), jadi bisa dibagikan dan tombol kembali bekerja. */
export default function PemilihPeriode({ periode, pilihan }: { alamat?: string; periode: string; pilihan: string[] }) {
  return <PilihBulanTahun periode={periode} tersedia={pilihan} pertahankan={false} idAwalan="pemilih" />;
}
