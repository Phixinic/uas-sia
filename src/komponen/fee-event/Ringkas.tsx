/*
 * Tampilan ringkas modul fee event untuk layar sempit: di bawah `md` daftar tampil sebagai kartu bertumpuk,
 * di layar lebar tabel penuh. Polanya sama dengan Hitung Gaji (md:hidden / hidden md:block), jadi tidak ada geser ke samping.
 */
import type { ReactNode } from "react";

/** Daftar kartu untuk layar sempit; tersembunyi mulai `md`. */
export function DaftarHP({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul className="divide-y divide-slate-100 md:hidden" aria-label={`${label} (ringkas)`}>
      {children}
    </ul>
  );
}

/** Satu kartu: judul dan lencana di atas, isi di bawah. `nada` memberi latar merah muda untuk baris yang perlu perhatian. */
export function KartuHP({ judul, sub, kanan, nada, children }: { judul: ReactNode; sub?: ReactNode; kanan?: ReactNode; nada?: "kurang"; children?: ReactNode }) {
  return (
    <li className={`space-y-2 px-4 py-3 ${nada === "kurang" ? "bg-rose-50/50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium break-words text-slate-900">{judul}</div>
          {sub && <div className="text-[12px] text-slate-500">{sub}</div>}
        </div>
        {kanan && <div className="shrink-0 text-right">{kanan}</div>}
      </div>
      {children}
    </li>
  );
}

/** Pasangan label dan nilai kecil di dalam kartu (grid 2 atau 3 kolom). */
export function RincianHP({ isi, kolom = 2 }: { isi: [string, ReactNode][]; kolom?: 2 | 3 }) {
  return (
    <dl className={`grid gap-2 text-xs ${kolom === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {isi.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-slate-500">{k}</dt>
          <dd className="font-medium break-words text-slate-800">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Pembungkus tabel penuh: hanya tampil mulai `md`. */
export function TabelLebar({ children }: { children: ReactNode }) {
  return <div className="hidden md:block">{children}</div>;
}
