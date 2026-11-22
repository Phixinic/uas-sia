/*
 * Slip fee event siap lihat dan cetak (gaya cetak sama dengan slip gaji: .slip-cetak, .tanpa-cetak).
 * Status slip selalu "Dibayar" karena slip baru dibuat saat Owner menyetujui laporan.
 */
import { X } from "lucide-react";
import { labelTanggal } from "@/lib/inti/tanggal";
import { labelDurasi } from "@/lib/inti/fee-event";
import { LABEL_PERAN_EVENT, LABEL_SATUAN_TARIF, labelWaktu, rupiah } from "@/lib/format";
import Lencana from "@/komponen/ui/Lencana";
import Rupiah from "@/komponen/ui/Rupiah";
import { TautanTombol } from "@/komponen/ui/Tombol";
import TombolCetak from "@/komponen/sdm/TombolCetak";
import type { DataSlipFee } from "@/lib/data/fee-event/daftar";

export default function SlipFee({ daftar, namaUsaha, alamatTutup }: { daftar: DataSlipFee[]; namaUsaha: string; alamatTutup: string }) {
  return (
    <div className="space-y-4">
      <div className="tanpa-cetak flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">{daftar.length > 1 ? `${daftar.length} slip fee siap dicetak.` : "Slip fee siap dicetak."}</p>
        <div className="flex gap-2">
          <TombolCetak label={daftar.length > 1 ? "Cetak semua" : "Cetak slip"} />
          <TautanTombol href={alamatTutup} kecil ikon={<X className="size-4" />}>Tutup</TautanTombol>
        </div>
      </div>
      {daftar.map((s) => {
        const dasar = s.satuanTarif === "HARI" ? `${s.jumlahHari} hari x ${rupiah(s.tarif)}` : `${labelDurasi(s.menitDiakui)} x ${rupiah(s.tarif)} per jam`;
        return (
          <article key={s.no} className="kartu slip-cetak space-y-4" aria-label={`Slip fee ${s.karyawan}`}>
            <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{namaUsaha}</p>
                <h2 className="text-lg font-bold text-slate-900">Slip fee event</h2>
                <p className="text-sm text-slate-600">{s.event}{s.klien ? ` · ${s.klien}` : ""} · {labelTanggal(s.tanggalMulai)}{s.tanggalSelesai !== s.tanggalMulai ? ` sampai ${labelTanggal(s.tanggalSelesai)}` : ""}</p>
              </div>
              <div className="text-right text-sm">
                <div className="kode">{s.no}</div>
                <Lencana warna="hijau">Dibayar</Lencana>
              </div>
            </header>
            <div className="text-sm">
              <div className="text-base font-semibold text-slate-900">{s.karyawan}</div>
              <div className="text-slate-600">{s.karyawanKode} · {s.jabatan} ({LABEL_PERAN_EVENT[s.peranEvent]}) · {s.bank} {s.noRek}</div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Info judul="Sesi dihadiri" nilai={String(s.jumlahSesi)} />
              <Info judul="Jam tercatat (di jadwal)" nilai={labelDurasi(s.menitTercatat)} />
              <Info judul={s.satuanTarif === "HARI" ? "Hari dihitung" : "Jam diakui"} nilai={s.satuanTarif === "HARI" ? `${s.jumlahHari} hari` : labelDurasi(s.menitDiakui)} />
              <Info judul="Tarif" nilai={`${rupiah(s.tarif)} ${LABEL_SATUAN_TARIF[s.satuanTarif]}`} />
            </dl>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="tabel" aria-label="Rincian slip fee">
                <thead><tr><th>Rincian</th><th className="kolom-angka">Jumlah (Rp)</th></tr></thead>
                <tbody>
                  <tr><td>Usulan sistem ({dasar})</td><td className="kolom-angka"><Rupiah nilai={s.feeUsulan} polos /></td></tr>
                  {s.alasanUbah && <tr><td>Disesuaikan Owner: {s.alasanUbah}</td><td className="kolom-angka"><Rupiah nilai={s.feeAkhir - s.feeUsulan} polos /></td></tr>}
                  <tr className="font-semibold"><td>Fee bruto</td><td className="kolom-angka"><Rupiah nilai={s.feeAkhir} polos /></td></tr>
                  <tr><td>PPh 21 bukan pegawai (50% x {rupiah(s.feeAkhir)} = DPP {rupiah(s.dpp)}, x 5%)</td><td className="kolom-angka"><Rupiah nilai={-s.pph21} polos /></td></tr>
                </tbody>
                <tfoot><tr><td>Dibayar</td><td className="kolom-angka"><Rupiah nilai={s.dibayar} polos /></td></tr></tfoot>
              </table>
            </div>
            <p className="text-xs text-slate-500">Laporan {s.laporanNo}{s.jurnalNo ? `, jurnal ${s.jurnalNo}` : ""}, dibayar {labelWaktu(s.dibayarPada)}.</p>
          </article>
        );
      })}
    </div>
  );
}

function Info({ judul, nilai }: { judul: string; nilai: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{judul}</dt>
      <dd className="font-semibold text-slate-900">{nilai}</dd>
    </div>
  );
}
