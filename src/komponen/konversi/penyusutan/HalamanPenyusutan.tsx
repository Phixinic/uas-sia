/*
 * Halaman Proses Penyusutan (komponen server). Admin memilih bulan, memeriksa pratinjau beban per aset, lalu satu tombol
 * membuat jurnal penyesuaian yang langsung disetujui dan masuk buku besar. Tidak ada langkah ajukan, setujui, atau tolak:
 * penyusutan dihitung dari jadwal aset. Periode lebih lama harus diproses dulu, dan periode tertutup menolak proses.
 * Owner dan HRD hanya melihat.
 */
import Link from "next/link";
import { wajibMasuk } from "@/lib/server/auth";
import { boleh } from "@/lib/peran";
import { petaAkun } from "@/lib/data/umum";
import { LABEL_STATUS_PERSETUJUAN, rupiah } from "@/lib/format";
import { dataPenyusutan, periodePenyusutan } from "@/lib/data/konversi/penyusutan";
import { denganPeriode, labelBulanTahun, labelPeriode, periodeDariCari } from "@/lib/inti/tanggal";
import LencanaPeriode from "@/komponen/ui/LencanaPeriode";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import Lencana, { LencanaStatus } from "@/komponen/ui/Lencana";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import TabelJurnal from "@/komponen/ui/TabelJurnal";
import PemilihPeriode from "@/komponen/konversi/umum/PemilihPeriode";
import { PanelStatusJurnal, TabelRiwayatJurnal } from "@/komponen/konversi/umum/StatusJurnal";
import TombolProses from "./TombolProses";
import type { StatusPersetujuan } from "@/generated/prisma/enums";

const ALAMAT = "/konversi/penyusutan";

