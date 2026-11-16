"use client";

import { useRouter } from "next/navigation";
import { Pilihan } from "@/komponen/ui/Isian";
import { labelPeriode } from "@/lib/inti/tanggal";

/** Pilihan periode yang disimpan di query string (?periode=YYYY-MM), jadi bisa dibagikan dan tombol kembali bekerja. */
export default function PemilihPeriode({ alamat, periode, pilihan }: { alamat: string; periode: string; pilihan: string[] }) {
  const router = useRouter();
  return (
    <div className="bidang">
      <label className="label" htmlFor="pemilih-periode">Periode</label>
      <Pilihan id="pemilih-periode" value={periode} onChange={(e) => router.push(`${alamat}?periode=${e.target.value}`)}>
        {[...pilihan].reverse().map((p) => (
          <option key={p} value={p}>{labelPeriode(p)}</option>
        ))}
      </Pilihan>
    </div>
  );
}
