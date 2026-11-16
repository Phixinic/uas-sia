import Link from "next/link";
import { X } from "lucide-react";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import Peringatan from "@/komponen/ui/Peringatan";
import { LencanaStatus } from "@/komponen/ui/Lencana";
import { TautanTombol } from "@/komponen/ui/Tombol";
import { angka, LABEL_DASAR_N } from "@/lib/format";
import { labelPeriode, labelTanggal } from "@/lib/inti/tanggal";
import type { ambilAset } from "@/lib/data/konversi/aset";
import type { StatusPersetujuan } from "@/generated/prisma/enums";

type Aset = NonNullable<Awaited<ReturnType<typeof ambilAset>>>;

/** Rincian satu kartu aset: angka pokok, rumus dengan angka asli, dan jadwal penyusutan lengkap. */
export default function DetailAset({ a, alamatTutup, bolehLepas }: { a: Aset; alamatTutup: string; bolehLepas: boolean }) {
  const v = a.nilaiPerolehan - a.residu;
  const ubin = (label: string, isi: React.ReactNode, sub?: React.ReactNode) => (
    <div>
      <div className="teks-label">{label}</div>
      <div className="mt-0.5 font-semibold text-slate-800">{isi}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
  const sudah = a.jadwal.filter((r) => r.jurnalNo).length;
  return (
    <Kartu rapat>
      <KepalaKartu
        judul={<span className="flex flex-wrap items-center gap-2"><span className="kode text-[15px]! text-slate-900!">{a.kode}</span>{a.nama}<LencanaStatus jenis="aset" status={a.status} /></span>}
        keterangan={<>Dari <Link className="kode hover:underline" href={`/konversi/pembelian-peralatan?lihat=${a.pembelianNo}`}>{a.pembelianNo}</Link>, diperoleh {labelTanggal(a.tglPerolehan)}{a.tanggalLepas ? `, dilepas ${labelTanggal(a.tanggalLepas)}` : ""}</>}
        aksi={
          <>
            {a.status === "AKTIF" && bolehLepas && <TautanTombol href={`/konversi/pelepasan?form=baru&aset=${a.kode}`} kecil>Ajukan pelepasan</TautanTombol>}
            <TautanTombol href={alamatTutup} kecil varian="hantu" ikon={<X className="size-4" />}>Tutup</TautanTombol>
          </>
        }
      />
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {ubin("Nilai perolehan (b)", <Rupiah nilai={a.nilaiPerolehan} />)}
          {ubin("Nilai residu (S)", <Rupiah nilai={a.residu} />)}
          {ubin("Garansi", `${a.garansiBulan} bln`, a.garansiSampai ? `sampai ${labelTanggal(a.garansiSampai)}` : undefined)}
          {ubin("Masa manfaat", `${a.masaManfaatBulan} bln`)}
          {ubin("Akumulasi disetujui", <Rupiah nilai={a.akumulasi} />)}
          {ubin("Nilai buku", <Rupiah nilai={a.nilaiBuku} />)}
        </div>

        {a.status === "BATAL" ? (
          <Peringatan jenis="awas">Aset ini batal karena pembeliannya dibalik.</Peringatan>
        ) : (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Rumus penyusutan (n dari {LABEL_DASAR_N[a.dasarN].toLowerCase()})</h3>
            <pre className="angka overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12.5px] leading-6 text-slate-700">
{`b − S = ${angka(a.nilaiPerolehan)} − ${angka(a.residu)} = ${angka(v)}
Rumus 1, periode 1 s.d. ${Math.max(a.n - 1, 0)}:  d = round((b − S) ÷ n) = round(${angka(v)} ÷ ${a.n}) = Rp${angka(a.d)}${a.pengaman ? "  (pengaman: dibulatkan ke bawah)" : ""}
Rumus 2, periode ${a.n}:  (b − S) − (n − 1) × d = ${angka(v)} − ${a.n - 1} × ${angka(a.d)} = Rp${angka(a.terakhir)}
Total = ${a.n - 1} × ${angka(a.d)} + ${angka(a.terakhir)} = ${angka((a.n - 1) * a.d + a.terakhir)}  →  nilai buku akhir Rp${angka(a.residu)}`}
            </pre>
          </div>
        )}

        {a.jadwal.length > 0 ? (
          <details open className="rounded-lg border border-slate-200">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">
              Jadwal penyusutan ({a.jadwal.length} periode, {sudah} sudah dijurnal)
            </summary>
            <div className="max-h-96 overflow-y-auto border-t border-slate-100">
              <Tabel label="Jadwal penyusutan">
                <thead>
                  <tr>
                    <th>Ke</th>
                    <th>Periode</th>
                    <th className="kolom-angka">Beban (Rp)</th>
                    <th className="kolom-angka">Akumulasi (Rp)</th>
                    <th className="kolom-angka">Nilai buku (Rp)</th>
                    <th>Jurnal</th>
                  </tr>
                </thead>
                <tbody>
                  {a.jadwal.map((r) => (
                    <tr key={r.periodeKe}>
                      <td>{r.periodeKe}</td>
                      <td>{labelPeriode(r.periode)}</td>
                      <td className="kolom-angka"><Rupiah nilai={r.beban} polos /></td>
                      <td className="kolom-angka"><Rupiah nilai={r.akumulasi} polos /></td>
                      <td className="kolom-angka"><Rupiah nilai={r.nilaiBuku} polos /></td>
                      <td>
                        {r.jurnalNo ? (
                          <span className="flex items-center gap-2"><span className="kode text-[11px]!">{r.jurnalNo}</span><LencanaStatus jenis="persetujuan" status={(r.statusJurnal ?? "DRAFT") as StatusPersetujuan} /></span>
                        ) : (
                          <span className="text-xs text-slate-400">belum</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabel>
            </div>
          </details>
        ) : a.status !== "BATAL" ? (
          <p className="teks-redup">Tidak ada baris jadwal tersisa.</p>
        ) : null}
      </div>
    </Kartu>
  );
}
