/*
 * Rincian satu slip gaji dalam dua blok: komponen tetap dari Setting Gaji (biaya tetap) dan penyesuaian bulan ini dari
 * presensi (potongan absen, bruto, PPh 21, THP), ditambah perhitungan PPh 21.
 * Tanpa hook dan tanpa akses database, jadi dipakai di tabel (baris yang dibuka) dan di slip cetak.
 */
import type { DataSlip } from "@/lib/data/sdm/gaji";
import { labelPtkp, rupiah } from "@/lib/format";
import Rupiah from "@/komponen/ui/Rupiah";

export function RincianSlip({ s, bukaPph }: { s: DataSlip; bukaPph?: boolean }) {
  const tetap: [string, number][] = [["Gaji pokok", s.gajiPokok], ["Tunjangan jabatan", s.tunjJabatan]];
  if (s.tunjKeluarga) tetap.push(["Tunjangan istri/anak", s.tunjKeluarga]);
  for (const t of s.tunjLain) tetap.push([`Tunjangan ${t.nama.toLowerCase()}`, t.nominal]);
  const jumlahTetap = tetap.reduce((x, [, n]) => x + n, 0);
  const rumusPotongan = s.alpa ? `${rupiah(s.gajiPokok)} / ${s.hariKerja} hari kerja x ${s.alpa} hari alpa` : "tidak ada alpa";

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Info judul="Rekening" nilai={`${s.bank} ${s.noRek}`} />
        <Info judul="Jabatan, golongan" nilai={`${s.jabatan}, ${s.golongan}`} />
        <Info judul="Status PTKP" nilai={labelPtkp(s.statusPtkp)} />
        <Info judul="Hari kerja periode" nilai={`${s.hariKerja} hari`} />
      </dl>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-slate-200" aria-label="Komponen tetap">
          <h3 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold text-slate-800">
            Komponen tetap <span className="font-normal text-slate-500">(dari Setting Gaji)</span>
          </h3>
          <table className="tabel" aria-label="Komponen tetap (dari Setting Gaji)">
            <tbody>
              {tetap.map(([nama, nilai]) => (
                <tr key={nama}>
                  <td>{nama}</td>
                  <td className="kolom-angka"><Rupiah nilai={nilai} polos /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Jumlah komponen tetap</td>
                <td className="kolom-angka"><Rupiah nilai={jumlahTetap} polos /></td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200" aria-label="Penyesuaian bulan ini">
          <h3 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold text-slate-800">
            Penyesuaian bulan ini <span className="font-normal text-slate-500">(dari presensi)</span>
          </h3>
          <dl className="grid grid-cols-3 gap-2 border-b border-slate-100 px-3 py-2.5 text-xs sm:grid-cols-6">
            <Info judul="Hadir" nilai={`${s.hadir}`} />
            <Info judul="Izin" nilai={`${s.izin}`} />
            <Info judul="Sakit" nilai={`${s.sakit}`} />
            <Info judul="Cuti" nilai={`${s.cuti}`} />
            <Info judul="Alpa" nilai={`${s.alpa}`} />
            <Info judul="Terlambat" nilai={`${s.terlambatMenit} mnt`} />
          </dl>
          <table className="tabel" aria-label="Penyesuaian bulan ini (dari presensi)">
            <tbody>
              <tr>
                <td>Jumlah komponen tetap</td>
                <td className="kolom-angka"><Rupiah nilai={jumlahTetap} polos /></td>
              </tr>
              <tr>
                <td>
                  Potongan absen
                  <div className="text-[11px] text-slate-500">{rumusPotongan}</div>
                </td>
                <td className="kolom-angka">{s.potonganAbsen ? <>−<Rupiah nilai={s.potonganAbsen} polos /></> : "0"}</td>
              </tr>
              <tr className="font-semibold">
                <td>Bruto</td>
                <td className="kolom-angka"><Rupiah nilai={s.bruto} polos /></td>
              </tr>
              <tr>
                <td>PPh 21 (PTKP {labelPtkp(s.statusPtkp)})</td>
                <td className="kolom-angka">−<Rupiah nilai={s.pph21} polos /></td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Total THP (ditransfer)</td>
                <td className="kolom-angka"><Rupiah nilai={s.thp} polos /></td>
              </tr>
            </tfoot>
          </table>
          <p className="px-3 py-2 text-[11px] text-slate-500">Jam kerja tercatat {s.jamKerja.toFixed(2)} jam. Terlambat tidak memotong gaji.</p>
        </section>
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
