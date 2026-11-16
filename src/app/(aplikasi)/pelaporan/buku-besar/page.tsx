import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { profilUsaha } from "@/lib/data/umum";
import { dataBukuBesar } from "@/lib/data/pelaporan/jurnal";
import { periodeLaporanBawaan, semuaPeriode } from "@/lib/data/pelaporan/periode";
import { AKUN } from "@/lib/inti/akun";
import { hariTerakhir, labelPeriode, labelTanggal } from "@/lib/inti/tanggal";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel, { BarisKosong } from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import FilterUrl from "@/komponen/pelaporan/FilterUrl";
import { GayaCetak, KepalaCetak, TombolCetak } from "@/komponen/pelaporan/Cetak";

export const metadata: Metadata = { title: "Buku Besar" };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ akun?: string; periode?: string }> }) {
  await wajibMasuk();
  const cari = await searchParams;
  const [semua, bawaan, daftarAkun, usaha] = await Promise.all([
    semuaPeriode(),
    periodeLaporanBawaan(),
    db.akun.findMany({ orderBy: { kode: "asc" }, select: { kode: true, nama: true } }),
    profilUsaha(),
  ]);
  const periode = cari.periode && semua.includes(cari.periode) ? cari.periode : bawaan;
  const kode = cari.akun && daftarAkun.some((a) => a.kode === cari.akun) ? cari.akun : AKUN.KAS;
  const bb = await dataBukuBesar(kode, periode);

  return (
    <>
      <GayaCetak />
      <KepalaHalaman
        judul="Buku Besar"
        keterangan="Saldo berjalan per akun, hanya dari jurnal yang sudah disetujui. Buku besar tidak disimpan sebagai tabel, tetapi dihitung dari baris jurnal."
        aksi={<TombolCetak />}
      />
      <div className="tanpa-cetak flex flex-wrap gap-3">
        <FilterUrl nama="akun" label="Akun" nilai={kode} opsi={daftarAkun.map((a) => ({ nilai: a.kode, label: `${a.kode} · ${a.nama}` }))} />
        <FilterUrl nama="periode" label="Periode" nilai={periode} opsi={[...semua].reverse().map((p) => ({ nilai: p, label: labelPeriode(p) }))} />
      </div>
      {bb && (
        <>
          <KepalaCetak usaha={usaha.nama} judul={`Buku Besar ${bb.akun.kode} ${bb.akun.nama}`} keterangan={labelPeriode(periode)} />
          <Kartu rapat>
            <KepalaKartu judul={`${bb.akun.kode} · ${bb.akun.nama}`} keterangan={`Saldo normal ${bb.akun.saldoNormal === "D" ? "debit" : "kredit"} · ${labelPeriode(periode)}`} />
            <Tabel label="Buku besar">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Keterangan</th>
                  <th>Ref.</th>
                  <th className="kolom-angka">Debit (Rp)</th>
                  <th className="kolom-angka">Kredit (Rp)</th>
                  <th className="kolom-angka">Saldo (Rp)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-50 font-semibold">
                  <td className="whitespace-nowrap">{labelTanggal(`${periode}-01`)}</td>
                  <td>Saldo awal</td>
                  <td />
                  <td />
                  <td />
                  <td className="kolom-angka"><Rupiah nilai={bb.saldoAwal} polos /></td>
                </tr>
                {bb.baris.length === 0 && <BarisKosong kolom={6}>Tidak ada mutasi pada periode ini.</BarisKosong>}
                {bb.baris.map((b, i) => (
                  <tr key={`${b.no}-${i}`}>
                    <td className="whitespace-nowrap">{labelTanggal(b.tanggal)}</td>
                    <td>{b.keterangan}</td>
                    <td className="kode">{b.no}</td>
                    <td className="kolom-angka">{b.debit ? <Rupiah nilai={b.debit} polos /> : ""}</td>
                    <td className="kolom-angka">{b.kredit ? <Rupiah nilai={b.kredit} polos /> : ""}</td>
                    <td className="kolom-angka"><Rupiah nilai={b.saldo} polos /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="whitespace-nowrap">{labelTanggal(hariTerakhir(periode))}</td>
                  <td>Saldo akhir</td>
                  <td />
                  <td className="kolom-angka"><Rupiah nilai={bb.baris.reduce((s, b) => s + b.debit, 0)} polos /></td>
                  <td className="kolom-angka"><Rupiah nilai={bb.baris.reduce((s, b) => s + b.kredit, 0)} polos /></td>
                  <td className="kolom-angka"><Rupiah nilai={bb.saldoAkhir} polos /></td>
                </tr>
              </tfoot>
            </Tabel>
          </Kartu>
        </>
      )}
    </>
  );
}
