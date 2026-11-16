import { angka, rupiah } from "@/lib/format";

/** Angka rupiah rata kanan dengan digit tabular. `polos` = tanpa awalan "Rp" (untuk kolom tabel berjudul "(Rp)"). */
export default function Rupiah({ nilai, polos, kosongJikaNol, warnaNegatif, className = "" }: {
  nilai: number | null | undefined;
  polos?: boolean;
  kosongJikaNol?: boolean;
  warnaNegatif?: boolean;
  className?: string;
}) {
  if (kosongJikaNol && !nilai) return <span className={className} />;
  const negatif = (nilai ?? 0) < 0;
  return <span className={`angka whitespace-nowrap ${warnaNegatif && negatif ? "text-rose-600" : ""} ${className}`}>{polos ? angka(nilai) : rupiah(nilai)}</span>;
}
