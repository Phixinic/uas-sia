/*
 * Halaman Penilaian Crew untuk peran Kapten (komponen server). Keadaan di URL: ?lihat=EVT-2026-0001.
 * Kapten hanya melihat event yang ia pegang sebagai Kapten, dan tidak melihat angka tarif atau fee.
 * Ia menilai kehadiran crew (Sesuai atau Kurang dengan catatan dan jam diakui), lalu mengirim laporan ke Owner.
 */
import { ArrowLeft } from "lucide-react";
import { wajibPeranHalaman } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { labelTanggal } from "@/lib/inti/tanggal";
import { labelDurasi } from "@/lib/inti/fee-event";
import { LABEL_PERAN_EVENT } from "@/lib/format";
import { eventMilikKapten, kaptenDariPengguna, kaptenDiEvent, muatBahanEvent } from "@/lib/data/fee-event/bahan";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Lencana, { LencanaStatus } from "@/komponen/ui/Lencana";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import { TautanTombol } from "@/komponen/ui/Tombol";
import { FormPenilaian, TombolKirimLaporan } from "./FormPenilaian";
import { KeteranganPenilaian, LencanaPenilaian } from "./Penilaian";
import { belumDiAtas } from "@/lib/inti/urut";

const ALAMAT = "/kapten";

export default async function HalamanKapten({ cari }: { cari: { lihat?: string } }) {
  const pengguna = await wajibPeranHalaman(["KAPTEN"]);
  const saya = await kaptenDariPengguna(db, pengguna.id);
  if (!saya) {
    return (
      <>
        <KepalaHalaman judul="Penilaian Crew" />
        <Peringatan jenis="awas">Akun kapten ini belum ditautkan ke data crew. Minta Owner menautkannya di menu Pengguna.</Peringatan>
      </>
    );
  }
  if (cari.lihat) return <DetailKapten kode={cari.lihat} saya={saya} />;

  const daftar = await eventMilikKapten(saya);
  return (
    <>
      <KepalaHalaman judul="Penilaian Crew" keterangan="Event yang kamu pegang sebagai kapten. Nilai progres setiap crew, beri catatan bila ada yang kurang, lalu kirim laporan ke Owner." />
      <Kartu rapat>
        <KepalaKartu judul="Event saya" keterangan={`${daftar.length} event`} />
        {daftar.length === 0 ? (
          <KeadaanKosong judul="Belum ada event" keterangan="HRD akan menugaskanmu sebagai kapten di sebuah event." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {belumDiAtas(daftar, (e) => e.status !== "SELESAI").map((e) => (
              <li key={e.kode} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                    {e.nama} <LencanaStatus jenis="event" status={e.status} />
                    {e.status === "PENILAIAN" && e.alasanTolak && <Lencana warna="merah">Ditolak Owner</Lencana>}
                  </div>
                  <div className="text-xs text-slate-500">{e.kode}{e.klien ? ` · ${e.klien}` : ""} · {labelTanggal(e.tanggalMulai)}{e.tanggalSelesai !== e.tanggalMulai ? ` sampai ${labelTanggal(e.tanggalSelesai)}` : ""}</div>
                </div>
                <TautanTombol href={`${ALAMAT}?lihat=${e.kode}`} kecil varian={e.status === "PENILAIAN" ? "utama" : "garis"}>{e.status === "PENILAIAN" ? "Nilai crew" : "Lihat"}</TautanTombol>
              </li>
            ))}
          </ul>
        )}
      </Kartu>
    </>
  );
}

