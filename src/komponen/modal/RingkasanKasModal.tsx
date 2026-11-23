/*
 * Bagian "Dari mana kas dan modal" di halaman Investasi Kas (komponen server).
 * Angka dari ringkasModal (src/lib/inti/modal.ts); saldo akhirnya dibandingkan dengan saldo buku besar.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import Lencana from "@/komponen/ui/Lencana";
import Rupiah from "@/komponen/ui/Rupiah";
import { denganPeriode, labelPeriode, labelTanggal } from "@/lib/inti/tanggal";
import { AKUN } from "@/lib/inti/akun";
import { rupiah } from "@/lib/format";
import type { RincianSumber, RingkasanModal } from "@/lib/inti/modal";
import type { CocokBukuBesar } from "@/lib/data/modal/investasi-kas";

function Rincian({ isi }: { isi: RincianSumber[] }) {
  if (!isi.length) return null;
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-[12px] text-slate-500">Rincian {isi.length} jurnal</summary>
      <ul className="mt-1.5 space-y-1.5 border-l-2 border-slate-100 pl-3 text-[12px]">
        {isi.map((r) => (
          <li key={r.jurnalNo} className="flex items-start justify-between gap-3">
            <span className="min-w-0 break-words text-slate-600">
              <span className="kode mr-1">{r.jurnalNo}</span>
              {r.sumberId && r.sumberId !== r.jurnalNo && <span className="kode mr-1">{r.sumberId}</span>}
              {labelTanggal(r.tanggal)}, {r.keterangan}
            </span>
            <Rupiah nilai={r.jumlah} warnaNegatif className="shrink-0" />
          </li>
        ))}
      </ul>
    </details>
  );
}

function Baris({ label, nilai, rincian, tebal, tanda, catatan }: { label: ReactNode; nilai: number; rincian?: RincianSumber[]; tebal?: boolean; tanda?: "+" | "-"; catatan?: ReactNode }) {
  return (
    <li className={`py-2 ${tebal ? "border-t border-slate-200 font-semibold text-slate-900" : "text-slate-700"}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 break-words">{label}</span>
        <span className="shrink-0 text-right">
          {tanda && <span className="mr-1 text-slate-400">{tanda}</span>}
          <Rupiah nilai={nilai} warnaNegatif />
        </span>
      </div>
      {catatan && <div className="text-[12px] text-slate-500">{catatan}</div>}
      {rincian && <Rincian isi={rincian} />}
    </li>
  );
}

function Subjudul({ children }: { children: ReactNode }) {
  return <li className="pt-3 pb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{children}</li>;
}

function Cocok({ ok, saldo, akun, periode }: { ok: boolean; saldo: number; akun: string; periode: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
      {ok ? <Lencana warna="hijau">sama dengan buku besar</Lencana> : <Lencana warna="merah">beda dengan buku besar</Lencana>}
      <span>
        Saldo {akun} di <Link className="font-medium underline" href={denganPeriode(`/pelaporan/buku-besar?akun=${akun}`, periode)}>Buku Besar</Link>: <Rupiah nilai={saldo} />
      </span>
    </div>
  );
}

export default function RingkasanKasModal({ r, bb, periodeBuku }: { r: RingkasanModal; bb: CocokBukuBesar; periodeBuku: string }) {
  const perPeriode = r.periode !== null;
  const ket = perPeriode ? labelPeriode(r.periode) : "kumulatif";
  const { modal: m, kas: k, biayaSdm: b } = r;
  return (
    <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
      <section aria-label="Modal Pemilik">
        <h3 className="text-sm font-semibold text-slate-900">Modal Pemilik <span className="kode">{AKUN.MODAL}</span></h3>
        <p className="teks-redup">Semua modal berasal dari setoran pemilik, berupa kas atau barang.</p>
        <ul className="mt-2 text-sm">
          {perPeriode && <Baris label={`Modal awal ${ket}`} nilai={m.awal} />}
          <Baris label="Setoran kas (Investasi Kas)" nilai={m.setoranKas.jumlah} rincian={m.setoranKas.rincian} tanda={perPeriode ? "+" : undefined} />
          <Baris label="Setoran barang (pembelian cara bayar Investasi)" nilai={m.setoranBarang.jumlah} rincian={m.setoranBarang.rincian} tanda={perPeriode ? "+" : undefined} catatan="Peralatan atau perlengkapan yang disetor pemilik. Pembalikannya mengurangi angka ini." />
          {m.lainnya.jumlah !== 0 && <Baris label="Jurnal lain ke Modal Pemilik" nilai={m.lainnya.jumlah} rincian={m.lainnya.rincian} tanda={perPeriode ? "+" : undefined} />}
          <Baris label={perPeriode ? `Modal Pemilik akhir ${ket}` : "Total Modal Pemilik"} nilai={m.akhir} tebal />
        </ul>
        <Cocok ok={bb.modalCocok} saldo={bb.modal} akun={AKUN.MODAL} periode={periodeBuku} />
      </section>

      <section aria-label="Arus kas">
        <h3 className="text-sm font-semibold text-slate-900">Arus Kas <span className="kode">{AKUN.KAS}</span></h3>
        <p className="teks-redup">Kas masuk hanya dari setoran pemilik dan hasil penjualan aset, karena aplikasi ini tidak mencakup siklus pendapatan.</p>
        <ul className="mt-2 text-sm">
          {perPeriode && <Baris label={`Saldo kas awal ${ket}`} nilai={k.awal} />}
          <Subjudul>Kas masuk</Subjudul>
          <Baris label="Investasi Kas (setoran pemilik)" nilai={k.masuk.investasi.jumlah} rincian={k.masuk.investasi.rincian} tanda="+" />
          <Baris label="Hasil penjualan aset (pelepasan)" nilai={k.masuk.penjualanAset.jumlah} rincian={k.masuk.penjualanAset.rincian} tanda="+" />
          {k.masuk.lainnya.jumlah !== 0 && <Baris label="Kas masuk lain" nilai={k.masuk.lainnya.jumlah} rincian={k.masuk.lainnya.rincian} tanda="+" />}
          <Subjudul>Kas keluar, siklus konversi</Subjudul>
          <Baris label="Pembelian tunai (peralatan dan perlengkapan)" nilai={k.keluar.pembelianTunai.jumlah} rincian={k.keluar.pembelianTunai.rincian} tanda="-" catatan="Pembalikan pembelian tunai mengembalikan kas. Pelunasan utang usaha belum ada di aplikasi." />
          <Subjudul>Kas keluar, siklus SDM</Subjudul>
          <Baris label="Gaji inhouse (biaya tetap)" nilai={k.keluar.gaji.jumlah} rincian={k.keluar.gaji.rincian} tanda="-" catatan="Take home pay yang ditransfer, sesudah PPh 21 dipotong." />
          <Baris label="Fee event (biaya variabel)" nilai={k.keluar.fee.jumlah} rincian={k.keluar.fee.rincian} tanda="-" catatan="Fee yang dibayar ke crew, sesudah PPh 21 dipotong." />
          {k.keluar.lainnya.jumlah !== 0 && <Baris label="Kas keluar lain" nilai={k.keluar.lainnya.jumlah} rincian={k.keluar.lainnya.rincian} tanda="-" />}
          <Baris label={perPeriode ? `Saldo kas akhir ${ket}` : "Saldo kas akhir"} nilai={k.akhir} tebal />
        </ul>
        <Cocok ok={bb.kasCocok} saldo={bb.kas} akun={AKUN.KAS} periode={periodeBuku} />
      </section>

      <section aria-label="Biaya SDM" className="lg:col-span-2">
        <h3 className="text-sm font-semibold text-slate-900">Biaya SDM {perPeriode ? ket : "(kumulatif)"}</h3>
        <p className="teks-redup">
          Gaji inhouse adalah biaya tetap: komponennya diatur sekali di Setting Gaji, tiap bulan hanya potongan absen yang berubah.
          Fee crew event adalah biaya variabel: tarif x jam diakui (crew) atau tarif x hari hadir (kapten), per event.
        </p>
        <div className="mt-2 grid grid-cols-1 gap-x-6 lg:grid-cols-2">
          <ul className="text-sm">
            <Baris label="Biaya tetap: gaji inhouse (bruto)" nilai={b.tetap.bruto.jumlah} rincian={b.tetap.bruto.rincian} />
            <Baris label="Biaya variabel: fee crew event (bruto)" nilai={b.variabel.bruto.jumlah} rincian={b.variabel.bruto.rincian} />
            <Baris label="Total biaya SDM" nilai={b.bruto} tebal />
          </ul>
          <ul className="text-sm">
            <Baris label="PPh 21 dipotong (menjadi Utang PPh 21)" nilai={b.pph21} tanda="-" catatan={`Gaji ${rupiah(b.tetap.pph21)}, fee ${rupiah(b.variabel.pph21)}`} />
            <Baris label="Kas keluar siklus SDM" nilai={b.dibayar} tebal />
          </ul>
        </div>
        <div className="mt-2 text-[12px] text-slate-500">
          {b.dibayar === k.keluar.sdm ? <Lencana warna="hijau">sama dengan kas keluar SDM</Lencana> : <Lencana warna="merah">beda dengan kas keluar SDM</Lencana>}{" "}
          Gaji dibayar {rupiah(b.tetap.dibayar)} + fee dibayar {rupiah(b.variabel.dibayar)} = {rupiah(k.keluar.sdm)}.
        </div>
      </section>
    </div>
  );
}
