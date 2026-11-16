/*
 * Halaman Nilai Sisa Perlengkapan (komponen server). Periode ada di query string (?periode=YYYY-MM).
 * Ringkasan di atas, hitung fisik atau hasil input di tengah, riwayat di bawah.
 */
import { wajibMasuk } from "@/lib/server/auth";
import { boleh } from "@/lib/peran";
import { petaAkun, periodeTerkunciSemua } from "@/lib/data/umum";
import { dataNilaiSisa, periodeNilaiSisa } from "@/lib/data/konversi/nilai-sisa";
import { labelPeriode } from "@/lib/inti/tanggal";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import { LencanaStatus } from "@/komponen/ui/Lencana";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import TabelJurnal from "@/komponen/ui/TabelJurnal";
import PemilihPeriode from "@/komponen/konversi/umum/PemilihPeriode";
import TombolAjukanJurnal from "@/komponen/konversi/umum/TombolAjukanJurnal";
import FormNilaiSisa from "./FormNilaiSisa";

const ALAMAT = "/konversi/nilai-sisa";

export default async function HalamanNilaiSisa({ cari }: { cari: { periode?: string } }) {
  const pengguna = await wajibMasuk();
  const { periode, pilihan } = await periodeNilaiSisa(cari.periode);
  const [d, namaAkun, terkunci] = await Promise.all([dataNilaiSisa(periode), petaAkun(), periodeTerkunciSemua()]);
  const bolehInput = boleh(pengguna.peran, "nilai-sisa.input");
  const bolehAjukan = boleh(pengguna.peran, "jurnal-penyesuaian.ajukan");
  const o = d.opname && d.opname.status !== "DITOLAK" ? d.opname : null;
  const ditolak = d.opname?.status === "DITOLAK" ? d.opname : null;
  const periodeTerkunci = terkunci.includes(periode);
  const totalSaldo = d.baris.reduce((s, b) => s + b.saldoBuku, 0);

  return (
    <>
      <KepalaHalaman
        judul="Nilai Sisa Perlengkapan"
        keterangan="Biaya perlengkapan = saldo buku dikurangi nilai sisa hasil hitung fisik. Sistem membuat jurnal penyesuaian draf, lalu Admin mengajukannya ke Owner."
        aksi={<PemilihPeriode alamat={ALAMAT} periode={periode} pilihan={pilihan} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KartuRingkasan judul={`Saldo buku ${labelPeriode(periode)}`} nilai={o ? o.detail.reduce((s, x) => s + x.saldoBuku, 0) : totalSaldo} keterangan={`${o ? o.detail.length : d.baris.length} jenis perlengkapan`} />
        <KartuRingkasan judul="Biaya perlengkapan" nilai={o ? o.totalBeban : "Belum diinput"} nada={o ? "hijau" : "kuning"} keterangan={o ? `Opname ${o.no}` : "Isi hasil hitung fisik di bawah"} />
        <KartuRingkasan
          judul="Status jurnal"
          nilai={o ? (o.jurnal ? { DRAFT: "Draf", DIAJUKAN: "Diajukan", DISETUJUI: "Disetujui", DITOLAK: "Ditolak" }[o.jurnal.status] : "Tanpa jurnal") : "-"}
          bukanUang
          nada={o?.jurnal?.status === "DISETUJUI" ? "hijau" : o?.jurnal ? "kuning" : "netral"}
          keterangan={o?.jurnal ? o.jurnal.no : o ? "Biaya 0, tidak perlu jurnal" : undefined}
        />
      </div>

      {periodeTerkunci && <Peringatan jenis="awas">Periode {labelPeriode(periode)} sudah dikunci, jadi nilai sisanya tidak bisa diinput. Minta Owner membuka kunci dulu.</Peringatan>}
      {ditolak && <Peringatan jenis="galat">Input sebelumnya ditolak{ditolak.alasanTolak ? `: ${ditolak.alasanTolak}` : ""}. Silakan input ulang.</Peringatan>}

      {o ? (
        <Kartu rapat>
          <KepalaKartu
            judul={<span className="flex flex-wrap items-center gap-2">Nilai sisa {labelPeriode(periode)} sudah diinput <LencanaStatus jenis="persetujuan" status={o.status} /></span>}
            keterangan={`Diinput oleh ${o.dibuatOleh}. Bila jurnalnya ditolak Owner, form ini terbuka lagi untuk diinput ulang.`}
            aksi={o.jurnal?.status === "DRAFT" && bolehAjukan ? <TombolAjukanJurnal no={o.jurnal.no} /> : null}
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
      ) : periodeTerkunci ? null : (
        <FormNilaiSisa key={periode} periode={periode} baris={d.baris} bolehInput={bolehInput} namaAkun={namaAkun} />
      )}

      <Kartu rapat>
        <KepalaKartu judul="Riwayat input" keterangan={`${d.riwayat.length} periode`} />
        {d.riwayat.length === 0 ? (
          <KeadaanKosong judul="Belum ada input nilai sisa" />
        ) : (
          <Tabel label="Riwayat input nilai sisa">
            <thead>
              <tr>
                <th>Periode</th>
                <th className="kolom-angka">Biaya (Rp)</th>
                <th>Jurnal</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {d.riwayat.map((r) => (
                <tr key={r.no}>
                  <td>{labelPeriode(r.periode)}</td>
                  <td className="kolom-angka"><Rupiah nilai={r.totalBeban} polos /></td>
                  <td className="kode">{r.jurnalNo ?? "-"}</td>
                  <td><LencanaStatus jenis="persetujuan" status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>
    </>
  );
}
