"use client";

/* Pilih periode (bulan) lewat query string ?periode=YYYY-MM; keadaan lain di URL dibuang supaya tampilan konsisten. */
import { usePathname, useRouter } from "next/navigation";
import { Bidang, Pilihan } from "@/komponen/ui/Isian";
import { labelPeriode } from "@/lib/inti/tanggal";

export default function PilihPeriode({ terpilih, opsi }: { terpilih: string; opsi: string[] }) {
  const router = useRouter();
  const alamat = usePathname();
  return (
    <Bidang label="Periode" htmlFor="pilih-periode" className="min-w-44">
      <Pilihan id="pilih-periode" value={terpilih} onChange={(e) => router.push(`${alamat}?periode=${e.target.value}`)}>
        {opsi.map((p) => (
          <option key={p} value={p}>
            {labelPeriode(p)}
          </option>
        ))}
      </Pilihan>
    </Bidang>
  );
}
