import type { ReactNode } from "react";

/** Kartu putih. `rapat` untuk kartu berisi tabel (tanpa padding). */
export default function Kartu({ rapat, className = "", id, label, children }: { rapat?: boolean; className?: string; id?: string; label?: string; children: ReactNode }) {
  return <section id={id} aria-label={label} className={`kartu ${rapat ? "kartu-rapat" : ""} ${className}`}>{children}</section>;
}

/** Kepala kartu: judul, keterangan kecil, dan aksi di kanan. Dipakai di dalam <Kartu rapat>. */
export function KepalaKartu({ judul, keterangan, aksi }: { judul: ReactNode; keterangan?: ReactNode; aksi?: ReactNode }) {
  return (
    <div className="kepala-kartu">
      <div className="min-w-0">
        <h2 className="judul-kartu">{judul}</h2>
        {keterangan && <p className="mt-0.5 text-xs text-slate-500">{keterangan}</p>}
      </div>
      {aksi && <div className="flex flex-wrap items-center gap-2">{aksi}</div>}
    </div>
  );
}
