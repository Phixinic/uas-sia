/*
 * Halaman Distribusi Gaji (komponen server). Keadaan di URL: ?bulan=10&tahun=2026.
 * HRD mengajukan semua slip draf satu periode; Owner menyetujui (jurnal dan pembayaran) atau menolak dengan alasan.
 */
import LencanaBiaya from "@/komponen/sdm/LencanaBiaya";
import Link from "next/link";
import { wajibMasuk } from "@/lib/server/auth";
import { boleh } from "@/lib/peran";
import { petaAkun } from "@/lib/data/umum";
import { denganPeriode, labelBulanTahun, labelPeriode } from "@/lib/inti/tanggal";
import LencanaPeriode from "@/komponen/ui/LencanaPeriode";
import { labelTanggal, rupiah } from "@/lib/format";
import { opsiPeriodeSdm, periodeDipilih, type CariPeriode } from "@/lib/data/sdm/umum";
import { dataDistribusi } from "@/lib/data/sdm/distribusi";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import TabelJurnal from "@/komponen/ui/TabelJurnal";
import { LencanaStatus } from "@/komponen/ui/Lencana";
import { TautanTombol } from "@/komponen/ui/Tombol";
import PilihPeriode from "./PilihPeriode";
import { AksiPengajuan, TombolAjukan } from "./AksiGaji";
import RingkasanTahunGaji from "./RingkasanTahunGaji";

export type CariDistribusi = CariPeriode;

