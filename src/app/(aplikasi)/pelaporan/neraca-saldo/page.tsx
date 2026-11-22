import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import { profilUsaha } from "@/lib/data/umum";
import { dataNeracaLajur, dataNeracaSaldo } from "@/lib/data/pelaporan/jurnal";
import { periodeLaporanBawaan, semuaPeriode } from "@/lib/data/pelaporan/periode";
import { tahapDari } from "@/lib/inti/buku-besar";
import { labelPeriode } from "@/lib/inti/tanggal";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import Lencana from "@/komponen/ui/Lencana";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import FilterUrl from "@/komponen/pelaporan/FilterUrl";
import { KepalaCetak, TombolCetak } from "@/komponen/pelaporan/Cetak";
import PilihTahap, { judulTahap } from "@/komponen/pelaporan/PilihTahap";
import { angka, rupiah } from "@/lib/format";

type Cari = { periode?: string; tahap?: string };
type DK = { debit: number; kredit: number };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Cari> }): Promise<Metadata> {
  return { title: judulTahap("Neraca Saldo", tahapDari((await searchParams).tahap)) };
}

const Angka = ({ nilai }: { nilai: number }) => (nilai ? <Rupiah nilai={nilai} polos /> : null);

/** Lencana total: seimbang atau selisih. */
const LencanaSeimbang = ({ t }: { t: DK }) =>
  t.debit === t.kredit ? <Lencana warna="hijau">seimbang</Lencana> : <Lencana warna="merah">selisih {rupiah(Math.abs(t.debit - t.kredit))}</Lencana>;

/** Isi satu pasang kolom di kartu HP: nilai dengan sisi D/K, atau 0 bila kosong. */
function NilaiDK({ x }: { x: DK }) {
  if (!x.debit && !x.kredit) return <span className="text-slate-400">0</span>;
  return (
    <span className="angka block">
      {x.debit > 0 && <span className="block whitespace-nowrap">{angka(x.debit)} D</span>}
      {x.kredit > 0 && <span className="block whitespace-nowrap">{angka(x.kredit)} K</span>}
    </span>
  );
}

