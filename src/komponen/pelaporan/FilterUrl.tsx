"use client";

import { useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pilihan } from "@/komponen/ui/Isian";

/**
 * Pilihan yang menyimpan nilainya di query string (?nama=nilai), jadi keadaan halaman bisa dibagikan dan
 * tombol kembali bekerja. Parameter lain di URL dipertahankan.
 */
export default function FilterUrl({ nama, label, nilai, opsi }: { nama: string; label: string; nilai: string; opsi: { nilai: string; label: string }[] }) {
  const id = useId();
  const router = useRouter();
  const jalur = usePathname();
  const cari = useSearchParams();
  return (
    <div className="bidang min-w-40">
      <label className="label" htmlFor={id}>{label}</label>
      <Pilihan
        id={id}
        value={nilai}
        onChange={(e) => {
          const p = new URLSearchParams(cari.toString());
          p.set(nama, e.target.value);
          router.push(`${jalur}?${p.toString()}`);
        }}
      >
        {opsi.map((o) => (
          <option key={o.nilai} value={o.nilai}>{o.label}</option>
        ))}
      </Pilihan>
    </div>
  );
}
