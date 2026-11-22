import Link from "next/link";
import { TAHAP, type Tahap } from "@/lib/inti/buku-besar";

export const LABEL_TAHAP: Record<Tahap, string> = { sebelum: "Sebelum penyesuaian", setelah: "Setelah penyesuaian" };

/** Judul laporan per tahap, misalnya "Neraca Saldo Setelah Penyesuaian". */
export const judulTahap = (laporan: string, tahap: Tahap) => `${laporan} ${tahap === "sebelum" ? "Sebelum" : "Setelah"} Penyesuaian`;

/**
 * Pilihan tahap siklus akuntansi lewat `?tahap=sebelum|setelah`. Parameter lain (akun, periode) ikut dibawa
 * supaya pilihan filter tidak hilang. Tidak ikut tercetak (semua `nav` disembunyikan saat cetak).
 */
export default function PilihTahap({ alamat, tahap, param }: { alamat: string; tahap: Tahap; param: Record<string, string> }) {
  return (
    <div className="bidang">
      <span className="label" id="label-tahap">Tahap</span>
      <nav aria-labelledby="label-tahap" className="inline-flex h-9 w-fit items-stretch rounded-lg border border-slate-300 bg-white p-0.5">
        {TAHAP.map((t) => {
          const q = new URLSearchParams({ ...param, tahap: t });
          const aktif = t === tahap;
          return (
            <Link
              key={t}
              href={`${alamat}?${q.toString()}`}
              aria-current={aktif ? "page" : undefined}
              className={`inline-flex items-center rounded-md px-3 text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksen ${aktif ? "bg-merek text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
            >
              {LABEL_TAHAP[t]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
