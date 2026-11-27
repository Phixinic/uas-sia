/*
 * Halaman Gaji Bulanan (komponen server): Hitung Gaji dan Distribusi digabung. Keadaan di URL:
 * ?bulan=12&tahun=2026, &ubah=KRY-01 (editor potongan dan bonus, HRD), &slip=KRY-01|semua (slip siap cetak).
 * Satu baris per karyawan inhouse: setting berlaku, presensi, gaji tetap, upah event, potongan, bonus, PPh 21, THP.
 * HRD mengisi potongan dan bonus (pratinjau langsung), lalu mengajukan satu paket bulan itu; Owner menyetujui atau menolak.
 * Angka yang belum diajukan adalah estimasi dan ditandai begitu.
 */
import Link from "next/link";
import { Printer } from "lucide-react";
import { wajibMasuk } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { saldoAkun } from "@/lib/server/jurnal";
import { boleh } from "@/lib/peran";
import { AKUN } from "@/lib/inti/akun";
import { periodeTerkunciSemua, profilUsaha } from "@/lib/data/umum";
import { opsiPeriodeSdm, periodeDipilih, type CariPeriode } from "@/lib/data/sdm/umum";
import { barisHitungGaji, kesiapanGaji, muatUpahEvent, paketGajiPeriode, type BarisGaji } from "@/lib/data/sdm/gaji";

import { denganPeriode, kunciPenutup, labelPeriode } from "@/lib/inti/tanggal";
import { labelWaktu, rupiah } from "@/lib/format";
import { pesanKasKurang } from "@/lib/inti/modal";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import LencanaPeriode from "@/komponen/ui/LencanaPeriode";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import { TautanTombol } from "@/komponen/ui/Tombol";
import { DaftarHP, KartuHP, RincianHP, TabelLebar } from "@/komponen/fee-event/Ringkas";
import LencanaBiaya from "./LencanaBiaya";
import PilihPeriode from "./PilihPeriode";
import RingkasanTahunGaji from "./RingkasanTahunGaji";
import SlipGaji from "./SlipGaji";
import EditorPenyesuaian from "./EditorPenyesuaian";
import { AksiPaketOwner, TombolAjukanGaji } from "./AksiGajiBulanan";
import { alamatPresensi, StatusSlipKaryawan, TandaStatus } from "./StatusGaji";

const ALAMAT = "/sdm/gaji-bulanan";

export type CariGajiBulanan = CariPeriode & { slip?: string; ubah?: string };

/** Teks pendek presensi satu baris. */
function ringkasPresensi(b: BarisGaji) {
  const s = b.tampil;
  return `${s.hadir} hadir${s.izin + s.sakit + s.cuti ? `, ${s.izin + s.sakit + s.cuti} izin/sakit/cuti` : ""}${s.alpa ? `, ${s.alpa} alpa` : ""}`;
}

function Estimasi({ b }: { b: BarisGaji }) {
  return b.slipStatus === "DIAJUKAN" || b.slipStatus === "DISETUJUI" ? null : <span className="block text-[11px] font-normal text-slate-500">estimasi</span>;
}

