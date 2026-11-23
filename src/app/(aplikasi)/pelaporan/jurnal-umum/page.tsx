import type { Metadata } from "next";
import { wajibMasuk } from "@/lib/server/auth";
import { petaAkun, profilUsaha } from "@/lib/data/umum";
import { daftarJurnalUmum } from "@/lib/data/pelaporan/jurnal";
import { semuaPeriode } from "@/lib/data/pelaporan/periode";
import { labelBulanTahun, labelTanggal, periodeDariCari } from "@/lib/inti/tanggal";
import PilihBulanTahun from "@/komponen/ui/PilihBulanTahun";
import LencanaPeriode from "@/komponen/ui/LencanaPeriode";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import Lencana from "@/komponen/ui/Lencana";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import FilterUrl from "@/komponen/pelaporan/FilterUrl";
import { KepalaCetak, TombolCetak } from "@/komponen/pelaporan/Cetak";

export const metadata: Metadata = { title: "Jurnal Umum" };

const OPSI_JENIS = [
  { nilai: "semua", label: "Umum dan pembalik" },
  { nilai: "UMUM", label: "Umum saja" },
  { nilai: "PEMBALIK", label: "Pembalik saja" },
];

export default async function Halaman({ searchParams }: { searchParams: Promise<{ periode?: string; bulan?: string; tahun?: string; jenis?: string }> }) {
  await wajibMasuk();
  const cari = await searchParams;
  const semua = await semuaPeriode();
  const dipilih = periodeDariCari(cari);
  const periode = dipilih && semua.includes(dipilih) ? dipilih : "semua";
  const jenis = cari.jenis === "UMUM" || cari.jenis === "PEMBALIK" ? cari.jenis : null;
  const [daftar, namaAkun, usaha] = await Promise.all([daftarJurnalUmum(periode === "semua" ? null : periode, jenis), petaAkun(), profilUsaha()]);
  const totalD = daftar.reduce((s, j) => s + j.baris.reduce((x, b) => x + b.debit, 0), 0);
  const totalK = daftar.reduce((s, j) => s + j.baris.reduce((x, b) => x + b.kredit, 0), 0);
  const ketPeriode = periode === "semua" ? "Semua periode" : labelBulanTahun(periode);

  return (
    <>
      <KepalaHalaman
        judul="Jurnal Umum"
        lencana={<LencanaPeriode periode={periode} />}
        keterangan="Dibuat otomatis saat pembelian diposting, pelepasan dan penggajian disetujui, dan saat pembelian dibalik. Hanya jurnal yang sudah disetujui yang tampil."
        aksi={<TombolCetak />}
      />
      <div className="tanpa-cetak flex flex-wrap gap-3">
        <PilihBulanTahun periode={periode} tersedia={semua} semua="Semua periode" />
        <FilterUrl nama="jenis" label="Jenis" nilai={jenis ?? "semua"} opsi={OPSI_JENIS} />
      </div>
      <KepalaCetak usaha={usaha.nama} judul="Jurnal Umum" keterangan={ketPeriode} />

      <Kartu rapat>
        {daftar.length === 0 ? (
          <KeadaanKosong judul="Belum ada jurnal umum" keterangan="Tidak ada jurnal yang cocok dengan filter ini." />
        ) : (
          <Tabel label="Jurnal umum">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>No. jurnal</th>
                <th>Akun dan keterangan</th>
                <th className="kolom-angka">Debit (Rp)</th>
                <th className="kolom-angka">Kredit (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((j) => {
                const baris = j.baris.filter((b) => b.debit || b.kredit);
                return [
                  ...baris.map((b, i) => (
                    <tr key={`${j.no}-${i}`} className={i === 0 ? "border-t-2 border-slate-200" : ""}>
                      {i === 0 && (
                        <>
                          <td rowSpan={baris.length + 1} className="align-top whitespace-nowrap">{labelTanggal(j.tanggal)}</td>
                          <td rowSpan={baris.length + 1} className="align-top">
                            <span className="kode">{j.no}</span>
                            {j.jenis === "PEMBALIK" && <div className="mt-0.5"><Lencana warna="merah">pembalik</Lencana></div>}
                          </td>
                        </>
                      )}
                      <td className={b.kredit ? "pl-10!" : ""}>
                        <span className="kode mr-2">{b.akun}</span>
                        {namaAkun[b.akun] ?? b.akun}
                      </td>
                      <td className="kolom-angka">{b.debit ? <Rupiah nilai={b.debit} polos /> : ""}</td>
                      <td className="kolom-angka">{b.kredit ? <Rupiah nilai={b.kredit} polos /> : ""}</td>
                    </tr>
                  )),
                  <tr key={`${j.no}-ket`}>
                    <td colSpan={3} className="pt-0! pb-2! text-xs text-slate-500">{j.keterangan}</td>
                  </tr>,
                ];
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>
                  Total {daftar.length} jurnal <span className="ml-1">{totalD === totalK ? <Lencana warna="hijau">seimbang</Lencana> : <Lencana warna="merah">tidak seimbang</Lencana>}</span>
                </td>
                <td className="kolom-angka"><Rupiah nilai={totalD} polos /></td>
                <td className="kolom-angka"><Rupiah nilai={totalK} polos /></td>
              </tr>
            </tfoot>
          </Tabel>
        )}
      </Kartu>
    </>
  );
}
