import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import { profilUsaha } from "@/lib/data/umum";
import { dataNeracaSaldo } from "@/lib/data/pelaporan/jurnal";
import { periodeLaporanBawaan, semuaPeriode } from "@/lib/data/pelaporan/periode";
import { labelPeriode } from "@/lib/inti/tanggal";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import Lencana from "@/komponen/ui/Lencana";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import FilterUrl from "@/komponen/pelaporan/FilterUrl";
import { GayaCetak, KepalaCetak, TombolCetak } from "@/komponen/pelaporan/Cetak";
import { rupiah } from "@/lib/format";

export const metadata: Metadata = { title: "Neraca Saldo" };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  await wajibMasuk();
  const cari = await searchParams;
  const [semua, bawaan, usaha] = await Promise.all([semuaPeriode(), periodeLaporanBawaan(), profilUsaha()]);
  const periode = cari.periode && semua.includes(cari.periode) ? cari.periode : bawaan;
  const n = await dataNeracaSaldo(periode);

  return (
    <>
      <GayaCetak />
      <KepalaHalaman
        judul="Neraca Saldo"
        keterangan="Saldo semua akun sampai akhir periode, dari jurnal yang disetujui. Total debit harus sama dengan total kredit."
        aksi={<TombolCetak />}
      />
      <div className="tanpa-cetak flex flex-wrap gap-3">
        <FilterUrl nama="periode" label="Sampai periode" nilai={periode} opsi={[...semua].reverse().map((p) => ({ nilai: p, label: labelPeriode(p) }))} />
      </div>
      <KepalaCetak usaha={usaha.nama} judul="Neraca Saldo" keterangan={`Sampai akhir ${labelPeriode(periode)}`} />
      {!n.seimbang && <Peringatan jenis="galat">Neraca saldo tidak seimbang, selisih {rupiah(Math.abs(n.debit - n.kredit))}. Periksa jurnal yang bermasalah sebelum menutup periode.</Peringatan>}
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
                  <td className="kolom-angka">{b.debit ? <Rupiah nilai={b.debit} polos /> : ""}</td>
                  <td className="kolom-angka">{b.kredit ? <Rupiah nilai={b.kredit} polos /> : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>
                  Total <span className="ml-1">{n.seimbang ? <Lencana warna="hijau">seimbang</Lencana> : <Lencana warna="merah">selisih {rupiah(Math.abs(n.debit - n.kredit))}</Lencana>}</span>
                </td>
                <td className="kolom-angka"><Rupiah nilai={n.debit} polos /></td>
                <td className="kolom-angka"><Rupiah nilai={n.kredit} polos /></td>
              </tr>
            </tfoot>
          </Tabel>
        )}
      </Kartu>
    </>
  );
}
