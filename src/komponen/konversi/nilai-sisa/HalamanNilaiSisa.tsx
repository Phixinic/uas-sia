/*
 * Halaman Nilai Sisa Perlengkapan (komponen server). Periode ada di query string (?periode=YYYY-MM).
 * Ringkasan di atas, status jurnal periode ini (dengan tombol Ajukan, Setujui, Tolak yang sama dengan halaman
 * Jurnal Penyesuaian), hitung fisik atau hasil input di tengah, riwayat jurnal di bawah.
 */
import { wajibMasuk } from "@/lib/server/auth";
import { boleh } from "@/lib/peran";
import { petaAkun, periodeTerkunciSemua } from "@/lib/data/umum";
import { dataNilaiSisa, periodeNilaiSisa } from "@/lib/data/konversi/nilai-sisa";
import { kunciPenutup, labelPeriode, periodeDariCari } from "@/lib/inti/tanggal";
import LencanaPeriode from "@/komponen/ui/LencanaPeriode";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import { LencanaStatus } from "@/komponen/ui/Lencana";
import { LABEL_STATUS_PERSETUJUAN } from "@/lib/format";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import TabelJurnal from "@/komponen/ui/TabelJurnal";
import PemilihPeriode from "@/komponen/konversi/umum/PemilihPeriode";
import { PanelStatusJurnal, TabelRiwayatJurnal } from "@/komponen/konversi/umum/StatusJurnal";
import FormNilaiSisa from "./FormNilaiSisa";

