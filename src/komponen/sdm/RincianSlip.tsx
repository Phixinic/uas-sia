/*
 * Rincian satu slip gaji dalam blok terpisah: gaji tetap (komponen dari Setting Gaji dikurangi potongan absen dari
 * presensi), upah event (karyawan inhouse yang ikut event, per event), potongan dan bonus manual (bila ada), lalu
 * ringkasan bruto, PPh 21, potongan, dan THP. Setiap komponen tetap menyebut versi nominal asalnya.
 * Tanpa hook dan tanpa akses database, jadi dipakai di halaman Gaji Bulanan dan di slip cetak.
 */
import type { DataSlip } from "@/lib/data/sdm/gaji";
import { labelPtkp, rupiah } from "@/lib/format";
import Rupiah from "@/komponen/ui/Rupiah";

function Blok({ judul, sub, label, children }: { judul: string; sub?: string; label: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200" aria-label={label}>
      <h3 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold text-slate-800">
        {judul} {sub && <span className="font-normal text-slate-500">({sub})</span>}
      </h3>
      {children}
    </section>
  );
}

export function RincianSlip({ s, bukaPph }: { s: DataSlip; bukaPph?: boolean }) {
  const tetap: [string, number, string][] = [["Gaji pokok", s.gajiPokok, s.sumberGajiPokok], ["Tunjangan jabatan", s.tunjJabatan, s.sumberJabatan]];
  if (s.tunjKeluarga) tetap.push(["Tunjangan istri/anak", s.tunjKeluarga, s.sumberJabatan]);
  for (const t of s.tunjLain) tetap.push([`Tunjangan ${t.nama.toLowerCase()}`, t.nominal, t.sumber]);
  const rumusPotongan = s.alpa ? `${rupiah(s.gajiPokok)} / ${s.hariKerja} hari kerja x ${s.alpa} hari alpa` : "tidak ada alpa";
  const tidakTeratur = s.totalUpahEvent + s.totalBonus;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Info judul="Rekening" nilai={`${s.bank} ${s.noRek}`} />
        <Info judul="Jabatan, golongan" nilai={`${s.jabatan}, ${s.golongan}`} />
        <Info judul="Status PTKP" nilai={labelPtkp(s.statusPtkp)} />
        <Info judul="Presensi" nilai={`${s.hadir} hadir, ${s.alpa} alpa dari ${s.hariKerja} hari kerja`} />
      </dl>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Blok judul="Gaji tetap" sub="Setting Gaji dan presensi" label="Gaji tetap">
          <table className="tabel" aria-label="Gaji tetap">
            <tbody>
              {tetap.map(([nama, nilai, sumber]) => (
                <tr key={nama}>
                  <td>
                    {nama}
                    <div className="text-[11px] text-slate-500">{sumber}</div>
                  </td>
                  <td className="kolom-angka"><Rupiah nilai={nilai} polos /></td>
                </tr>
              ))}
              <tr>
                <td>
                  Potongan absen
                  <div className="text-[11px] text-slate-500">{rumusPotongan}</div>
                </td>
                <td className="kolom-angka">{s.potonganAbsen ? <>−<Rupiah nilai={s.potonganAbsen} polos /></> : "0"}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Jumlah gaji tetap</td>
                <td className="kolom-angka"><Rupiah nilai={s.gajiTetap} polos /></td>
              </tr>
            </tfoot>
          </table>
          <p className="px-3 py-2 text-[11px] text-slate-500">Izin {s.izin}, sakit {s.sakit}, cuti {s.cuti}, terlambat {s.terlambatMenit} menit (terlambat tidak memotong gaji).</p>
        </Blok>

        <div className="space-y-4">
          {s.upahEvent.length > 0 && (
            <Blok judul="Upah event" sub="biaya variabel" label="Upah event">
              <table className="tabel" aria-label="Upah event">
                <tbody>
                  {s.upahEvent.map((u) => (
                    <tr key={u.slipFeeNo}>
                      <td>
                        Upah event <span className="kode">{u.eventKode}</span> {u.event}
                        <div className="text-[11px] text-slate-500">{u.jabatan}, {u.dasar}</div>
                      </td>
                      <td className="kolom-angka"><Rupiah nilai={u.fee} polos /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Jumlah upah event</td>
                    <td className="kolom-angka"><Rupiah nilai={s.totalUpahEvent} polos /></td>
                  </tr>
                </tfoot>
              </table>
            </Blok>
          )}
          {(s.bonus.length > 0 || s.potongan.length > 0) && (
            <Blok judul="Potongan dan bonus" sub="diisi HRD" label="Potongan dan bonus">
              <table className="tabel" aria-label="Potongan dan bonus">
                <tbody>
                  {s.bonus.map((b) => (
                    <tr key={`b${b.id}`}>
                      <td>Bonus: {b.keterangan}</td>
                      <td className="kolom-angka"><Rupiah nilai={b.nominal} polos /></td>
                    </tr>
                  ))}
                  {s.potongan.map((b) => (
                    <tr key={`p${b.id}`}>
                      <td>Potongan: {b.keterangan}</td>
                      <td className="kolom-angka">−<Rupiah nilai={b.nominal} polos /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Blok>
          )}
          <Blok judul="Yang diterima" label="Ringkasan gaji">
            <table className="tabel" aria-label="Ringkasan gaji">
              <tbody>
                <tr><td>Gaji tetap</td><td className="kolom-angka"><Rupiah nilai={s.gajiTetap} polos /></td></tr>
                {s.totalUpahEvent > 0 && <tr><td>Upah event</td><td className="kolom-angka"><Rupiah nilai={s.totalUpahEvent} polos /></td></tr>}
                {s.totalBonus > 0 && <tr><td>Bonus</td><td className="kolom-angka"><Rupiah nilai={s.totalBonus} polos /></td></tr>}
                <tr className="font-semibold"><td>Bruto</td><td className="kolom-angka"><Rupiah nilai={s.bruto} polos /></td></tr>
                <tr><td>PPh 21 (PTKP {labelPtkp(s.statusPtkp)})</td><td className="kolom-angka">{s.pph21 ? <>−<Rupiah nilai={s.pph21} polos /></> : "0"}</td></tr>
                {s.totalPotongan > 0 && <tr><td>Potongan</td><td className="kolom-angka">−<Rupiah nilai={s.totalPotongan} polos /></td></tr>}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total THP (ditransfer)</td>
                  <td className="kolom-angka"><Rupiah nilai={s.thp} polos /></td>
                </tr>
              </tfoot>
            </table>
          </Blok>
        </div>
      </div>

      <details open={bukaPph} className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">Perhitungan PPh 21 (disetahunkan)</summary>
        <pre className="angka mt-2 overflow-x-auto font-mono text-[12px] leading-6 text-slate-700">{`${tidakTeratur ? `Bruto setahun      = gaji tetap ${rupiah(s.gajiTetap)} x 12 + upah event dan bonus ${rupiah(tidakTeratur)} = ${rupiah(s.brutoSetahun)}` : `Bruto setahun      = ${rupiah(s.bruto)} x 12 = ${rupiah(s.brutoSetahun)}`}
Biaya jabatan 5%   = ${rupiah(s.biayaJabatan)} (maksimal Rp6.000.000)
Neto setahun       = ${rupiah(s.netoSetahun)}
PTKP ${labelPtkp(s.statusPtkp).padEnd(13)} = ${rupiah(s.ptkp)}
PKP (bulat ribuan) = ${rupiah(s.pkp)}
PPh 21 setahun     = ${rupiah(s.pphSetahun)}
PPh 21 bulan ini   = ${rupiah(s.pph21)}${tidakTeratur ? "\n(PPh gaji tetap per bulan + selisih PPh setahun karena upah event dan bonus)" : ""}`}</pre>
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
