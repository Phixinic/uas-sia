/*
 * Halaman Laporan & Fee (komponen server). Owner memutuskan laporan kapten; staf lain melihat.
 * Keadaan di URL: ?lihat=FEE-2026-0001 [&slip=semua|<kode karyawan>] untuk pratinjau dan cetak slip fee.
 */
import LencanaBiaya from "@/komponen/sdm/LencanaBiaya";
import Link from "next/link";
import { ArrowLeft, Printer, TriangleAlert } from "lucide-react";
import { wajibMasuk } from "@/lib/server/auth";
import { boleh } from "@/lib/peran";
import { db } from "@/lib/server/db";
import { saldoAkun } from "@/lib/server/jurnal";
import { AKUN } from "@/lib/inti/akun";
import { barisFeeEvent } from "@/lib/inti/jurnal";
import { labelDurasi, pph21BukanPegawai } from "@/lib/inti/fee-event";
import { denganPeriode, labelTanggal } from "@/lib/inti/tanggal";
import { LABEL_PERAN_EVENT, LABEL_SATUAN_TARIF, labelWaktu, rupiah } from "@/lib/format";
import { petaAkun, profilUsaha } from "@/lib/data/umum";
import { muatBahanEvent, type BahanEvent, type OrangBahan } from "@/lib/data/fee-event/bahan";
import { ambilLaporan, daftarLaporan, slipFeeLaporan, type RingkasLaporan } from "@/lib/data/fee-event/daftar";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import TabelJurnal from "@/komponen/ui/TabelJurnal";
import Lencana, { LencanaStatus } from "@/komponen/ui/Lencana";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import { TautanTombol } from "@/komponen/ui/Tombol";
import FormKeputusan, { type BarisKeputusan } from "./FormKeputusan";
import { FormPenilaian } from "./FormPenilaian";
import { KeteranganPenilaian, LencanaPenilaian } from "./Penilaian";
import SlipFee from "./SlipFee";
import { DaftarHP, KartuHP, RincianHP, TabelLebar } from "./Ringkas";

const ALAMAT = "/fee-event/keputusan";
export type CariKeputusan = { lihat?: string; slip?: string };

/** Rumus biaya variabel per orang: "Rp20.000/jam x 6 jam 30 mnt = Rp130.000" atau "Rp200.000/hari x 2 hari = Rp400.000". */
function dasarFee(o: OrangBahan): string {
  const u = o.usulan;
  if (o.satuanTarif === "HARI") return `${rupiah(o.tarif)}/hari x ${u.jumlahHari} hari = ${rupiah(u.fee)} (${u.jumlahSesi} sesi)`;
  const selisih = u.menitTercatat - u.menitDiakui;
  return `${rupiah(o.tarif)}/jam x ${labelDurasi(u.menitDiakui)} diakui = ${rupiah(u.fee)}${selisih ? `, dipotong ${labelDurasi(selisih)}` : ""}${u.menitLembur ? `, termasuk lembur ${labelDurasi(u.menitLembur)}` : ""}`;
}