export default async function HalamanNilaiSisa({ cari }: { cari: { periode?: string; bulan?: string; tahun?: string } }) {
  const pengguna = await wajibMasuk();
  const { periode, pilihan } = await periodeNilaiSisa(periodeDariCari(cari) ?? undefined);
  const [d, namaAkun, terkunci] = await Promise.all([dataNilaiSisa(periode), petaAkun(), periodeTerkunciSemua()]);
  const bolehInput = boleh(pengguna.peran, "nilai-sisa.input");
  const o = d.opname && d.opname.status !== "DITOLAK" ? d.opname : null;
  const ditolak = d.opname?.status === "DITOLAK" ? d.opname : null;
  // Tertutup bila periode ini atau periode sesudahnya sudah dikunci (kunci berurutan).
  const penutup = kunciPenutup(periode, terkunci);
  const periodeTerkunci = penutup !== null;
  const totalSaldo = d.baris.reduce((s, b) => s + b.saldoBuku, 0);
  const tanpaJurnal = d.riwayat.filter((r) => !r.jurnalNo && r.status === "DISETUJUI");

  return (
    <>
      <KepalaHalaman
        judul="Nilai Sisa Perlengkapan"
        lencana={<LencanaPeriode periode={periode} />}
        keterangan="Biaya perlengkapan = saldo buku dikurangi nilai sisa hasil hitung fisik. Sistem membuat jurnal penyesuaian draf, lalu Admin mengajukannya ke Owner."
        aksi={<PemilihPeriode periode={periode} pilihan={pilihan} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KartuRingkasan judul={`Saldo buku ${labelPeriode(periode)}`} nilai={o ? o.detail.reduce((s, x) => s + x.saldoBuku, 0) : totalSaldo} keterangan={`${o ? o.detail.length : d.baris.length} jenis perlengkapan`} />
        <KartuRingkasan judul="Biaya perlengkapan" nilai={o ? o.totalBeban : "Belum diinput"} nada={o ? "hijau" : "kuning"} keterangan={o ? `Opname ${o.no}` : "Isi hasil hitung fisik di bawah"} />
        <KartuRingkasan
          judul="Status jurnal"
          nilai={o ? (o.jurnal ? LABEL_STATUS_PERSETUJUAN[o.jurnal.status] : "Tanpa jurnal") : ditolak ? "Ditolak" : "-"}
          bukanUang
          nada={o?.jurnal?.status === "DISETUJUI" ? "hijau" : o?.jurnal ? "kuning" : ditolak ? "merah" : "netral"}
          keterangan={
            o?.jurnal ? `${o.jurnal.no}${o.jurnal.status === "DISETUJUI" ? ", sudah masuk buku besar" : ", belum masuk buku besar"}`
            : o ? "Biaya 0, tidak perlu jurnal"
            : ditolak ? "Input ulang di bawah" : undefined
          }
        />
      </div>

      {penutup && (
        <Peringatan jenis="awas">
          {penutup === periode ? `Periode ${labelPeriode(periode)} sudah dikunci` : `Periode ${labelPeriode(periode)} tertutup karena ${labelPeriode(penutup)} sudah dikunci`}, jadi nilai sisanya tidak bisa diinput. Minta Owner membuka kunci dulu.
        </Peringatan>
      )}
      {d.jurnalIni && <PanelStatusJurnal judul={`Jurnal biaya perlengkapan ${labelPeriode(periode)}`} j={d.jurnalIni} sumber="opname" penggunaId={pengguna.id} peran={pengguna.peran} />}
      {ditolak && !d.jurnalIni && <Peringatan jenis="galat">Input sebelumnya ditolak{ditolak.alasanTolak ? `: ${ditolak.alasanTolak}` : ""}. Silakan input ulang.</Peringatan>}

      {o ? (
        <Kartu rapat>
          <KepalaKartu
            judul={<span className="flex flex-wrap items-center gap-2">Nilai sisa {labelPeriode(periode)} sudah diinput <LencanaStatus jenis="persetujuan" status={o.status} /></span>}
            keterangan={`Diinput oleh ${o.dibuatOleh}. Bila jurnalnya ditolak Owner, form ini terbuka lagi untuk diinput ulang.`}
          />
          <Tabel label="Hasil input nilai sisa">
            <thead>
              <tr>
                <th>Perlengkapan</th>
                <th className="kolom-angka">Saldo buku (Rp)</th>
                <th className="kolom-angka">Nilai sisa (Rp)</th>
                <th className="kolom-angka">Biaya (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {o.detail.map((x) => (
                <tr key={x.kode}>
                  <td><span className="kode mr-2">{x.kode}</span>{x.nama}</td>
                  <td className="kolom-angka"><Rupiah nilai={x.saldoBuku} polos /></td>
                  <td className="kolom-angka"><Rupiah nilai={x.nilaiSisa} polos /></td>
                  <td className="kolom-angka"><Rupiah nilai={x.beban} polos /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="kolom-angka"><Rupiah nilai={o.detail.reduce((s, x) => s + x.saldoBuku, 0)} polos /></td>
                <td className="kolom-angka"><Rupiah nilai={o.detail.reduce((s, x) => s + x.nilaiSisa, 0)} polos /></td>
                <td className="kolom-angka"><Rupiah nilai={o.totalBeban} polos /></td>
              </tr>
            </tfoot>
          </Tabel>
          {o.jurnal && (
            <details className="border-t border-slate-100 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">Jurnal penyesuaian {o.jurnal.no}</summary>
              <div className="mt-3"><TabelJurnal baris={o.jurnal.baris} namaAkun={namaAkun} /></div>
            </details>
          )}
        </Kartu>
      ) : d.baris.length === 0 ? (
        <Kartu><KeadaanKosong judul={`Tidak ada saldo perlengkapan sampai ${labelPeriode(periode)}`} keterangan="Posting pembelian perlengkapan dulu, lalu saldonya muncul di sini." /></Kartu>
      ) : periodeTerkunci ? null : d.tahanUrutan ? (
        <Peringatan jenis="awas">{d.tahanUrutan}</Peringatan>
      ) : (
        <FormNilaiSisa key={periode} periode={periode} baris={d.baris} bolehInput={bolehInput} namaAkun={namaAkun} />
      )}

      <TabelRiwayatJurnal
        judul="Riwayat jurnal dan persetujuan"
        riwayat={d.riwayatJurnal}
        sumber="opname"
        alamat="/konversi/nilai-sisa"
        penggunaId={pengguna.id}
        peran={pengguna.peran}
        tombolDiAtas={d.jurnalIni?.no}
      />
      {tanpaJurnal.length > 0 && (
        <p className="teks-redup">
          Periode tanpa biaya perlengkapan (langsung berlaku tanpa jurnal): {tanpaJurnal.map((r) => labelPeriode(r.periode)).join(", ")}.
        </p>
      )}
    </>
  );
}