async function DetailKapten({ kode, saya }: { kode: string; saya: string }) {
  const milik = await kaptenDiEvent(db, kode, saya);
  const b = milik ? await muatBahanEvent(db, kode) : null;
  if (!b) {
    return (
      <>
        <KepalaHalaman judul="Event tidak ditemukan" />
        <Peringatan jenis="galat">Event ini tidak ditemukan atau bukan event yang kamu pegang sebagai kapten.</Peringatan>
        <TautanTombol href={ALAMAT} ikon={<ArrowLeft className="size-4" />}>Kembali</TautanTombol>
      </>
    );
  }
  const bisaNilai = b.status === "PENILAIAN";
  const crew = b.orang.filter((o) => o.peranEvent === "CREW");
  const kurang = crew.reduce((s, o) => s + o.kehadiran.filter((k) => k.penilaian === "KURANG").length, 0);
  const totalKehadiran = b.orang.reduce((s, o) => s + o.kehadiran.length, 0);
  const siap = bisaNilai && totalKehadiran > 0 && b.crewBelumDinilai === 0;

  return (
    <>
      <KepalaHalaman
        judul={b.nama}
        lencana={<LencanaStatus jenis="event" status={b.status} />}
        keterangan={`${b.kode}${b.klien ? ` · ${b.klien}` : ""} · ${labelTanggal(b.tanggalMulai)}${b.tanggalSelesai !== b.tanggalMulai ? ` sampai ${labelTanggal(b.tanggalSelesai)}` : ""}`}
        aksi={
          <>
            <TautanTombol href={ALAMAT} ikon={<ArrowLeft className="size-4" />}>Event saya</TautanTombol>
            {bisaNilai && <TombolKirimLaporan eventKode={b.kode} jumlahKurang={kurang} siap={siap} />}
          </>
        }
      />
      {bisaNilai && b.alasanTolak && <Peringatan jenis="galat">Owner menolak laporan sebelumnya: &ldquo;{b.alasanTolak}&rdquo;. Periksa lagi penilaianmu lalu kirim ulang.</Peringatan>}
      {bisaNilai && !siap && <Peringatan>{totalKehadiran === 0 ? "HRD belum mencatat kehadiran di event ini." : `Masih ada ${b.crewBelumDinilai} kehadiran crew yang belum dinilai. Laporan bisa dikirim setelah semuanya dinilai.`}</Peringatan>}
      {b.status === "DIAJUKAN" && <Peringatan>Laporanmu sudah dikirim dan menunggu keputusan Owner. Penilaian terkunci.</Peringatan>}
      {b.status === "SELESAI" && <Peringatan jenis="sukses">Owner sudah menyetujui laporan event ini.</Peringatan>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KartuRingkasan judul="Crew" nilai={String(crew.length)} bukanUang keterangan={`${b.orang.length - crew.length} kapten`} />
        <KartuRingkasan judul="Belum dinilai" nilai={String(b.crewBelumDinilai)} bukanUang nada={b.crewBelumDinilai ? "kuning" : "hijau"} keterangan="Kehadiran crew" />
        <KartuRingkasan judul="Dinilai kurang" nilai={String(kurang)} bukanUang nada={kurang ? "merah" : "netral"} keterangan="Catatannya dikirim ke Owner" />
        <KartuRingkasan judul="Sesi" nilai={String(b.sesi.length)} bukanUang keterangan={b.sesi.map((s) => s.nama).join(", ") || "-"} />
      </div>

      {b.sesi.map((s) => {
        // Kehadiran crew yang belum dinilai tampil di atas.
        const baris = belumDiAtas(b.orang.flatMap((o) => o.kehadiran.filter((k) => k.sesiId === s.id).map((k) => ({ o, k }))), ({ o, k }) => o.peranEvent === "CREW" && !k.penilaian);
        return (
          <Kartu rapat key={s.id}>
            <KepalaKartu judul={s.nama} keterangan={`${labelTanggal(s.tanggal)}, jadwal ${s.jamMulai} sampai ${s.jamSelesai}`} />
            {baris.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">Belum ada kehadiran di sesi ini.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {baris.map(({ o, k }) => {
                  const dinilaiSaya = bisaNilai && o.peranEvent === "CREW" && o.karyawanKode !== saya;
                  return (
                    <li key={k.id} data-kehadiran={k.id} className={`grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] ${k.penilaian === "KURANG" ? "bg-rose-50/50" : ""}`}>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                          {o.nama}
                          <span className="text-xs font-normal text-slate-500">{LABEL_PERAN_EVENT[o.peranEvent]}{o.karyawanKode === saya ? " (kamu)" : ""}</span>
                        </div>
                        <div className="text-[13px] text-slate-600">
                          {k.jamMasuk} sampai {k.jamPulang} · tercatat <span className="font-semibold">{labelDurasi(k.menitTercatat)}</span>
                        </div>
                        <div className="text-[13px] text-slate-700">{k.catatanProgres || <span className="text-slate-400">Tanpa catatan progres</span>}</div>
                      </div>
                      <div className="min-w-0">
                        {dinilaiSaya ? (
                          <FormPenilaian id={k.id} nama={o.nama} penilaian={k.penilaian} menitDiakui={k.menitDiakui} catatan={k.catatanNilai} batasMenit={k.menitTercatat} />
                        ) : (
                          <div>
                            <LencanaPenilaian k={k} peran={o.peranEvent} />
                            <KeteranganPenilaian k={k} />
                            {o.peranEvent === "KAPTEN" && !k.penilaian && <p className="mt-1 text-[12px] text-slate-500">Kehadiran kapten dinilai Owner.</p>}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Kartu>
        );
      })}
      {b.sesi.length === 0 && <KeadaanKosong judul="Belum ada sesi" keterangan="HRD belum mencatat sesi event ini." />}
    </>
  );
}
