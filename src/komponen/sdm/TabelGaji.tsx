"use client";

/*
 * Tabel proses hitung gaji. Ringkasan per karyawan tampil dulu; tombol Rincian membuka komponen gaji dan PPh 21
 * tanpa pindah halaman. Tombol hitung dan hapus hanya muncul untuk HRD (server action tetap memeriksa peran).
 */
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Calculator, Eye, Trash2 } from "lucide-react";
import { hapusSlip, hitungSlipSatu } from "@/lib/aksi/sdm/gaji";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { TautanTombol } from "@/komponen/ui/Tombol";
import Tombol from "@/komponen/ui/Tombol";
import Lencana, { LencanaStatus } from "@/komponen/ui/Lencana";
import Rupiah from "@/komponen/ui/Rupiah";
import Tabel from "@/komponen/ui/Tabel";
import { RincianSlip } from "./RincianSlip";
import type { BarisGaji } from "@/lib/data/sdm/gaji";

export default function TabelGaji({ baris, periode, bolehHitung, alamat }: { baris: BarisGaji[]; periode: string; bolehHitung: boolean; alamat: string }) {
  const [terbuka, setTerbuka] = useState<Set<string>>(new Set());
  const balik = (k: string) =>
    setTerbuka((s) => {
      const b = new Set(s);
      if (!b.delete(k)) b.add(k);
      return b;
    });
  const jumlah = (f: (b: BarisGaji) => number) => baris.reduce((s, b) => s + f(b), 0);

  const aksi = (b: BarisGaji, kelas: string) => {
    const buka = terbuka.has(b.karyawanKode);
    const bisaHitung = bolehHitung && b.jumlahPresensi > 0 && (!b.slipStatus || b.slipStatus === "DRAFT");
    return (
      <div className={`flex flex-wrap items-center gap-1.5 ${kelas}`}>
                <Tombol kecil varian="hantu" onClick={() => balik(b.karyawanKode)} aria-expanded={buka} ikon={buka ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}>
                  Rincian
                </Tombol>
                {bisaHitung && (
                  <TombolAksi aksi={() => hitungSlipSatu({ periode, karyawanKode: b.karyawanKode })} ikon={<Calculator className="size-4" />}>
                    {b.slipNo ? "Hitung ulang" : "Simpan slip"}
                  </TombolAksi>
                )}
                {b.slipNo && (
                  <TautanTombol href={`${alamat}?periode=${periode}&slip=${b.slipNo}`} kecil ikon={<Eye className="size-4" />}>
                    Slip
                  </TautanTombol>
                )}
                {bolehHitung && b.slipNo && b.slipStatus === "DRAFT" && (
                  <TombolAksi aksi={() => hapusSlip({ no: b.slipNo })} varian="bahaya" ikon={<Trash2 className="size-4" />} konfirmasi={{ judul: `Hapus slip ${b.nama}?`, pesan: "Slip draf dihapus. Kamu bisa menghitungnya lagi kapan saja." }}>
                    Hapus
                  </TombolAksi>
                )}
      </div>
    );
  };

  return (
    <>
    <div className="divide-y divide-slate-100 md:hidden" aria-label="Hitung gaji per karyawan (ringkas)">
      {baris.map((b) => {
        const s = b.tampil;
        const buka = terbuka.has(b.karyawanKode);
        return (
          <article key={b.karyawanKode} className="space-y-2 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-slate-900">{b.nama}</div>
                <div className="text-[11px] text-slate-500">
                  {b.jabatan} · hadir {s.hadir}/{s.hariKerja}
                  {s.alpa > 0 && `, ${s.alpa} alpa`}
                </div>
              </div>
              <div className="shrink-0 text-right">
                {b.slipStatus ? <LencanaStatus jenis="slip" status={b.slipStatus} /> : b.jumlahPresensi ? <Lencana warna="abu">Belum disimpan</Lencana> : <Lencana warna="kuning">Belum ada presensi</Lencana>}
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <div><dt className="text-slate-500">Bruto</dt><dd className="kolom-angka font-medium"><Rupiah nilai={s.bruto} polos /></dd></div>
              <div><dt className="text-slate-500">PPh 21</dt><dd className="kolom-angka font-medium"><Rupiah nilai={s.pph21} polos /></dd></div>
              <div><dt className="text-slate-500">THP</dt><dd className="kolom-angka font-semibold text-slate-900"><Rupiah nilai={s.thp} polos /></dd></div>
            </dl>
            {b.perluHitungUlang && <div className="text-[11px] text-amber-700">Data berubah, hitung ulang</div>}
            {b.slipStatus === "DRAFT" && b.alasanTolak && <div className="text-[11px] text-rose-700">Ditolak: {b.alasanTolak}</div>}
            {aksi(b, "")}
            {buka && <div className="rounded-lg bg-slate-50 p-3"><RincianSlip s={s} /></div>}
          </article>
        );
      })}
      <div className="flex items-center justify-between bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
        <span>Total THP ({baris.length} karyawan)</span>
        <span className="tabular-nums"><Rupiah nilai={jumlah((b) => b.tampil.thp)} polos /></span>
      </div>
    </div>
    <div className="hidden md:block">
    <Tabel label="Hitung gaji per karyawan">
      <thead>
        <tr>
          <th>Karyawan</th>
          <th className="kolom-angka">Hadir</th>
          <th className="kolom-angka">Gaji pokok</th>
          <th className="kolom-angka">Tunjangan</th>
          <th className="kolom-angka">Pot. absen</th>
          <th className="kolom-angka">Bruto</th>
          <th className="kolom-angka">PPh 21</th>
          <th className="kolom-angka">THP</th>
          <th>Status</th>
          <th className="text-right">Aksi</th>
        </tr>
      </thead>
      <tbody>
        {baris.map((b) => {
          const s = b.tampil;
          const buka = terbuka.has(b.karyawanKode);
          return (
            <Fragment key={b.karyawanKode}>
              <tr>
                <td>
                  <div className="font-medium text-slate-900">{b.nama}</div>
                  <div className="text-[11px] text-slate-500">{b.jabatan}</div>
                </td>
                <td className="kolom-angka">
                  {s.hadir}/{s.hariKerja}
                  {s.alpa > 0 && <span className="ml-1"><Lencana warna="merah">{s.alpa} alpa</Lencana></span>}
                </td>
                <td className="kolom-angka"><Rupiah nilai={s.gajiPokok} polos /></td>
                <td className="kolom-angka"><Rupiah nilai={s.tunjJabatan + s.tunjKeluarga + s.tunjLain.reduce((x, t) => x + t.nominal, 0)} polos /></td>
                <td className="kolom-angka">{s.potonganAbsen ? <>−<Rupiah nilai={s.potonganAbsen} polos /></> : "-"}</td>
                <td className="kolom-angka"><Rupiah nilai={s.bruto} polos /></td>
                <td className="kolom-angka"><Rupiah nilai={s.pph21} polos /></td>
                <td className="kolom-angka font-semibold text-slate-900"><Rupiah nilai={s.thp} polos /></td>
                <td>
                  {b.slipStatus ? <LencanaStatus jenis="slip" status={b.slipStatus} /> : b.jumlahPresensi ? <Lencana warna="abu">Belum disimpan</Lencana> : <Lencana warna="kuning">Belum ada presensi</Lencana>}
                  {b.perluHitungUlang && <div className="mt-0.5 text-[11px] text-amber-700">Data berubah, hitung ulang</div>}
                  {b.slipStatus === "DRAFT" && b.alasanTolak && <div className="mt-0.5 max-w-44 text-[11px] text-rose-700">Ditolak: {b.alasanTolak}</div>}
                </td>
                <td>
                  {aksi(b, "justify-end")}
                </td>
              </tr>
              {buka && (
                <tr className="bg-slate-50/60">
                  <td colSpan={10} className="py-4!">
                    <RincianSlip s={s} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={5}>Total ({baris.length} karyawan)</td>
          <td className="kolom-angka"><Rupiah nilai={jumlah((b) => b.tampil.bruto)} polos /></td>
          <td className="kolom-angka"><Rupiah nilai={jumlah((b) => b.tampil.pph21)} polos /></td>
          <td className="kolom-angka"><Rupiah nilai={jumlah((b) => b.tampil.thp)} polos /></td>
          <td colSpan={2} />
        </tr>
      </tfoot>
    </Tabel>
    </div>
    </>
  );
}
