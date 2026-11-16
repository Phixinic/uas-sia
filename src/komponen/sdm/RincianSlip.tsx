/*
 * Rincian satu slip gaji: kehadiran, pendapatan, potongan, THP, dan perhitungan PPh 21.
 * Tanpa hook dan tanpa akses database, jadi dipakai di tabel (baris yang dibuka) dan di slip cetak.
 */
import type { DataSlip } from "@/lib/data/sdm/gaji";
import { labelPtkp, rupiah } from "@/lib/format";
import Rupiah from "@/komponen/ui/Rupiah";

export function RincianSlip({ s, bukaPph }: { s: DataSlip; bukaPph?: boolean }) {
  const pendapatan: [string, number][] = [["Gaji pokok", s.gajiPokok], ["Tunjangan jabatan", s.tunjJabatan]];
  if (s.tunjKeluarga) pendapatan.push(["Tunjangan istri/anak", s.tunjKeluarga]);
  for (const t of s.tunjLain) pendapatan.push([`Tunjangan ${t.nama.toLowerCase()}`, t.nominal]);
  const potongan: [string, number][] = [];
  if (s.potonganAbsen) potongan.push([`Potongan absen (${s.alpa} hari alpa)`, s.potonganAbsen]);
  potongan.push([`PPh 21 (PTKP ${labelPtkp(s.statusPtkp)})`, s.pph21]);

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Info judul="Rekening" nilai={`${s.bank} ${s.noRek}`} />
        <Info judul="Kehadiran" nilai={`${s.hadir} dari ${s.hariKerja} hari`} />
        <Info judul="Izin / sakit / cuti / alpa" nilai={`${s.izin} / ${s.sakit} / ${s.cuti} / ${s.alpa}`} />
        <Info judul="Jam kerja, terlambat" nilai={`${s.jamKerja.toFixed(2)} jam, ${s.terlambatMenit} mnt`} />
      </dl>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="tabel" aria-label="Rincian slip gaji">
          <thead>
            <tr>
              <th>Pendapatan</th>
              <th className="kolom-angka">Jumlah (Rp)</th>
            </tr>
          </thead>
          <tbody>
            {pendapatan.map(([nama, nilai]) => (
              <tr key={nama}>
                <td>{nama}</td>
                <td className="kolom-angka"><Rupiah nilai={nilai} polos /></td>
              </tr>
            ))}
          </tbody>
          <thead>
            <tr>
              <th>Potongan</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {potongan.map(([nama, nilai]) => (
              <tr key={nama}>
                <td>{nama}</td>
                <td className="kolom-angka">−<Rupiah nilai={nilai} polos /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total THP (ditransfer)</td>
              <td className="kolom-angka"><Rupiah nilai={s.thp} polos /></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <details open={bukaPph} className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">Perhitungan PPh 21 (disetahunkan)</summary>
        <pre className="angka mt-2 overflow-x-auto font-mono text-[12px] leading-6 text-slate-700">{`Bruto setahun      = ${rupiah(s.bruto)} x 12 = ${rupiah(s.brutoSetahun)}
Biaya jabatan 5%   = ${rupiah(s.biayaJabatan)} (maksimal Rp6.000.000)
Neto setahun       = ${rupiah(s.netoSetahun)}
PTKP ${labelPtkp(s.statusPtkp).padEnd(13)} = ${rupiah(s.ptkp)}
PKP (bulat ribuan) = ${rupiah(s.pkp)}
PPh 21 setahun     = ${rupiah(s.pphSetahun)}, per bulan ${rupiah(s.pph21)}`}</pre>
      </details>
    </div>
  );
}

function Info({ judul, nilai }: { judul: string; nilai: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{judul}</dt>
      <dd className="font-medium text-slate-900">{nilai}</dd>
    </div>
  );
}