export default async function HalamanPenyusutan({ cari }: { cari: { periode?: string; bulan?: string; tahun?: string } }) {
  const pengguna = await wajibMasuk();
  const { periode, pilihan, batas, lewatBatas } = await periodePenyusutan(periodeDariCari(cari) ?? undefined);
  const [d, namaAkun] = await Promise.all([dataPenyusutan(periode), petaAkun()]);
  const bolehProses = boleh(pengguna.peran, "penyusutan.proses");
  const tertahan = d.periodeSebelumnyaBelum.length > 0 || d.terkunci || lewatBatas;

  return (
    <>
      <KepalaHalaman
        judul="Proses Penyusutan"
        lencana={<LencanaPeriode periode={periode} />}
        keterangan="Saat pembelian diposting, sistem membuat jadwal penyusutan. Pilih bulan, periksa pratinjau, lalu proses. Jurnal penyesuaiannya langsung disetujui dan masuk buku besar, karena bebannya dihitung dari jadwal aset."
        aksi={<PemilihPeriode periode={periode} pilihan={pilihan} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KartuRingkasan judul={`Aset disusutkan ${labelPeriode(periode)}`} nilai={String(d.baris.length)} bukanUang keterangan={`${d.belumDiproses} belum diproses`} nada={d.belumDiproses ? "kuning" : "netral"} />
        <KartuRingkasan
          judul="Beban masuk buku besar"
          nilai={d.totalDisetujui}
          nada={d.totalBeban && d.totalDisetujui === d.totalBeban ? "hijau" : d.totalBeban ? "kuning" : "netral"}
          keterangan={
            d.totalMenunggu ? `${rupiah(d.totalMenunggu)} masih draf atau diajukan`
            : d.totalBelum ? `${rupiah(d.totalBelum)} belum diproses`
            : d.totalBeban ? "Semua beban periode ini sudah diproses" : "Tidak ada beban di periode ini"
          }
        />
        <KartuRingkasan
          judul={`Status jurnal ${labelPeriode(periode)}`}
          nilai={d.jurnalIni?.status === "DISETUJUI" ? "Sudah diproses" : d.jurnalIni ? LABEL_STATUS_PERSETUJUAN[d.jurnalIni.status] : "Belum diproses"}
          bukanUang
          nada={d.jurnalIni?.status === "DISETUJUI" ? "hijau" : d.jurnalIni?.status === "DITOLAK" ? "merah" : d.jurnalIni ? "kuning" : "netral"}
          keterangan={d.jurnalIni ? `${d.jurnalIni.no}${d.jurnalIni.status === "DISETUJUI" ? ", sudah masuk buku besar" : d.jurnalIni.status === "DITOLAK" ? ", proses ulang" : ", belum masuk buku besar"}` : "Belum ada jurnal"}
        />
      </div>

      {d.periodeSebelumnyaBelum.length > 0 && (
        <Peringatan jenis="awas">
          Periode {labelPeriode(d.periodeSebelumnyaBelum[0])} belum diproses.{" "}
          <Link className="font-medium underline" href={denganPeriode(ALAMAT, d.periodeSebelumnyaBelum[0])}>Buka periode itu</Link>
          . Proses periode paling lama dulu supaya urutan jadwal tetap benar.
        </Peringatan>
      )}
      {lewatBatas && d.belumDiproses > 0 && (
        <Peringatan jenis="awas">Penyusutan hanya bisa diproses sampai {labelPeriode(batas)}. {labelPeriode(periode)} baru bisa dijurnal di tahun berjalan itu.</Peringatan>
      )}
      {d.penutup && (
        <Peringatan jenis="galat">
          {d.penutup === periode ? `Periode ${labelPeriode(periode)} terkunci` : `Periode ${labelPeriode(periode)} tertutup karena ${labelPeriode(d.penutup)} sudah dikunci`}. Minta Owner membuka kunci sebelum memproses.
        </Peringatan>
      )}

      {d.jurnalIni && <PanelStatusJurnal judul={`Jurnal penyusutan ${labelPeriode(periode)}`} j={d.jurnalIni} sumber="penyusutan" penggunaId={pengguna.id} peran={pengguna.peran} />}

      <Kartu rapat>
        <KepalaKartu judul={`Pratinjau · ${labelBulanTahun(periode)}`} keterangan={`${d.baris.length} aset, ${d.belumDiproses} belum diproses`} />
        {d.baris.length === 0 ? (
          <KeadaanKosong judul={`Tidak ada aset yang disusutkan pada ${labelPeriode(periode)}`} keterangan="Jadwal dibuat saat pembelian peralatan diposting." />
        ) : (
          <Tabel label="Pratinjau penyusutan">
            <thead>
              <tr>
                <th>Aset</th>
                <th>Periode ke</th>
                <th className="kolom-angka">Beban (Rp)</th>
                <th className="kolom-angka">Akumulasi (Rp)</th>
                <th className="kolom-angka">Nilai buku (Rp)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {d.baris.map((r) => (
                <tr key={r.asetKode}>
                  <td>
                    <Link className="kode hover:underline" href={`/konversi/kartu-aset?aset=${r.asetKode}`}>{r.asetKode}</Link> {r.nama}
                    {r.dilepas && <span className="ml-1.5"><Lencana warna="abu">dilepas</Lencana></span>}
                  </td>
                  <td className="whitespace-nowrap">
                    {r.periodeKe} dari {r.n}
                    {r.periodeKe === r.n && r.n > 1 && <Lencana warna="biru">sisa (rumus 2)</Lencana>}
                  </td>
                  <td className="kolom-angka"><Rupiah nilai={r.beban} polos /></td>
                  <td className="kolom-angka"><Rupiah nilai={r.akumulasi} polos /></td>
                  <td className="kolom-angka"><Rupiah nilai={r.nilaiBuku} polos /></td>
                  <td>
                    {r.jurnalNo ? (
                      <><LencanaStatus jenis="persetujuan" status={(r.statusJurnal ?? "DRAFT") as StatusPersetujuan} /><div className="kode mt-0.5 text-[11px]!">{r.jurnalNo}</div></>
                    ) : (
                      <Lencana warna="kuning">Belum diproses</Lencana>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total beban {labelPeriode(periode)}</td>
                <td className="kolom-angka"><Rupiah nilai={d.totalBeban} polos /></td>
                <td colSpan={3} />
              </tr>
              <tr>
                <td colSpan={2}>Total belum diproses</td>
                <td className="kolom-angka"><Rupiah nilai={d.totalBelum} polos /></td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </Tabel>
        )}
      </Kartu>

      {d.belumDiproses > 0 && (
        <Kartu>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="judul-kartu">Jurnal penyesuaian yang akan dibuat</h2>
              <p className="mt-0.5 text-xs text-slate-500">Dikelompokkan per pasangan akun beban dan akun akumulasi. Langsung disetujui dan masuk buku besar saat diproses.</p>
            </div>
            {bolehProses ? <TombolProses periode={periode} jumlah={d.belumDiproses} total={d.totalBelum} disabled={tertahan} /> : <p className="teks-redup">Penyusutan diproses oleh Admin. Owner melihat hasilnya di sini dan di Jurnal Penyesuaian.</p>}
          </div>
          <details className="mt-3" open>
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Lihat baris jurnal</summary>
            <div className="mt-3"><TabelJurnal baris={d.jurnalBaris} namaAkun={namaAkun} /></div>
          </details>
        </Kartu>
      )}

      <TabelRiwayatJurnal
        judul="Riwayat proses penyusutan"
        riwayat={d.riwayat}
        sumber="penyusutan"
        alamat={ALAMAT}
        penggunaId={pengguna.id}
        peran={pengguna.peran}
        tombolDiAtas={d.jurnalIni?.no}
        kolomTambahan={{ judul: "Aset", isi: (j) => (j.status === "DITOLAK" ? "-" : (d.jumlahAset[j.no] ?? 0)) }}
      />
    </>
  );
}