export default async function Halaman({ searchParams }: { searchParams: Promise<Cari> }) {
  await wajibMasuk();
  const cari = await searchParams;
  const tahap = tahapDari(cari.tahap);
  const judul = judulTahap("Neraca Saldo", tahap);
  const [semua, bawaan, usaha] = await Promise.all([semuaPeriode(), periodeLaporanBawaan(), profilUsaha()]);
  const periode = cari.periode && semua.includes(cari.periode) ? cari.periode : bawaan;
  const [n, lajur] = await Promise.all([tahap === "sebelum" ? dataNeracaSaldo(periode, "sebelum") : null, tahap === "setelah" ? dataNeracaLajur(periode) : null]);
  const seimbang = n ? n.seimbang : lajur!.seimbang;

  return (
    <>
      <KepalaHalaman
        judul={judul}
        keterangan={
          tahap === "sebelum"
            ? "Saldo semua akun sampai akhir periode dari jurnal umum dan pembalik yang disetujui, sebelum jurnal penyesuaian periode ini. Total debit harus sama dengan total kredit."
            : "Neraca lajur ringkas: neraca saldo sebelum penyesuaian, jurnal penyesuaian periode ini, dan saldo setelah penyesuaian. Ketiga pasang kolom harus seimbang."
        }
        aksi={<TombolCetak />}
      />
      <div className="tanpa-cetak flex flex-wrap gap-3">
        <FilterUrl nama="periode" label="Sampai periode" nilai={periode} opsi={[...semua].reverse().map((p) => ({ nilai: p, label: labelPeriode(p) }))} />
        <PilihTahap alamat="/pelaporan/neraca-saldo" tahap={tahap} param={{ periode }} />
      </div>
      <KepalaCetak usaha={usaha.nama} judul={judul} keterangan={`Sampai akhir ${labelPeriode(periode)}`} />
      {!seimbang && <Peringatan jenis="galat">Neraca saldo tidak seimbang{n ? `, selisih ${rupiah(Math.abs(n.debit - n.kredit))}` : ""}. Periksa jurnal yang bermasalah sebelum menutup periode.</Peringatan>}

      {n && (
        <Kartu rapat>
          {n.baris.length === 0 ? (
            <KeadaanKosong judul="Belum ada saldo" keterangan="Belum ada jurnal disetujui sampai periode ini." />
          ) : (
            <Tabel label="Neraca saldo">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Akun</th>
                  <th className="kolom-angka">Debit (Rp)</th>
                  <th className="kolom-angka">Kredit (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {n.baris.map((b) => (
                  <tr key={b.kode}>
                    <td className="kode">{b.kode}</td>
                    <td>{b.nama}</td>
                    <td className="kolom-angka"><Angka nilai={b.debit} /></td>
                    <td className="kolom-angka"><Angka nilai={b.kredit} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    Total <span className="ml-1"><LencanaSeimbang t={n} /></span>
                  </td>
                  <td className="kolom-angka"><Rupiah nilai={n.debit} polos /></td>
                  <td className="kolom-angka"><Rupiah nilai={n.kredit} polos /></td>
                </tr>
              </tfoot>
            </Tabel>
          )}
        </Kartu>
      )}

      {lajur && (
        <Kartu rapat>
          {lajur.baris.length === 0 ? (
            <KeadaanKosong judul="Belum ada saldo" keterangan="Belum ada jurnal disetujui sampai periode ini." />
          ) : (
            <>
              {/* Layar lebar dan kertas: tabel neraca lajur penuh. */}
              <div className="hidden md:block print:block!">
                <Tabel label="Neraca lajur" className="tabel-lajur">
                  <thead>
                    <tr>
                      <th rowSpan={2}>Kode</th>
                      <th rowSpan={2}>Akun</th>
                      <th colSpan={2} className="text-center! border-l border-slate-200">Neraca saldo</th>
                      <th colSpan={2} className="text-center! border-l border-slate-200">Penyesuaian</th>
                      <th colSpan={2} className="text-center! border-l border-slate-200">Setelah penyesuaian</th>
                    </tr>
                    <tr>
                      {["Neraca saldo", "Penyesuaian", "Setelah penyesuaian"].flatMap((k) => [
                        <th key={`${k}-d`} className="kolom-angka border-l border-slate-200">Debit (Rp)</th>,
                        <th key={`${k}-k`} className="kolom-angka">Kredit (Rp)</th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {lajur.baris.map((b) => (
                      <tr key={b.kode} className={b.penyesuaian.debit || b.penyesuaian.kredit ? "bg-amber-50/60" : undefined}>
                        <td className="kode">{b.kode}</td>
                        <td>{b.nama}</td>
                        {[b.neracaSaldo, b.penyesuaian, b.setelah].flatMap((x, i) => [
                          <td key={`${i}-d`} className="kolom-angka border-l border-slate-100"><Angka nilai={x.debit} /></td>,
                          <td key={`${i}-k`} className="kolom-angka"><Angka nilai={x.kredit} /></td>,
                        ])}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>
                        Total{" "}
                        <span className="ml-1">
                          {lajur.seimbang ? <Lencana warna="hijau">seimbang</Lencana> : <Lencana warna="merah">tidak seimbang</Lencana>}
                        </span>
                      </td>
                      {[lajur.total.neracaSaldo, lajur.total.penyesuaian, lajur.total.setelah].flatMap((t, i) => [
                        <td key={`${i}-d`} className="kolom-angka border-l border-slate-200"><Rupiah nilai={t.debit} polos /></td>,
                        <td key={`${i}-k`} className="kolom-angka"><Rupiah nilai={t.kredit} polos /></td>,
                      ])}
                    </tr>
                  </tfoot>
                </Tabel>
              </div>

              {/* Layar sempit: kartu ringkas per akun supaya halaman tidak digeser ke samping. */}
              <ul className="divide-y divide-slate-100 md:hidden print:hidden!" aria-label="Neraca lajur (ringkas)">
                {lajur.baris.map((b) => (
                  <li key={b.kode} className={`space-y-2 px-4 py-3 ${b.penyesuaian.debit || b.penyesuaian.kredit ? "bg-amber-50/60" : ""}`}>
                    <div className="min-w-0 font-medium break-words text-slate-900">
                      <span className="kode mr-1.5">{b.kode}</span>
                      {b.nama}
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-xs">
                      {([["Neraca saldo", b.neracaSaldo], ["Penyesuaian", b.penyesuaian], ["Setelah", b.setelah]] as const).map(([k, x]) => (
                        <div key={k} className="min-w-0">
                          <dt className="text-slate-500">{k}</dt>
                          <dd className="font-medium text-slate-800"><NilaiDK x={x} /></dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
                <li className="space-y-2 bg-slate-50 px-4 py-3">
                  <div className="font-semibold text-slate-900">Jumlah per kolom (debit = kredit)</div>
                  <dl className="space-y-1.5 text-xs">
                    {([["Neraca saldo", lajur.total.neracaSaldo], ["Penyesuaian", lajur.total.penyesuaian], ["Setelah penyesuaian", lajur.total.setelah]] as const).map(([k, t]) => (
                      <div key={k} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <dt className="text-slate-600">{k}</dt>
                        <dd className="flex items-center gap-1.5 font-semibold text-slate-900">
                          <span className="angka">{angka(t.debit)}</span>
                          <LencanaSeimbang t={t} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              </ul>
            </>
          )}
        </Kartu>
      )}
    </>
  );
}
