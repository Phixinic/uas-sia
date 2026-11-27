/*
 * Halaman Nilai Sisa Perlengkapan (komponen server). Periode ada di query string (?bulan=&tahun=).
 * Ringkasan di atas, status jurnal periode ini (tombol Ajukan, Setujui, Kembalikan untuk revisi yang sama dengan halaman
 * Jurnal Penyesuaian), lalu hitung fisik: form kosong, form draf yang bisa diubah (termasuk yang dikembalikan Owner),
 * atau hasil yang sudah diajukan atau disetujui. Sesudah disetujui Admin bisa mengajukan revisi (`?revisi=baru`);
 * revisi yang menunggu dan riwayat versinya tampil di bawahnya, riwayat jurnal paling bawah.
 */
import { wajibMasuk } from "@/lib/server/auth";
import { boleh } from "@/lib/peran";
import { petaAkun, periodeTerkunciSemua } from "@/lib/data/umum";
import { dataNilaiSisa, periodeNilaiSisa } from "@/lib/data/konversi/nilai-sisa";
import { bulanDari, kunciPenutup, labelPeriode, periodeDariCari, tahunDari } from "@/lib/inti/tanggal";
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
import { TautanTombol } from "@/komponen/ui/Tombol";
import FormNilaiSisa from "./FormNilaiSisa";
import { KartuRevisiMenunggu, RiwayatVersi } from "./PanelRevisi";
import { jurnalDikembalikan } from "@/lib/inti/urut";

type DataOpname = NonNullable<Awaited<ReturnType<typeof dataNilaiSisa>>["opname"]>;

function TabelHasil({ o, judul, keterangan, namaAkun, aksi }: { o: DataOpname; judul: string; keterangan: string; namaAkun: Record<string, string>; aksi?: React.ReactNode }) {
  return (
    <Kartu rapat>
      <KepalaKartu judul={<span className="flex flex-wrap items-center gap-2">{judul} <LencanaStatus jenis="revisi" status={o.status} /></span>} keterangan={keterangan} aksi={aksi} />
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
  );
}

