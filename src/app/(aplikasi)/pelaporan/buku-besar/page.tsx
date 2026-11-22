import { Fragment } from "react";
import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { profilUsaha } from "@/lib/data/umum";
import { dataBukuBesar } from "@/lib/data/pelaporan/jurnal";
import { periodeLaporanBawaan, semuaPeriode } from "@/lib/data/pelaporan/periode";
import { AKUN } from "@/lib/inti/akun";
import { rupiah } from "@/lib/format";
import { hariTerakhir, labelPeriode, labelTanggal } from "@/lib/inti/tanggal";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel, { BarisKosong } from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import Lencana from "@/komponen/ui/Lencana";
import FilterUrl from "@/komponen/pelaporan/FilterUrl";
import { KepalaCetak, TombolCetak } from "@/komponen/pelaporan/Cetak";
import PilihTahap, { judulTahap } from "@/komponen/pelaporan/PilihTahap";
import { tahapDari } from "@/lib/inti/buku-besar";

type Cari = { akun?: string; periode?: string; tahap?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Cari> }): Promise<Metadata> {
  return { title: judulTahap("Buku Besar", tahapDari((await searchParams).tahap)) };
}

export default async function Halaman({ searchParams }: { searchParams: Promise<Cari> }) {
  await wajibMasuk();
  const cari = await searchParams;
  const tahap = tahapDari(cari.tahap);
  const judul = judulTahap("Buku Besar", tahap);
  const [semua, bawaan, daftarAkun, usaha] = await Promise.all([
    semuaPeriode(),
    periodeLaporanBawaan(),
    db.akun.findMany({ orderBy: { kode: "asc" }, select: { kode: true, nama: true } }),
    profilUsaha(),
  ]);
  const periode = cari.periode && semua.includes(cari.periode) ? cari.periode : bawaan;
  const kode = cari.akun && daftarAkun.some((a) => a.kode === cari.akun) ? cari.akun : AKUN.KAS;
  const bb = await dataBukuBesar(kode, periode, tahap);

  return (
    <>
      <KepalaHalaman
        judul={judul}
        keterangan={
          tahap === "sebelum"
            ? "Saldo berjalan per akun dari jurnal umum dan pembalik yang disetujui. Saldo awal sudah memuat jurnal penyesuaian periode lalu; jurnal penyesuaian periode ini belum dihitung."
            : "Saldo berjalan per akun sesudah jurnal penyesuaian periode ini disetujui. Baris berlabel Penyesuaian adalah tambahan dari Jurnal Penyesuaian."
        }
        aksi={<TombolCetak />}
      />
      <div className="tanpa-cetak flex flex-wrap gap-3">
        <FilterUrl nama="akun" label="Akun" nilai={kode} opsi={daftarAkun.map((a) => ({ nilai: a.kode, label: `${a.kode} · ${a.nama}` }))} />
        <FilterUrl nama="periode" label="Periode" nilai={periode} opsi={[...semua].reverse().map((p) => ({ nilai: p, label: labelPeriode(p) }))} />
        <PilihTahap alamat="/pelaporan/buku-besar" tahap={tahap} param={{ akun: kode, periode }} />
      </div>
      {bb && (
        <>
          <KepalaCetak usaha={usaha.nama} judul={`${judul}: ${bb.akun.kode} ${bb.akun.nama}`} keterangan={labelPeriode(periode)} />
          <Kartu rapat>
            <KepalaKartu judul={`${bb.akun.kode} · ${bb.akun.nama}`} keterangan={`Saldo normal ${bb.akun.saldoNormal === "D" ? "debit" : "kredit"} · ${labelPeriode(periode)}${bb.adaPenyesuaian ? ` · sebelum penyesuaian ${rupiah(bb.saldoSebelumPenyesuaian)}, penyesuaian ${rupiah(bb.mutasiPenyesuaian)}` : ""}`} />
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
                  <Fragment key={`${b.no}-${i}`}>
                    {/* Batas tahap: baris pertama jurnal penyesuaian didahului saldo sebelum penyesuaian. */}
                    {b.jenis === "PENYESUAIAN" && bb.baris[i - 1]?.jenis !== "PENYESUAIAN" && (
                      <tr className="bg-slate-50 font-semibold">
                        <td className="whitespace-nowrap">{labelTanggal(hariTerakhir(periode))}</td>
                        <td>Saldo sebelum penyesuaian</td>
                        <td />
                        <td />
                        <td />
                        <td className="kolom-angka"><Rupiah nilai={bb.saldoSebelumPenyesuaian} polos /></td>
                      </tr>
                    )}
                    <tr className={b.jenis === "PENYESUAIAN" ? "bg-amber-50/60" : undefined}>
                      <td className="whitespace-nowrap">{labelTanggal(b.tanggal)}</td>
                      <td>
                        {b.keterangan}
                        {b.jenis === "PENYESUAIAN" && <div className="mt-0.5"><Lencana warna="kuning">Penyesuaian</Lencana></div>}
                        {b.jenis === "PEMBALIK" && <div className="mt-0.5"><Lencana warna="merah">pembalik</Lencana></div>}
                      </td>
                      <td className="kode">{b.no}</td>
                      <td className="kolom-angka">{b.debit ? <Rupiah nilai={b.debit} polos /> : ""}</td>
                      <td className="kolom-angka">{b.kredit ? <Rupiah nilai={b.kredit} polos /> : ""}</td>
                      <td className="kolom-angka"><Rupiah nilai={b.saldo} polos /></td>
                    </tr>
                  </Fragment>
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
