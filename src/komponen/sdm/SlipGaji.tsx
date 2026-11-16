/*
 * Slip gaji siap lihat dan cetak. Saat dicetak, sidebar, topbar, dan semua yang bertanda .tanpa-cetak disembunyikan,
 * dan tiap slip mulai di halaman baru.
 */
import { X } from "lucide-react";
import { labelPeriode } from "@/lib/inti/tanggal";
import { LABEL_STATUS_SLIP } from "@/lib/format";
import { LencanaStatus } from "@/komponen/ui/Lencana";
import { TautanTombol } from "@/komponen/ui/Tombol";
import { RincianSlip } from "./RincianSlip";
import TombolCetak from "./TombolCetak";
import type { DataSlip } from "@/lib/data/sdm/gaji";

export default function SlipGaji({ daftar, namaUsaha, alamatTutup }: { daftar: DataSlip[]; namaUsaha: string; alamatTutup: string }) {
  if (daftar.length === 0) return null;
  return (
    <div className="space-y-4">
      <div className="tanpa-cetak flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">{daftar.length > 1 ? `${daftar.length} slip ${labelPeriode(daftar[0].periode)} siap dicetak.` : "Pratinjau slip siap dicetak."}</p>
        <div className="flex gap-2">
          <TombolCetak label={daftar.length > 1 ? "Cetak semua" : "Cetak slip"} />
          <TautanTombol href={alamatTutup} kecil ikon={<X className="size-4" />}>
            Tutup
          </TautanTombol>
        </div>
      </div>
      {daftar.map((s) => (
        <article key={s.karyawanKode} className="kartu slip-cetak space-y-4" aria-label={`Slip gaji ${s.karyawan}`}>
          <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{namaUsaha}</p>
              <h2 className="text-lg font-bold text-slate-900">Slip gaji {labelPeriode(s.periode)}</h2>
            </div>
            <div className="text-right text-sm">
              <div className="kode">{s.no ?? "Belum disimpan"}</div>
              {s.status ? <LencanaStatus jenis="slip" status={s.status} /> : <span className="text-xs text-slate-500">Pratinjau</span>}
            </div>
          </header>
          <div className="text-sm">
            <div className="text-base font-semibold text-slate-900">{s.karyawan}</div>
            <div className="text-slate-600">
              {s.karyawanKode} · {s.jabatan} · {s.golongan}
              {s.penggajianNo ? ` · ${s.penggajianNo}` : ""}
            </div>
          </div>
          <RincianSlip s={s} bukaPph />
          {s.status && <p className="text-xs text-slate-500">Status slip: {LABEL_STATUS_SLIP[s.status]}.</p>}
        </article>
      ))}
    </div>
  );
}