export default async function HalamanNilaiSisa({ cari }: { cari: { periode?: string; bulan?: string; tahun?: string; revisi?: string } }) {
  const pengguna = await wajibMasuk();
  const { periode, pilihan, batas, lewatBatas } = await periodeNilaiSisa(periodeDariCari(cari) ?? undefined);
  const [d, namaAkun, terkunci] = await Promise.all([dataNilaiSisa(periode), petaAkun(), periodeTerkunciSemua()]);
  const bolehInput = boleh(pengguna.peran, "nilai-sisa.input");
  const op = d.opname;
  // Sudah diajukan atau disetujui: tampil sebagai hasil. Draf (termasuk dikembalikan Owner) masih bisa diubah Admin.
  const final = op && (op.status === "DIAJUKAN" || op.status === "DISETUJUI") ? op : null;
  const draf = op?.status === "DRAFT" ? op : null;
  const ditolak = op?.status === "DITOLAK" ? op : null;
  const o = final ?? draf;
  // Tertutup bila periode ini atau periode sesudahnya sudah dikunci (kunci berurutan).
  const penutup = kunciPenutup(periode, terkunci);
  const periodeTerkunci = penutup !== null;
  const totalSaldo = d.baris.reduce((s, b) => s + b.saldoBuku, 0);
  const tanpaJurnal = d.riwayat.filter((r) => !r.jurnalNo && r.status === "DISETUJUI");
  const revisiMenunggu = op?.revisi.find((r) => r.status === "DIAJUKAN") ?? null;
  const revisiKembali = !revisiMenunggu && op?.revisi[0]?.status === "DITOLAK" ? op.revisi[0] : null;
  const alamat = `/konversi/nilai-sisa?bulan=${bulanDari(periode)}&tahun=${tahunDari(periode)}`;
  const bolehRevisi = bolehInput && final?.status === "DISETUJUI" && !d.tahanRevisi && !periodeTerkunci;
  const formRevisi = bolehRevisi && cari.revisi === "baru";
  const nilaiDari = (x: { kode: string; nilaiSisa: number }[]) => Object.fromEntries(x.map((y) => [y.kode, y.nilaiSisa]));

  return (
    <>
      <KepalaHalaman
        judul="Nilai Sisa Perlengkapan"
        lencana={<LencanaPeriode periode={periode} />}
        keterangan="Biaya perlengkapan = saldo buku dikurangi nilai sisa hasil hitung fisik. Admin menyimpan lalu mengajukan ke Owner. Owner menyetujui atau mengembalikan untuk revisi. Sesudah disetujui, Admin masih bisa mengajukan revisi selama periodenya belum ditutup."
        aksi={<PemilihPeriode periode={periode} pilihan={pilihan} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KartuRingkasan judul={`Saldo buku ${labelPeriode(periode)}`} nilai={o ? o.detail.reduce((s, x) => s + x.saldoBuku, 0) : totalSaldo} keterangan={`${o ? o.detail.length : d.baris.length} jenis perlengkapan`} />
        <KartuRingkasan judul="Biaya perlengkapan" nilai={o ? o.totalBeban : "Belum diinput"} nada={final ? "hijau" : "kuning"} keterangan={o ? `Opname ${o.no}${draf ? ", masih draf" : ""}` : "Isi hasil hitung fisik di bawah"} />
        <KartuRingkasan
          judul="Status jurnal"
          nilai={o?.jurnal ? LABEL_STATUS_PERSETUJUAN[o.jurnal.status] : final ? "Tanpa jurnal" : draf?.alasanTolak ? "Dikembalikan" : ditolak ? "Ditolak" : "-"}
          bukanUang
          nada={o?.jurnal?.status === "DISETUJUI" ? "hijau" : o?.jurnal || draf ? "kuning" : ditolak ? "merah" : "netral"}
          keterangan={
            o?.jurnal ? `${o.jurnal.no}${o.jurnal.status === "DISETUJUI" ? ", sudah masuk buku besar" : ", belum masuk buku besar"}`
            : final ? "Biaya 0, tidak perlu jurnal"
            : draf?.alasanTolak ? "Ubah lalu ajukan ulang"
            : ditolak ? "Input ulang di bawah" : undefined
          }
        />
      </div>

      {penutup && (
        <Peringatan jenis="awas">
          {penutup === periode ? `Periode ${labelPeriode(periode)} sudah dikunci` : `Periode ${labelPeriode(periode)} tertutup karena ${labelPeriode(penutup)} sudah dikunci`}, jadi nilai sisanya tidak bisa diinput atau direvisi. Minta Owner membuka kunci dulu.
        </Peringatan>
      )}
      {d.jurnalIni && <PanelStatusJurnal judul={`Jurnal biaya perlengkapan ${labelPeriode(periode)}`} j={d.jurnalIni} sumber="opname" penggunaId={pengguna.id} peran={pengguna.peran} />}
      {ditolak && !d.jurnalIni && <Peringatan jenis="galat">Input sebelumnya ditolak{ditolak.alasanTolak ? `: ${ditolak.alasanTolak}` : ""}. Silakan input ulang.</Peringatan>}
      {revisiMenunggu && <KartuRevisiMenunggu r={revisiMenunggu} bolehPutuskan={boleh(pengguna.peran, "jurnal-penyesuaian.putuskan")} />}
      {revisiKembali && (
        <Peringatan jenis="galat">
          Revisi {revisiKembali.no} dikembalikan Owner: {revisiKembali.alasanTolak}. Nilai yang berlaku tidak berubah.
          {bolehRevisi && !formRevisi && <> Kamu bisa mengubahnya lalu mengajukan revisi baru lewat tombol Ajukan revisi.</>}
        </Peringatan>
      )}

      {formRevisi && final ? (
        <FormNilaiSisa
          key={`revisi-${periode}`}
          periode={periode}
          baris={final.detail.map((x) => ({ kode: x.kode, nama: x.nama, satuan: x.satuan, saldoBuku: x.saldoBuku }))}
          bolehInput
          revisi
          awal={nilaiDari(revisiKembali?.detail ?? final.detail)}
          judul={`Revisi nilai sisa · ${labelPeriode(periode)}`}
          keterangan="Ubah nilai sisa yang perlu dikoreksi lalu tulis alasannya. Nilai yang berlaku belum berubah sampai Owner menyetujui revisi."
          namaAkun={namaAkun}
          batalHref={alamat}
        />
      ) : final ? (
        <TabelHasil
          o={final}
          namaAkun={namaAkun}
          judul={`Nilai sisa ${labelPeriode(periode)} sudah diinput`}
          keterangan={final.status === "DIAJUKAN" ? `Diinput oleh ${final.dibuatOleh}. Bila Owner mengembalikannya, form ini terbuka lagi untuk diubah.` : `Diinput oleh ${final.dibuatOleh}.${bolehInput && d.tahanRevisi && !revisiMenunggu && final.status === "DISETUJUI" ? ` ${d.tahanRevisi}` : ""}`}
          aksi={bolehRevisi ? <TautanTombol href={`${alamat}&revisi=baru`} kecil>Ajukan revisi</TautanTombol> : undefined}
        />
      ) : d.baris.length === 0 && !draf ? (
        <Kartu><KeadaanKosong judul={`Tidak ada saldo perlengkapan sampai ${labelPeriode(periode)}`} keterangan="Posting pembelian perlengkapan dulu, lalu saldonya muncul di sini." /></Kartu>
      ) : lewatBatas ? (
        <Peringatan jenis="awas">Nilai sisa hanya bisa diinput sampai {labelPeriode(batas)}.</Peringatan>
      ) : periodeTerkunci ? (
        draf ? <TabelHasil o={draf} namaAkun={namaAkun} judul={`Nilai sisa ${labelPeriode(periode)} (draf)`} keterangan={`Diinput oleh ${draf.dibuatOleh}.`} /> : null
      ) : d.tahanUrutan ? (
        <>
          <Peringatan jenis="awas">{d.tahanUrutan}</Peringatan>
          {/* Saldo buku tetap tampil sebagai pratinjau; isiannya baru terbuka sesudah urutan bulan terpenuhi. */}
          <FormNilaiSisa key={periode} periode={periode} baris={d.baris} bolehInput={false} tertahan namaAkun={namaAkun} />
        </>
      ) : draf && !bolehInput ? (
        <TabelHasil o={draf} namaAkun={namaAkun} judul={`Nilai sisa ${labelPeriode(periode)} (draf)`} keterangan={draf.alasanTolak ? `Dikembalikan Owner untuk revisi: ${draf.alasanTolak}. Menunggu Admin mengubah lalu mengajukan ulang.` : `Diinput oleh ${draf.dibuatOleh}. Menunggu Admin mengajukan ke Owner.`} />
      ) : (
        <>
          {draf?.alasanTolak && !d.jurnalIni && <Peringatan jenis="galat"><b>Dikembalikan Owner untuk revisi:</b> {draf.alasanTolak}. Ubah nilainya, simpan, lalu ajukan ulang.</Peringatan>}
          <FormNilaiSisa
            key={`${periode}-${draf?.jurnal?.no ?? "baru"}`}
            periode={periode}
            baris={d.baris}
            bolehInput={bolehInput}
            namaAkun={namaAkun}
            awal={draf ? nilaiDari(draf.detail) : undefined}
            judul={draf ? `Ubah nilai sisa (draf) · ${labelPeriode(periode)}` : undefined}
            keterangan={draf ? "Nilai yang tersimpan sudah terisi. Ubah bila perlu lalu simpan; ajukan ke Owner lewat panel jurnal di atas." : undefined}
          />
        </>
      )}

      {op && op.revisi.length > 0 && <RiwayatVersi revisi={op.revisi} totalSekarang={op.totalBeban} />}

      <TabelRiwayatJurnal
        judul="Riwayat jurnal dan persetujuan"
        riwayat={d.riwayatJurnal}
        sumber="opname"
        alamat="/konversi/nilai-sisa"
        penggunaId={pengguna.id}
        peran={pengguna.peran}
        tombolDiAtas={d.jurnalIni?.no}
        dikembalikan={jurnalDikembalikan(d.riwayatJurnal, new Set(d.riwayat.filter((r) => r.status === "DRAFT" && !r.jurnalNo).map((r) => r.periode)))}
      />
      {tanpaJurnal.length > 0 && (
        <p className="teks-redup">
          Periode tanpa biaya perlengkapan (langsung berlaku tanpa jurnal): {tanpaJurnal.map((r) => labelPeriode(r.periode)).join(", ")}.
        </p>
      )}
    </>
  );
}
