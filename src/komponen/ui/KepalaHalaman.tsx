import type { ReactNode } from "react";

/** Judul halaman, keterangan singkat, dan tombol aksi di kanan. */
export default function KepalaHalaman({ judul, keterangan, lencana, aksi }: { judul: string; keterangan?: ReactNode; lencana?: ReactNode; aksi?: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="judul-halaman">{judul}</h1>
          {lencana}
        </div>
        {keterangan && <p className="subjudul-halaman">{keterangan}</p>}
      </div>
      {aksi && <div className="flex flex-wrap items-end gap-2">{aksi}</div>}
    </div>
  );
}
