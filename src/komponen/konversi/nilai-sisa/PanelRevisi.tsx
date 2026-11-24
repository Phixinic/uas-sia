/*
 * Revisi nilai sisa sesudah disetujui (komponen server): kartu revisi yang menunggu Owner (nilai lama dan baru per
 * perlengkapan) dan riwayat versi (setiap revisi beserta alasan, keputusan, dan jurnal pembalik serta jurnal barunya).
 */
import { labelWaktu, rupiah } from "@/lib/format";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import { LencanaStatus } from "@/komponen/ui/Lencana";
import AksiRevisi from "./AksiRevisi";
import type { StatusPersetujuan } from "@/generated/prisma/enums";

export type DataRevisi = {
  no: string;
  ke: number;
  status: StatusPersetujuan;
  alasan: string;
  alasanTolak: string | null;
  totalBebanLama: number;
  totalBeban: number;
  jurnalLamaNo: string | null;
  jurnalPembalikNo: string | null;
  jurnalBaruNo: string | null;
  diajukanOleh: string;
  diajukanPada: string;
  diputuskanOleh: string | null;
  diputuskanPada: string | null;
  detail: { kode: string; nama: string; saldoBuku: number; nilaiSisaLama: number; nilaiSisa: number }[];
};

/** Revisi yang menunggu keputusan Owner. */
export function KartuRevisiMenunggu({ r, bolehPutuskan }: { r: DataRevisi; bolehPutuskan: boolean }) {
  return (
    <Kartu rapat label={`Revisi ${r.no}`}>
      <KepalaKartu
        judul={<span className="flex flex-wrap items-center gap-2">Revisi nilai sisa <span className="kode">{r.no}</span> <LencanaStatus jenis="revisi" status={r.status} /></span>}
        keterangan={`Diajukan ${r.diajukanOleh}, ${labelWaktu(r.diajukanPada)}. Alasan: ${r.alasan}`}
        aksi={bolehPutuskan ? <AksiRevisi no={r.no} totalLama={r.totalBebanLama} totalBaru={r.totalBeban} /> : <span className="text-xs text-slate-500">Menunggu keputusan Owner. Nilai yang berlaku belum berubah.</span>}
      />
      <Tabel label="Nilai sisa lama dan usulan revisi">
        <thead>
          <tr>
            <th>Perlengkapan</th>
            <th className="kolom-angka">Saldo buku (Rp)</th>
            <th className="kolom-angka">Nilai sisa berlaku (Rp)</th>
            <th className="kolom-angka">Usulan revisi (Rp)</th>
            <th className="kolom-angka">Biaya baru (Rp)</th>
          </tr>
        </thead>
        <tbody>
          {r.detail.map((x) => (
            <tr key={x.kode} className={x.nilaiSisa !== x.nilaiSisaLama ? "bg-amber-50/60" : undefined}>
              <td><span className="kode mr-2">{x.kode}</span>{x.nama}</td>
              <td className="kolom-angka"><Rupiah nilai={x.saldoBuku} polos /></td>
              <td className="kolom-angka"><Rupiah nilai={x.nilaiSisaLama} polos /></td>
              <td className="kolom-angka font-semibold"><Rupiah nilai={x.nilaiSisa} polos /></td>
              <td className="kolom-angka"><Rupiah nilai={x.saldoBuku - x.nilaiSisa} polos /></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>Biaya perlengkapan: {rupiah(r.totalBebanLama)} menjadi</td>
            <td className="kolom-angka"><Rupiah nilai={r.totalBeban} polos /></td>
          </tr>
        </tfoot>
      </Tabel>
    </Kartu>
  );
}

/** Riwayat versi nilai sisa satu periode: versi awal lalu setiap revisi. */
export function RiwayatVersi({ revisi, totalSekarang }: { revisi: DataRevisi[]; totalSekarang: number }) {
  const urut = [...revisi].sort((a, b) => a.ke - b.ke);
  const awal = urut[0]?.totalBebanLama ?? totalSekarang;
  return (
    <Kartu rapat label="Riwayat versi nilai sisa">
      <KepalaKartu judul="Riwayat versi nilai sisa" keterangan="Setiap revisi yang disetujui membalik jurnal lama dan membuat jurnal baru. Revisi yang dikembalikan tetap tercatat beserta alasannya." />
      <Tabel label="Riwayat versi nilai sisa">
        <thead>
          <tr>
            <th>Versi</th>
            <th className="kolom-angka">Biaya (Rp)</th>
            <th>Status</th>
            <th>Alasan</th>
            <th>Jurnal</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Input awal</td>
            <td className="kolom-angka"><Rupiah nilai={awal} polos /></td>
            <td><LencanaStatus jenis="revisi" status="DISETUJUI" /></td>
            <td className="text-xs text-slate-500">-</td>
            <td className="kode">{urut[0]?.jurnalLamaNo ?? "-"}</td>
          </tr>
          {urut.map((r) => (
            <tr key={r.no}>
              <td><span className="kode">{r.no}</span><div className="text-[11px] text-slate-500">Diajukan {r.diajukanOleh}, {labelWaktu(r.diajukanPada)}</div></td>
              <td className="kolom-angka"><Rupiah nilai={r.totalBeban} polos /><div className="text-[11px] text-slate-500">dari {rupiah(r.totalBebanLama)}</div></td>
              <td>
                <LencanaStatus jenis="revisi" status={r.status} />
                {r.diputuskanPada && <div className="mt-0.5 text-[11px] text-slate-500">{r.status === "DITOLAK" ? "Dikembalikan" : "Disetujui"} {r.diputuskanOleh}, {labelWaktu(r.diputuskanPada)}</div>}
              </td>
              <td className="max-w-72 text-xs">
                {r.alasan}
                {r.alasanTolak && <div className="mt-0.5 text-rose-600">Alasan dikembalikan: {r.alasanTolak}</div>}
              </td>
              <td className="text-xs">
                {r.jurnalPembalikNo && <div>Pembalik <span className="kode">{r.jurnalPembalikNo}</span></div>}
                {r.jurnalBaruNo && <div>Baru <span className="kode">{r.jurnalBaruNo}</span></div>}
                {r.status === "DISETUJUI" && !r.jurnalBaruNo && <div className="text-slate-500">Biaya 0, tanpa jurnal baru</div>}
                {r.status !== "DISETUJUI" && <span className="text-slate-400">-</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </Tabel>
    </Kartu>
  );
}