export default async function HalamanDistribusi({ cari }: { cari: CariDistribusi }) {
  const pengguna = await wajibMasuk();
  const periode = periodeDipilih(cari);
  const bolehAjukan = boleh(pengguna.peran, "penggajian.ajukan");
  const bolehPutuskan = boleh(pengguna.peran, "penggajian.putuskan");

  const [opsiPeriode, d, namaAkun] = await Promise.all([opsiPeriodeSdm(periode), dataDistribusi(periode), petaAkun()]);
  const jumlah = (f: (s: (typeof d.draf)[number]) => number) => d.draf.reduce((s, x) => s + f(x), 0);
  const totalThp = jumlah((s) => s.thp);
  const menunggu = d.pengajuan.filter((g) => g.status === "DIAJUKAN");
  const thpMenunggu = menunggu.reduce((s, g) => s + g.totalThp, 0);
  const kasKurang = thpMenunggu > d.saldoKas;
  const dibayarThp = d.dibayar.reduce((s, x) => s + x.thp, 0);

  return (
    <>
      <KepalaHalaman
        judul="Distribusi Gaji"
        lencana={<><LencanaBiaya jenis="tetap" /><LencanaPeriode periode={periode} /></>}
        keterangan="Slip draf satu periode diajukan HRD sekaligus. Setelah Owner menyetujui, sistem membuat satu jurnal umum (biaya gaji, utang PPh 21, dan kas) dan semua slip menjadi Dibayar."
        aksi={<PilihPeriode terpilih={periode} opsi={opsiPeriode} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KartuRingkasan judul="Slip draf" nilai={String(d.draf.length)} bukanUang nada={d.draf.length ? "kuning" : "netral"} keterangan={d.draf.length ? "Siap diajukan" : "Tidak ada draf"} />
        <KartuRingkasan judul="Menunggu Owner" nilai={String(menunggu.length)} bukanUang nada={menunggu.length ? "kuning" : "netral"} keterangan={menunggu.length ? `THP ${rupiah(thpMenunggu)}` : "Tidak ada pengajuan"} />
        <KartuRingkasan judul="Sudah dibayar" nilai={dibayarThp} nada="hijau" keterangan={`${d.dibayar.length} slip ${labelPeriode(periode)}`} />
        <KartuRingkasan judul="Saldo kas saat ini" nilai={d.saldoKas} nada={kasKurang ? "merah" : "netral"} keterangan={kasKurang ? "Kurang dari THP yang diajukan" : "Dari jurnal yang disetujui"} />
      </div>

      <RingkasanTahunGaji periode={periode} alamat="/sdm/distribusi" />

      {kasKurang && bolehPutuskan && (
        <Peringatan jenis="awas">
          Saldo kas {rupiah(d.saldoKas)} lebih kecil dari THP yang diajukan ({rupiah(thpMenunggu)}), kurang {rupiah(thpMenunggu - d.saldoKas)}. Persetujuan akan ditolak sistem sampai kas cukup.{" "}
          <Link className="font-medium underline" href="/modal/investasi-kas?form=baru">Catat setoran modal di menu Investasi Kas</Link>.
        </Peringatan>
      )}

      <Kartu>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="judul-kartu">Slip draf · {labelBulanTahun(periode)}</h2>
            <p className="mt-0.5 text-xs text-slate-500">Slip dibuat di menu Hitung Gaji.</p>
          </div>
          {d.draf.length > 0 && bolehAjukan && <TombolAjukan periode={periode} jumlah={d.draf.length} thp={totalThp} />}
        </div>
        {d.draf.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Tidak ada slip draf pada periode ini.{" "}
            <TautanTombol href={denganPeriode("/sdm/hitung-gaji", periode)} varian="hantu" kecil>Buka Hitung Gaji</TautanTombol>
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
              <Ringkas judul="Jumlah slip" nilai={String(d.draf.length)} />
              <Ringkas judul="Total bruto (biaya)" nilai={rupiah(jumlah((s) => s.bruto))} />
              <Ringkas judul="PPh 21 (utang)" nilai={rupiah(jumlah((s) => s.pph21))} />
              <Ringkas judul="THP (kas keluar)" nilai={rupiah(totalThp)} />
            </dl>
            <details className="rounded-lg border border-slate-200 px-4 py-2.5">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">Jurnal yang akan dibuat saat disetujui</summary>
              <div className="mt-3">
                <TabelJurnal baris={d.barisJurnalDraf} namaAkun={namaAkun} />
              </div>
            </details>
            {!bolehAjukan && <p className="text-sm text-slate-500">Pengajuan dilakukan oleh HRD.</p>}
          </div>
        )}
      </Kartu>

      <Kartu rapat>
        <KepalaKartu judul="Pengajuan penggajian" keterangan={`${d.pengajuan.length} pengajuan`} />
        {d.pengajuan.length === 0 ? (
          <KeadaanKosong judul="Belum ada pengajuan pada periode ini" />
        ) : (
          <Tabel label="Pengajuan penggajian">
            <thead>
              <tr>
                <th>No.</th>
                <th className="kolom-angka">Slip</th>
                <th className="kolom-angka">Bruto (Rp)</th>
                <th className="kolom-angka">PPh 21 (Rp)</th>
                <th className="kolom-angka">THP (Rp)</th>
                <th>Status</th>
                <th>Diajukan oleh</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {d.pengajuan.map((g) => (
                <tr key={g.no}>
                  <td className="kode">{g.no}</td>
                  <td className="kolom-angka">{g.jumlahSlip}</td>
                  <td className="kolom-angka"><Rupiah nilai={g.totalBruto} polos /></td>
                  <td className="kolom-angka"><Rupiah nilai={g.totalPph} polos /></td>
                  <td className="kolom-angka font-semibold"><Rupiah nilai={g.totalThp} polos /></td>
                  <td>
                    <LencanaStatus jenis="persetujuan" status={g.status} />
                    {g.jurnalNo && <div className="kode mt-0.5 text-[11px]!">{g.jurnalNo}</div>}
                    {g.alasanTolak && <div className="mt-0.5 max-w-52 text-[11px] text-rose-700">{g.alasanTolak}</div>}
                  </td>
                  <td className="text-[12px]">
                    {g.dibuatOleh}
                    {g.disetujuiOleh && <div className="text-slate-500">diputuskan {g.disetujuiOleh}</div>}
                  </td>
                  <td>{g.status === "DIAJUKAN" && bolehPutuskan ? <AksiPengajuan no={g.no} thp={g.totalThp} /> : g.status === "DIAJUKAN" ? <div className="text-right text-xs text-slate-500">menunggu Owner</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>

      <Kartu rapat>
        <KepalaKartu judul="Pengeluaran gaji" keterangan="Satu baris per slip yang sudah dibayar" />
        {d.dibayar.length === 0 ? (
          <KeadaanKosong judul="Belum ada gaji yang dibayar pada periode ini" />
        ) : (
          <Tabel label="Slip yang sudah dibayar">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Jurnal</th>
                <th>Slip</th>
                <th>Akun biaya</th>
                <th>Keterangan</th>
                <th className="kolom-angka">Bruto (Rp)</th>
                <th className="kolom-angka">Dibayar (Rp)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.dibayar.map((s) => (
                <tr key={s.no}>
                  <td className="whitespace-nowrap">{labelTanggal(s.tanggal)}</td>
                  <td className="kode">{s.jurnalNo ?? "-"}</td>
                  <td className="kode">{s.no}</td>
                  <td>{namaAkun[s.akunBeban] ?? s.akunBeban}</td>
                  <td>Gaji {labelPeriode(periode)} a.n. {s.karyawan}</td>
                  <td className="kolom-angka"><Rupiah nilai={s.bruto} polos /></td>
                  <td className="kolom-angka"><Rupiah nilai={s.thp} polos /></td>
                  <td className="text-right"><TautanTombol href={`${denganPeriode("/sdm/hitung-gaji", periode)}&slip=${s.no}`} kecil varian="hantu">Slip</TautanTombol></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Total</td>
                <td className="kolom-angka"><Rupiah nilai={d.dibayar.reduce((x, s) => x + s.bruto, 0)} polos /></td>
                <td className="kolom-angka"><Rupiah nilai={dibayarThp} polos /></td>
                <td />
              </tr>
            </tfoot>
          </Tabel>
        )}
      </Kartu>
    </>
  );
}

function Ringkas({ judul, nilai }: { judul: string; nilai: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{judul}</dt>
      <dd className="angka font-semibold text-slate-900">{nilai}</dd>
    </div>
  );
}