export default async function HalamanKeputusan({ cari }: { cari: CariKeputusan }) {
  const pengguna = await wajibMasuk();
  const bolehPutuskan = boleh(pengguna.peran, "fee-event.putuskan");
  if (cari.lihat) return <DetailLaporan no={cari.lihat} slip={cari.slip} bolehPutuskan={bolehPutuskan} />;

  const daftar = await daftarLaporan();
  const menunggu = daftar.filter((l) => l.status === "DIAJUKAN");
  const dibayar = daftar.filter((l) => l.status === "DISETUJUI");
  return (
    <>
      <KepalaHalaman judul="Laporan & Fee" lencana={<LencanaBiaya jenis="variabel" />} keterangan="Laporan progres yang dikirim kapten. Owner melihat penilaian kapten, menentukan fee akhir per orang, lalu menyetujui (jurnal dan pembayaran) atau menolak." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KartuRingkasan judul="Menunggu Owner" nilai={String(menunggu.length)} bukanUang nada={menunggu.length ? "kuning" : "netral"} keterangan={menunggu.length ? `Usulan ${rupiah(menunggu.reduce((s, l) => s + l.totalUsulan, 0))}` : "Tidak ada laporan"} />
        <KartuRingkasan judul="Fee dibayar" nilai={dibayar.reduce((s, l) => s + (l.totalDibayar ?? 0), 0)} nada="hijau" keterangan={`${dibayar.length} event`} />
        <KartuRingkasan judul="Ditolak" nilai={String(daftar.filter((l) => l.status === "DITOLAK").length)} bukanUang keterangan="Dikembalikan ke kapten" />
      </div>
      <Kartu rapat>
        <KepalaKartu judul="Daftar laporan kapten" keterangan={`${daftar.length} laporan`} />
        {daftar.length === 0 ? (
          <KeadaanKosong judul="Belum ada laporan" keterangan="Laporan muncul di sini setelah kapten mengirimnya." />
        ) : (
          <>
<DaftarHP label="Daftar laporan kapten">
            {daftar.map((l) => (
              <KartuHP key={l.no} judul={l.event} sub={<><span className="kode">{l.no}</span> · {l.eventKode}</>} kanan={<LencanaStatus jenis="persetujuan" status={l.status} />}>
                <RincianHP
                  isi={[
                    ["Dikirim", `${labelWaktu(l.diajukanPada)}, ${l.diajukanOleh}`],
                    ["Usulan / dibayar", <>{rupiah(l.totalUsulan)}{l.totalDibayar !== null ? ` / ${rupiah(l.totalDibayar)}` : ""}</>],
                  ]}
                />
                {l.jurnalNo && <div className="kode text-[11px]!">{l.jurnalNo}</div>}
                <TautanTombol href={`${ALAMAT}?lihat=${l.no}`} kecil varian={l.status === "DIAJUKAN" && bolehPutuskan ? "utama" : "garis"}>{l.status === "DIAJUKAN" && bolehPutuskan ? "Putuskan" : "Buka"}</TautanTombol>
              </KartuHP>
            ))}
          </DaftarHP>
<TabelLebar>
<Tabel label="Daftar laporan kapten">
            <thead>
              <tr><th>No.</th><th>Event</th><th>Dikirim</th><th className="kolom-angka">Usulan (Rp)</th><th className="kolom-angka">Dibayar (Rp)</th><th>Status</th><th className="text-right">Aksi</th></tr>
            </thead>
            <tbody>
              {daftar.map((l) => (
                <tr key={l.no}>
                  <td className="kode">{l.no}</td>
                  <td><div className="font-medium">{l.event}</div><div className="text-xs text-slate-500">{l.eventKode}{l.klien ? ` · ${l.klien}` : ""}</div></td>
                  <td className="text-[12px] whitespace-nowrap">{labelWaktu(l.diajukanPada)}<div className="text-slate-500">{l.diajukanOleh}</div></td>
                  <td className="kolom-angka"><Rupiah nilai={l.totalUsulan} polos /></td>
                  <td className="kolom-angka">{l.totalDibayar !== null ? <Rupiah nilai={l.totalDibayar} polos /> : "-"}</td>
                  <td>
                    <LencanaStatus jenis="persetujuan" status={l.status} />
                    {l.jurnalNo && <div className="kode mt-0.5 text-[11px]!">{l.jurnalNo}</div>}
                  </td>
                  <td className="text-right">
                    <TautanTombol href={`${ALAMAT}?lihat=${l.no}`} kecil varian={l.status === "DIAJUKAN" && bolehPutuskan ? "utama" : "hantu"}>{l.status === "DIAJUKAN" && bolehPutuskan ? "Putuskan" : "Buka"}</TautanTombol>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabel>
</TabelLebar>
</>
        )}
      </Kartu>
    </>
  );
}

async function DetailLaporan({ no, slip, bolehPutuskan }: { no: string; slip?: string; bolehPutuskan: boolean }) {
  const l = await ambilLaporan(no);
  if (!l) {
    return (
      <>
        <KepalaHalaman judul="Laporan tidak ditemukan" />
        <Peringatan jenis="galat">Laporan {no} tidak ditemukan.</Peringatan>
        <TautanTombol href={ALAMAT} ikon={<ArrowLeft className="size-4" />}>Kembali</TautanTombol>
      </>
    );
  }
  const dasar = `${ALAMAT}?lihat=${l.no}`;

  if (l.status === "DISETUJUI" && slip) {
    const [daftar, profil] = await Promise.all([slipFeeLaporan(l.no, slip === "semua" ? undefined : slip), profilUsaha()]);
    return (
      <>
        <KepalaHalaman judul="Slip fee event" lencana={<LencanaBiaya jenis="variabel" />} keterangan={`${l.event} · ${l.no}`} />
        {daftar.length ? <SlipFee daftar={daftar} namaUsaha={profil.nama} alamatTutup={dasar} /> : <Peringatan jenis="galat">Slip tidak ditemukan.</Peringatan>}
      </>
    );
  }

  return (
    <>
      <KepalaHalaman
        judul={`Laporan ${l.no}`}
        lencana={<LencanaStatus jenis="persetujuan" status={l.status} />}
        keterangan={`${l.event} (${l.eventKode}) · dikirim ${l.diajukanOleh}, ${labelWaktu(l.diajukanPada)}${l.diputuskanOleh ? ` · diputuskan ${l.diputuskanOleh}, ${labelWaktu(l.diputuskanPada)}` : ""}`}
        aksi={
          <>
            <TautanTombol href={ALAMAT} ikon={<ArrowLeft className="size-4" />}>Daftar laporan</TautanTombol>
            <TautanTombol href={`/fee-event/event?lihat=${l.eventKode}`}>Buka event</TautanTombol>
            {l.status === "DISETUJUI" && <TautanTombol href={`${dasar}&slip=semua`} varian="utama" ikon={<Printer className="size-4" />}>Cetak semua slip</TautanTombol>}
          </>
        }
      />
      {l.catatanKapten && <Peringatan>Catatan kapten: &ldquo;{l.catatanKapten}&rdquo;</Peringatan>}
      {l.status === "DITOLAK" && <Peringatan jenis="galat">Laporan ini ditolak: &ldquo;{l.alasanTolak}&rdquo;. Event kembali ke kapten; laporan pengganti muncul sebagai nomor baru.</Peringatan>}
      {l.status === "DISETUJUI" ? <Disetujui l={l} /> : l.status === "DIAJUKAN" ? <Menunggu l={l} bolehPutuskan={bolehPutuskan} /> : null}
    </>
  );
}

async function Menunggu({ l, bolehPutuskan }: { l: RingkasLaporan; bolehPutuskan: boolean }) {
  const [b, kas, namaAkun] = await Promise.all([muatBahanEvent(db, l.eventKode), saldoAkun(db, AKUN.KAS), petaAkun()]);
  if (!b) return <Peringatan jenis="galat">Event laporan ini tidak ditemukan.</Peringatan>;
  const kurang = b.orang.flatMap((o) => o.kehadiran.filter((k) => k.penilaian === "KURANG").map((k) => ({ o, k, s: b.sesi.find((x) => x.id === k.sesiId)! })));
  const pajak = b.orang.map((o) => pph21BukanPegawai(o.usulan.fee));
  const barisJurnal = barisFeeEvent(b.orang.map((o, i) => ({ akunBeban: o.akunBebanKode, bruto: pajak[i].bruto, pph21: pajak[i].pph21, dibayar: pajak[i].dibayar })));
  const baris: BarisKeputusan[] = b.orang.map((o) => ({
    karyawanKode: o.karyawanKode,
    nama: o.nama,
    jabatan: o.jabatan,
    peran: o.peranEvent === "KAPTEN" ? "Kapten" : "Crew",
    dasar: dasarFee(o),
    jumlahKurang: o.usulan.jumlahKurang,
    usulan: o.usulan.fee,
  }));

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KartuRingkasan judul="Orang" nilai={String(b.orang.length)} bukanUang keterangan={`${b.orang.filter((o) => o.peranEvent === "KAPTEN").length} kapten`} />
        <KartuRingkasan judul="Dinilai kurang" nilai={String(kurang.length)} bukanUang nada={kurang.length ? "merah" : "hijau"} keterangan={kurang.length ? "Lihat catatan kapten di bawah" : "Semua sesuai"} />
        <KartuRingkasan judul="Usulan sistem" nilai={b.totalUsulan} keterangan={`Dibayar ${rupiah(pajak.reduce((s, p) => s + p.dibayar, 0))} sesudah PPh 21`} />
        <KartuRingkasan judul="Saldo kas" nilai={kas} nada={kas < b.totalUsulan ? "merah" : "netral"} keterangan="Dari jurnal yang disetujui" />
      </div>

      {kurang.length > 0 && (
        <section className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4" aria-labelledby="judul-kurang">
          <h2 id="judul-kurang" className="flex items-center gap-2 font-semibold text-rose-800"><TriangleAlert className="size-4" aria-hidden /> {kurang.length} kehadiran dinilai kurang oleh kapten</h2>
          <ul className="mt-3 space-y-2">
            {kurang.map(({ o, k, s }) => (
              <li key={k.id} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                <div className="font-semibold text-slate-900">{o.nama} <span className="font-normal text-slate-500">· {s.nama}, {labelTanggal(s.tanggal)}</span></div>
                <div className="text-[13px] text-slate-700">Tercatat {labelDurasi(k.menitTercatat)} ({k.jamMasuk} sampai {k.jamPulang}), diakui <span className="font-semibold text-rose-700">{labelDurasi(k.menitDiakui ?? 0)}</span></div>
                <div className="mt-0.5 text-[13px] text-rose-800">&ldquo;{k.catatanNilai}&rdquo; <span className="text-slate-400">oleh {k.dinilaiOleh}</span></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PenilaianKapten b={b} bolehNilai={bolehPutuskan} />

      <Kartu>
        <h2 className="judul-kartu flex flex-wrap items-center gap-2">Fee per orang <LencanaBiaya jenis="variabel" /></h2>
        <p className="mt-0.5 mb-4 text-xs text-slate-500">Biaya variabel: fee crew = tarif per jam x jam diakui, fee kapten = tarif per hari x jumlah hari hadir. Besarnya ikut jumlah event dan jam kerja, bukan gaji bulanan. PPh 21 bukan pegawai: 50% x bruto x 5%.</p>
        {bolehPutuskan ? (
          // Kunci berubah bila usulan berubah (misalnya sesudah Owner menilai kehadiran kapten), supaya isian kembali ke usulan baru.
          <FormKeputusan key={baris.map((x) => x.usulan).join("-")} no={l.no} baris={baris} saldoKas={kas} />
        ) : (
          <>
            <TabelUsulan b={b} />
            <p className="mt-3 text-sm text-slate-500">Keputusan fee dilakukan oleh Owner.</p>
          </>
        )}
        <details className="mt-4 rounded-lg border border-slate-200 px-4 py-2.5">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Jurnal bila disetujui dengan fee usulan</summary>
          <div className="mt-3">
            <JurnalRingkas baris={barisJurnal} namaAkun={namaAkun} />
            <TabelLebar>
              <TabelJurnal baris={barisJurnal} namaAkun={namaAkun} />
            </TabelLebar>
          </div>
        </details>
      </Kartu>
    </>
  );
}

function TabelUsulan({ b }: { b: BahanEvent }) {
  return (
    <>
<DaftarHP label="Usulan fee">
      {b.orang.map((o) => (
        <KartuHP key={o.karyawanKode} judul={o.nama} sub={`${LABEL_PERAN_EVENT[o.peranEvent]} · ${dasarFee(o)}`} kanan={<Rupiah nilai={o.usulan.fee} className="font-semibold" />} />
      ))}
    </DaftarHP>
<TabelLebar>
<Tabel label="Usulan fee">
      <thead><tr><th>Nama</th><th>Peran</th><th>Dasar</th><th className="kolom-angka">Usulan (Rp)</th></tr></thead>
      <tbody>
        {b.orang.map((o) => (
          <tr key={o.karyawanKode}>
            <td className="font-medium">{o.nama}</td>
            <td>{LABEL_PERAN_EVENT[o.peranEvent]}</td>
            <td className="text-[13px]">{dasarFee(o)}</td>
            <td className="kolom-angka"><Rupiah nilai={o.usulan.fee} polos /></td>
          </tr>
        ))}
      </tbody>
    </Tabel>
</TabelLebar>
</>
  );
}

/** Kehadiran kapten tidak dinilai sesama kapten; Owner menilainya di sini sebelum memutuskan. */
function PenilaianKapten({ b, bolehNilai }: { b: BahanEvent; bolehNilai: boolean }) {
  const kapten = b.orang.filter((o) => o.peranEvent === "KAPTEN");
  return (
    <Kartu rapat>
      <KepalaKartu judul="Kehadiran kapten" keterangan={bolehNilai ? "Dinilai Owner. Yang belum dinilai dihitung sesuai catatan HRD." : "Dinilai Owner"} />
      <ul className="divide-y divide-slate-100">
        {kapten.flatMap((o) =>
          o.kehadiran.map((k) => {
            const s = b.sesi.find((x) => x.id === k.sesiId)!;
            return (
              <li key={k.id} className={`grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] ${k.penilaian === "KURANG" ? "bg-rose-50/50" : ""}`}>
                <div className="min-w-0 text-sm">
                  <div className="font-semibold text-slate-900">{o.nama} <span className="font-normal text-slate-500">· {s.nama}, {labelTanggal(s.tanggal)}</span></div>
                  <div className="text-[13px] text-slate-600">{k.jamMasuk} sampai {k.jamPulang} · tercatat {labelDurasi(k.menitTercatat)}</div>
                  {k.catatanProgres && <div className="text-[13px] text-slate-700">{k.catatanProgres}</div>}
                </div>
                <div>
                  {bolehNilai ? (
                    <FormPenilaian id={k.id} nama={`${o.nama} di ${s.nama}`} penilaian={k.penilaian} menitDiakui={k.menitDiakui} catatan={k.catatanNilai} batasMenit={k.menitTercatat} />
                  ) : (
                    <><LencanaPenilaian k={k} peran="KAPTEN" /><KeteranganPenilaian k={k} /></>
                  )}
                </div>
              </li>
            );
          }),
        )}
        {kapten.every((o) => !o.kehadiran.length) && <li className="px-5 py-4 text-sm text-slate-500">Kapten belum punya kehadiran di event ini.</li>}
      </ul>
    </Kartu>
  );
}

async function Disetujui({ l }: { l: RingkasLaporan }) {
  const daftar = await slipFeeLaporan(l.no);
  const dasar = `${ALAMAT}?lihat=${l.no}`;
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KartuRingkasan judul="Total fee (biaya variabel)" nilai={l.totalFee ?? 0} keterangan={`Usulan ${rupiah(l.totalUsulan)}`} />
        <KartuRingkasan judul="PPh 21 (utang)" nilai={l.totalPph ?? 0} keterangan="50% x bruto x 5%" />
        <KartuRingkasan judul="Dibayar" nilai={l.totalDibayar ?? 0} nada="hijau" keterangan={`${daftar.length} slip`} />
        <KartuRingkasan judul="Jurnal" nilai={l.jurnalNo ?? "-"} bukanUang keterangan={`Tanggal ${labelTanggal(l.tanggalSelesai)}`} />
      </div>
      <Kartu rapat>
        <KepalaKartu judul="Slip fee" keterangan="Satu slip per orang, status Dibayar" aksi={l.jurnalNo ? <Link href={denganPeriode("/pelaporan/jurnal-umum", l.tanggalSelesai.slice(0, 7))} className="text-[13px] font-semibold text-aksen hover:underline">Lihat jurnal umum</Link> : undefined} />
        <DaftarHP label="Slip fee">
          {daftar.map((s) => (
            <KartuHP key={s.no} judul={s.karyawan} sub={<><span className="kode">{s.no}</span> · {LABEL_PERAN_EVENT[s.peranEvent]}</>} kanan={<Rupiah nilai={s.dibayar} className="font-semibold" />}>
              <RincianHP
                kolom={3}
                isi={[
                  ["Dasar", `${s.satuanTarif === "HARI" ? `${s.jumlahHari} hari` : labelDurasi(s.menitDiakui)} x ${rupiah(s.tarif)}`],
                  ["Usulan / akhir", <span key="f" className={s.alasanUbah ? "text-amber-700" : ""}>{rupiah(s.feeUsulan)} / {rupiah(s.feeAkhir)}</span>],
                  ["PPh 21", rupiah(s.pph21)],
                ]}
              />
              {s.alasanUbah && <div className="text-[12px] text-amber-700">Diubah: {s.alasanUbah}</div>}
              <TautanTombol href={`${dasar}&slip=${s.karyawanKode}`} kecil>Slip</TautanTombol>
            </KartuHP>
          ))}
          <li className="flex items-center justify-between bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
            <span>Total dibayar ({daftar.length} slip)</span>
            <Rupiah nilai={l.totalDibayar ?? 0} />
          </li>
        </DaftarHP>
<TabelLebar>
<Tabel label="Slip fee">
          <thead>
            <tr><th>Slip</th><th>Nama</th><th>Tarif</th><th>Dasar</th><th className="kolom-angka">Usulan (Rp)</th><th className="kolom-angka">Fee akhir (Rp)</th><th className="kolom-angka">PPh 21 (Rp)</th><th className="kolom-angka">Dibayar (Rp)</th><th /></tr>
          </thead>
          <tbody>
            {daftar.map((s) => (
              <tr key={s.no}>
                <td className="kode">{s.no}</td>
                <td><span className="font-medium">{s.karyawan}</span> <span className="text-xs text-slate-500">{LABEL_PERAN_EVENT[s.peranEvent]}</span></td>
                <td className="whitespace-nowrap">{rupiah(s.tarif)} {LABEL_SATUAN_TARIF[s.satuanTarif]}</td>
                <td className="whitespace-nowrap">{s.satuanTarif === "HARI" ? `${s.jumlahHari} hari` : labelDurasi(s.menitDiakui)}</td>
                <td className="kolom-angka"><Rupiah nilai={s.feeUsulan} polos /></td>
                <td className="kolom-angka">
                  <Rupiah nilai={s.feeAkhir} polos className={s.alasanUbah ? "font-semibold text-amber-700" : ""} />
                  {s.alasanUbah && <div className="max-w-48 text-left text-[11px] text-amber-700">Diubah: {s.alasanUbah}</div>}
                </td>
                <td className="kolom-angka"><Rupiah nilai={s.pph21} polos /></td>
                <td className="kolom-angka font-semibold"><Rupiah nilai={s.dibayar} polos /></td>
                <td className="text-right"><TautanTombol href={`${dasar}&slip=${s.karyawanKode}`} kecil varian="hantu">Slip</TautanTombol></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Total</td>
              <td className="kolom-angka"><Rupiah nilai={daftar.reduce((x, s) => x + s.feeUsulan, 0)} polos /></td>
              <td className="kolom-angka"><Rupiah nilai={l.totalFee ?? 0} polos /></td>
              <td className="kolom-angka"><Rupiah nilai={l.totalPph ?? 0} polos /></td>
              <td className="kolom-angka"><Rupiah nilai={l.totalDibayar ?? 0} polos /></td>
              <td />
            </tr>
          </tfoot>
        </Tabel>
</TabelLebar>

      </Kartu>
      {daftar.some((s) => s.alasanUbah) && <p className="text-xs text-slate-500"><Lencana warna="kuning">Diubah</Lencana> Fee akhir berbeda dari usulan sistem, alasannya dicatat Owner.</p>}
    </>
  );
}

/** Pratinjau jurnal untuk layar sempit: satu baris per akun, debit atau kredit di kanan. */
function JurnalRingkas({ baris, namaAkun }: { baris: ReturnType<typeof barisFeeEvent>; namaAkun: Record<string, string> }) {
  const isi = baris.filter((x) => x.debit || x.kredit);
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-[13px] md:hidden" aria-label="Baris jurnal (ringkas)">
      {isi.map((x, i) => (
        <li key={i} className={`flex items-start justify-between gap-3 px-3 py-2 ${x.kredit ? "pl-6" : ""}`}>
          <span className="min-w-0 break-words"><span className="kode mr-1.5">{x.akun}</span>{namaAkun[x.akun] ?? x.akun}</span>
          <span className="shrink-0 text-right">
            <span className="block text-[11px] text-slate-500">{x.debit ? "Debit" : "Kredit"}</span>
            <Rupiah nilai={x.debit || x.kredit} polos />
          </span>
        </li>
      ))}
    </ul>
  );
}
