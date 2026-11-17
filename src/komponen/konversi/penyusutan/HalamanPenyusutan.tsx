/*
 * Halaman Proses Penyusutan (komponen server). Satu jurnal penyesuaian per periode, dibuat dari baris jadwal
 * yang belum dijurnal. Periode lebih lama harus diproses dulu.
 */
import Link from "next/link";
import { wajibMasuk } from "@/lib/server/auth";
import { boleh } from "@/lib/peran";
import { petaAkun } from "@/lib/data/umum";
import { dataPenyusutan, periodePenyusutan } from "@/lib/data/konversi/penyusutan";
import { labelPeriode } from "@/lib/inti/tanggal";
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
import TombolAjukanJurnal from "@/komponen/konversi/umum/TombolAjukanJurnal";
import TombolProses from "./TombolProses";
import type { StatusPersetujuan } from "@/generated/prisma/enums";

const ALAMAT = "/konversi/penyusutan";

export default async function HalamanPenyusutan({ cari }: { cari: { periode?: string } }) {
  const pengguna = await wajibMasuk();
  const { periode, pilihan } = await periodePenyusutan(cari.periode);
  const [d, namaAkun] = await Promise.all([dataPenyusutan(periode), petaAkun()]);
  const bolehProses = boleh(pengguna.peran, "penyusutan.proses");
  const bolehAjukan = boleh(pengguna.peran, "jurnal-penyesuaian.ajukan");
  const tertahan = d.periodeSebelumnyaBelum.length > 0 || d.terkunci;

  return (
    <>
      <KepalaHalaman
        judul="Proses Penyusutan"
        keterangan="Saat pembelian diposting, sistem hanya membuat jadwal. Beban tiap bulan baru dijurnal di sini, satu jurnal penyesuaian per periode dengan rincian per aset."
        aksi={<PemilihPeriode alamat={ALAMAT} periode={periode} pilihan={pilihan} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KartuRingkasan judul={`Aset disusutkan ${labelPeriode(periode)}`} nilai={String(d.baris.length)} bukanUang keterangan={`${d.belumDiproses} belum diproses`} nada={d.belumDiproses ? "kuning" : "netral"} />
        <KartuRingkasan judul="Beban belum diproses" nilai={d.totalBelum} nada={d.totalBelum ? "kuning" : "hijau"} keterangan={d.totalBelum ? "Siap dibuatkan jurnal" : "Tidak ada yang tertunda"} />
        <KartuRingkasan judul="Jurnal penyusutan" nilai={String(d.riwayat.length)} bukanUang keterangan={`${d.riwayat.filter((j) => j.status === "DISETUJUI").length} disetujui`} />
      </div>

      {d.periodeSebelumnyaBelum.length > 0 && (
        <Peringatan jenis="awas">
          Periode {labelPeriode(d.periodeSebelumnyaBelum[0])} belum diproses.{" "}
          <Link className="font-medium underline" href={`${ALAMAT}?periode=${d.periodeSebelumnyaBelum[0]}`}>Buka periode itu</Link>
          . Proses periode paling lama dulu supaya urutan jadwal tetap benar.
        </Peringatan>
      )}
      {d.penutup && (
        <Peringatan jenis="galat">
          {d.penutup === periode ? `Periode ${labelPeriode(periode)} terkunci` : `Periode ${labelPeriode(periode)} tertutup karena ${labelPeriode(d.penutup)} sudah dikunci`}. Minta Owner membuka kunci sebelum memproses.
        </Peringatan>
      )}

      <Kartu rapat>
        <KepalaKartu judul={`Pratinjau ${labelPeriode(periode)}`} keterangan={`${d.baris.length} aset, ${d.belumDiproses} belum diproses`} />
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
              <h2 className="judul-kartu">Jurnal penyesuaian yang akan dibuat (draf)</h2>
              <p className="mt-0.5 text-xs text-slate-500">Dikelompokkan per pasangan akun beban dan akun akumulasi.</p>
            </div>
            {bolehProses ? <TombolProses periode={periode} jumlah={d.belumDiproses} total={d.totalBelum} disabled={tertahan} /> : <p className="teks-redup">Proses penyusutan dijalankan oleh Admin.</p>}
          </div>
          <details className="mt-3" open>
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Lihat baris jurnal</summary>
            <div className="mt-3"><TabelJurnal baris={d.jurnalBaris} namaAkun={namaAkun} /></div>
          </details>
        </Kartu>
      )}

      <Kartu rapat>
        <KepalaKartu judul="Riwayat proses" keterangan={`${d.riwayat.length} jurnal`} />
        {d.riwayat.length === 0 ? (
          <KeadaanKosong judul="Belum ada jurnal penyusutan" />
        ) : (
          <Tabel label="Riwayat proses penyusutan">
            <thead>
              <tr>
                <th>Jurnal</th>
                <th>Periode</th>
                <th className="kolom-angka">Aset</th>
                <th className="kolom-angka">Total (Rp)</th>
                <th>Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {d.riwayat.map((j) => (
                <tr key={j.no}>
                  <td className="kode">{j.no}</td>
                  <td><Link className="hover:underline" href={`${ALAMAT}?periode=${j.periode}`}>{labelPeriode(j.periode)}</Link></td>
                  <td className="kolom-angka">{j.jumlahAset}</td>
                  <td className="kolom-angka"><Rupiah nilai={j.total} polos /></td>
                  <td>
                    <LencanaStatus jenis="persetujuan" status={j.status} />
                    {j.alasanTolak && <div className="mt-0.5 text-[11px] text-rose-600">{j.alasanTolak}</div>}
                  </td>
                  <td><div className="flex justify-end">{j.status === "DRAFT" && bolehAjukan && <TombolAjukanJurnal no={j.no} varian="garis" />}</div></td>
                </tr>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>
    </>
  );
}