export default async function HalamanGajiBulanan({ cari }: { cari: CariGajiBulanan }) {
  const pengguna = await wajibMasuk();
  const periode = periodeDipilih(cari);
  const bolehUbah = boleh(pengguna.peran, "gaji.hitung");
  const bolehAjukan = boleh(pengguna.peran, "penggajian.ajukan");
  const bolehPutuskan = boleh(pengguna.peran, "penggajian.putuskan");

  const [opsiPeriode, baris, paket, terkunci, profil, upahSemua] = await Promise.all([
    opsiPeriodeSdm(periode),
    barisHitungGaji(periode),
    paketGajiPeriode(periode),
    periodeTerkunciSemua(),
    profilUsaha(),
    muatUpahEvent(db, periode),
  ]);
  const kesiapan = await kesiapanGaji(periode, baris);
  const alamatPeriode = denganPeriode(ALAMAT, periode);
  const penutup = kunciPenutup(periode, terkunci);
  const menunggu = paket.find((p) => p.status === "DIAJUKAN") ?? null;
  const ditolak = !menunggu && paket[0]?.status === "DITOLAK" ? paket[0] : null;
  // paket[0] = paket terbaru; nomor yang sudah dibayar ditulis dari yang paling lama.
  const dibayar = paket.filter((p) => p.status === "DISETUJUI").reverse();
  const kas = menunggu && bolehPutuskan ? await saldoAkun(db, AKUN.KAS) : null;

  const tanpaSetting = kesiapan.filter((k) => !k.adaSetting);
  const upahTanpaGaji = [...upahSemua.keys()].filter((k) => !baris.some((b) => b.karyawanKode === k));
  const terbuka = baris.filter((b) => !b.slipStatus || b.slipStatus === "DRAFT");
  const siap = terbuka.filter((b) => b.jumlahPresensi > 0);
  const tanpaPresensi = terbuka.filter((b) => !b.jumlahPresensi);
  const nominalKurang = siap.filter((b) => b.nominalKurang.length);
  const thpSiap = siap.reduce((s, b) => s + b.tampil.thp, 0);
  const jumlah = (f: (b: BarisGaji) => number) => baris.reduce((s, b) => s + f(b), 0);
  const editor = bolehUbah && !penutup && cari.ubah ? baris.find((b) => b.karyawanKode === cari.ubah && (!b.slipStatus || b.slipStatus === "DRAFT")) ?? null : null;
  // Slip terkunci (diajukan atau dibayar) memakai angka tersimpan; yang belum diajukan memakai hitungan terbaru (pratinjau).
  const daftarSlip = cari.slip ? baris.filter((b) => cari.slip === "semua" || b.karyawanKode === cari.slip).map((b) => b.tampil) : [];

  return (
    <>
      <KepalaHalaman
        judul="Gaji Bulanan"
        lencana={<><LencanaPeriode periode={periode} /><LencanaBiaya jenis="tetap" /></>}
        keterangan="Satu halaman untuk gaji karyawan inhouse: komponen tetap dari Setting Gaji, presensi, upah event, potongan, dan bonus. HRD mengisi potongan dan bonus lalu mengajukan gaji satu bulan ke Owner. Owner menyetujui (gaji dibayar dan dijurnal) atau menolak."
        aksi={<PilihPeriode terpilih={periode} opsi={opsiPeriode} />}
      />

      {daftarSlip.length > 0 && <SlipGaji daftar={daftarSlip} namaUsaha={profil.nama} alamatTutup={alamatPeriode} />}

      <div className="tanpa-cetak grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KartuRingkasan judul="Karyawan digaji" nilai={String(baris.length)} bukanUang keterangan={`${siap.length} siap diajukan, ${tanpaPresensi.length} belum ada presensi`} nada={tanpaPresensi.length ? "kuning" : "netral"} />
        <KartuRingkasan judul="Total bruto" nilai={jumlah((b) => b.tampil.bruto)} keterangan={`Upah event ${rupiah(jumlah((b) => b.tampil.totalUpahEvent))}, bonus ${rupiah(jumlah((b) => b.tampil.totalBonus))}`} />
        <KartuRingkasan judul="Total THP" nilai={jumlah((b) => b.tampil.thp)} nada={dibayar.length && !terbuka.length ? "hijau" : "netral"} keterangan={terbuka.length ? "Sebagian masih estimasi (belum diajukan)" : "Sesuai slip yang diajukan atau dibayar"} />
      </div>

      <Kartu label="Status gaji bulan ini" className="tanpa-cetak">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="judul-kartu">Status gaji {labelPeriode(periode)}</h2>
            {menunggu ? (
              <p className="text-sm text-slate-700"><TandaStatus warna="biru">Menunggu keputusan Owner</TandaStatus> <span className="kode">{menunggu.no}</span>, {menunggu.jumlahSlip} karyawan, THP {rupiah(menunggu.totalThp)}. Diajukan {menunggu.dibuatOleh}, {labelWaktu(menunggu.dibuatPada)}.</p>
            ) : terbuka.length === 0 && dibayar.length ? (
              <p className="text-sm text-slate-700"><TandaStatus warna="hijau">Sudah dibayar</TandaStatus> {dibayar.map((p) => `${p.no} (jurnal ${p.jurnalNo ?? "-"}, disetujui ${p.diputuskanOleh ?? "-"})`).join(", ")}.</p>
            ) : (
              <p className="text-sm text-slate-700"><TandaStatus warna="abu">Belum diajukan</TandaStatus> Angka di tabel masih estimasi sampai gaji bulan ini diajukan.{dibayar.length ? ` Sebagian sudah dibayar lewat ${dibayar.map((p) => p.no).join(", ")}.` : ""}</p>
            )}
            {ditolak && <Peringatan jenis="galat"><b>Ditolak Owner ({ditolak.no}):</b> {ditolak.alasanTolak}. Perbaiki lalu ajukan ulang.</Peringatan>}
            {menunggu && kas !== null && kas < menunggu.totalThp && <Peringatan jenis="galat">{pesanKasKurang(kas, menunggu.totalThp, "gaji")} <Link className="font-medium underline" href="/modal/investasi-kas?form=baru">Catat setoran di Investasi Kas</Link>.</Peringatan>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {menunggu && bolehPutuskan && <AksiPaketOwner no={menunggu.no} thp={menunggu.totalThp} />}
            {menunggu && !bolehPutuskan && <span className="text-xs text-slate-500">Keputusan ada di Owner.</span>}
            {!menunggu && bolehAjukan && siap.length > 0 && (
              <TombolAjukanGaji periode={periode} jumlah={siap.length} thp={thpSiap} tidakIkut={tanpaPresensi.map((b) => b.nama)} disabled={!!penutup || nominalKurang.length > 0} />
            )}
            {baris.some((b) => b.slipNo) && <TautanTombol href={`${alamatPeriode}&slip=semua`} kecil ikon={<Printer className="size-4" />}>Slip semua</TautanTombol>}
          </div>
        </div>
      </Kartu>

      <div className="tanpa-cetak space-y-3">
        {penutup && <Peringatan jenis="awas">Periode {labelPeriode(periode)} tertutup{penutup !== periode ? ` karena ${labelPeriode(penutup)} sudah dikunci` : ""}. Gaji bulan ini tidak bisa diubah atau diajukan.</Peringatan>}
        {tanpaPresensi.length > 0 && (
          <Peringatan jenis="awas">
            Belum ada presensi {labelPeriode(periode)}: {tanpaPresensi.map((b, i) => <span key={b.karyawanKode}>{i ? ", " : ""}<Link className="underline" href={alamatPresensi(periode, b.karyawanKode)}>{b.nama}</Link></span>)}. Karyawan ini tidak ikut diajukan sampai presensinya diisi.
          </Peringatan>
        )}
        {tanpaSetting.length > 0 && (
          <Peringatan>
            Belum punya setting gaji yang berlaku di {labelPeriode(periode)}: {tanpaSetting.map((k) => `${k.nama}${k.catatanSetting ? ` (${k.catatanSetting.toLowerCase()})` : ""}`).join(", ")}. <Link className="underline" href="/sdm/setting-gaji">Buka Setting Gaji</Link>.
          </Peringatan>
        )}
        {nominalKurang.length > 0 && <Peringatan jenis="galat">Nominal belum disetujui Owner: {nominalKurang.map((b) => `${b.nama} (${b.nominalKurang.join(", ")})`).join("; ")}. Gaji belum bisa diajukan.</Peringatan>}
        {upahTanpaGaji.length > 0 && <Peringatan jenis="awas">Ada upah event untuk karyawan tanpa setting gaji berlaku di bulan ini ({upahTanpaGaji.join(", ")}). Upahnya baru terbayar sesudah setting gajinya berlaku.</Peringatan>}
      </div>

      {editor && (
        <EditorPenyesuaian
          key={editor.karyawanKode}
          periode={periode}
          karyawanKode={editor.karyawanKode}
          nama={editor.nama}
          input={{ ...editor.input, bonus: [], potongan: [] }}
          bonus={editor.tampil.bonus}
          potongan={editor.tampil.potongan}
          alamatTutup={alamatPeriode}
        />
      )}

      <Kartu rapat className="tanpa-cetak" label="Gaji per karyawan">
        <KepalaKartu judul={`Gaji per karyawan · ${labelPeriode(periode)}`} keterangan="Angka yang belum diajukan ditandai estimasi. Slip yang sudah diajukan atau dibayar terkunci." />
        {baris.length === 0 ? (
          <KeadaanKosong judul={`Belum ada karyawan dengan setting gaji berlaku di ${labelPeriode(periode)}`} keterangan="Setting gaji karyawan diajukan HRD di menu Setting Gaji, lalu disetujui Owner." />
        ) : (
          <>
            <DaftarHP label="Gaji per karyawan">
              {baris.map((b) => {
                const t = b.tampil;
                return (
                  <KartuHP key={b.karyawanKode} judul={`${b.nama}`} sub={<><span className="kode">{b.karyawanKode}</span> · {b.versi.kode ?? "setting lama"} · {b.versi.jabatan}, {b.versi.golongan}</>} kanan={<StatusSlipKaryawan slipStatus={b.slipStatus} jumlahPresensi={b.jumlahPresensi} periode={periode} karyawanKode={b.karyawanKode} dikembalikan={!!b.alasanTolak} />}>
                    <RincianHP
                      kolom={2}
                      isi={[
                        ["Presensi", b.jumlahPresensi ? ringkasPresensi(b) : "belum ada"],
                        ["Gaji tetap", rupiah(t.gajiTetap)],
                        ["Upah event", t.upahEvent.length ? t.upahEvent.map((u) => `${u.eventKode} ${rupiah(u.fee)}`).join(", ") : "-"],
                        ["Potongan / bonus", `${t.totalPotongan ? `−${rupiah(t.totalPotongan)}` : "-"} / ${t.totalBonus ? rupiah(t.totalBonus) : "-"}`],
                        ["PPh 21", rupiah(t.pph21)],
                        ["THP", <>{rupiah(t.thp)}<Estimasi b={b} /></>],
                      ]}
                    />
                    <div className="flex flex-wrap gap-2">
                      {bolehUbah && !penutup && (!b.slipStatus || b.slipStatus === "DRAFT") && <TautanTombol href={`${alamatPeriode}&ubah=${b.karyawanKode}`} kecil>Potongan dan bonus</TautanTombol>}
                      <TautanTombol href={`${alamatPeriode}&slip=${b.karyawanKode}`} kecil varian="hantu">{b.slipStatus === "DIAJUKAN" || b.slipStatus === "DISETUJUI" ? "Slip" : "Pratinjau slip"}</TautanTombol>
                    </div>
                  </KartuHP>
                );
              })}
            </DaftarHP>
            <TabelLebar>
              <Tabel label="Gaji per karyawan">
                <thead>
                  <tr>
                    <th>Karyawan, setting berlaku, presensi</th>
                    <th className="kolom-angka">Gaji tetap (Rp)</th>
                    <th>Upah event</th>
                    <th>Potongan dan bonus</th>
                    <th className="kolom-angka">PPh 21 (Rp)</th>
                    <th className="kolom-angka">THP (Rp) dan status</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {baris.map((b) => {
                    const t = b.tampil;
                    const bisaUbah = bolehUbah && !penutup && (!b.slipStatus || b.slipStatus === "DRAFT");
                    return (
                      <tr key={b.karyawanKode} className={cari.ubah === b.karyawanKode ? "bg-aksen-lembut/60" : undefined}>
                        <td className="min-w-48">
                          <div className="font-medium">{b.nama}</div>
                          <div className="text-xs text-slate-500"><span className="kode">{b.karyawanKode}</span> · <span className="kode">{b.versi.kode ?? "setting lama"}</span></div>
                          <div className="text-xs text-slate-500">{b.versi.jabatan}, {b.versi.golongan}</div>
                          <div className="mt-0.5 text-xs text-slate-700">{b.jumlahPresensi ? `Presensi: ${ringkasPresensi(b)}` : <StatusSlipKaryawan slipStatus={null} jumlahPresensi={0} periode={periode} karyawanKode={b.karyawanKode} />}</div>
                        </td>
                        <td className="kolom-angka">
                          <Rupiah nilai={t.gajiTetap} polos />
                          {t.potonganAbsen > 0 && <div className="text-[11px] text-slate-500">potongan absen {rupiah(t.potonganAbsen)}</div>}
                        </td>
                        <td className="text-[13px]">
                          {t.upahEvent.length ? t.upahEvent.map((u) => <div key={u.slipFeeNo} title={u.event}><span className="angka">{rupiah(u.fee)}</span><div className="text-[11px] text-slate-500">{u.eventKode}</div></div>) : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="text-[13px]">
                          {t.potongan.map((x) => <div key={`p${x.id}`} title={x.keterangan}><span className="angka text-rose-700">−{rupiah(x.nominal)}</span><div className="max-w-36 truncate text-[11px] text-slate-500">{x.keterangan}</div></div>)}
                          {t.bonus.map((x) => <div key={`b${x.id}`} title={x.keterangan}><span className="angka text-emerald-700">+{rupiah(x.nominal)}</span><div className="max-w-36 truncate text-[11px] text-slate-500">{x.keterangan}</div></div>)}
                          {!t.potongan.length && !t.bonus.length && <span className="text-slate-400">-</span>}
                        </td>
                        <td className="kolom-angka"><Rupiah nilai={t.pph21} polos /></td>
                        <td className="kolom-angka">
                          <span className="font-semibold"><Rupiah nilai={t.thp} polos /></span>
                          <Estimasi b={b} />
                          <div className="mt-1"><StatusSlipKaryawan slipStatus={b.slipStatus} jumlahPresensi={b.jumlahPresensi} periode={periode} karyawanKode={b.karyawanKode} dikembalikan={!!b.alasanTolak} /></div>
                        </td>
                        <td>
                          <div className="flex flex-col items-end gap-1.5">
                            {bisaUbah && <TautanTombol href={`${alamatPeriode}&ubah=${b.karyawanKode}`} kecil>Potongan/bonus</TautanTombol>}
                            <TautanTombol href={`${alamatPeriode}&slip=${b.karyawanKode}`} kecil varian="hantu">Slip</TautanTombol>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total {baris.length} karyawan</td>
                    <td className="kolom-angka"><Rupiah nilai={jumlah((b) => b.tampil.gajiTetap)} polos /></td>
                    <td className="angka">{rupiah(jumlah((b) => b.tampil.totalUpahEvent))}</td>
                    <td className="angka text-xs">−{rupiah(jumlah((b) => b.tampil.totalPotongan))} / +{rupiah(jumlah((b) => b.tampil.totalBonus))}</td>
                    <td className="kolom-angka"><Rupiah nilai={jumlah((b) => b.tampil.pph21)} polos /></td>
                    <td className="kolom-angka"><Rupiah nilai={jumlah((b) => b.tampil.thp)} polos /></td>
                    <td />
                  </tr>
                </tfoot>
              </Tabel>
            </TabelLebar>
          </>
        )}
      </Kartu>

      <div className="tanpa-cetak"><RingkasanTahunGaji periode={periode} alamat={ALAMAT} /></div>
    </>
  );
}

