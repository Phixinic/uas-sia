/*
 * Dashboard untuk peran Kapten: hanya pekerjaan penilaian di event yang ia pegang, tanpa angka keuangan.
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/server/db";
import { labelTanggal } from "@/lib/inti/tanggal";
import { eventMilikKapten, kaptenDariPengguna, muatBahanEvent } from "@/lib/data/fee-event/bahan";
import type { PenggunaSesi } from "@/lib/server/auth";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Lencana from "@/komponen/ui/Lencana";
import Peringatan from "@/komponen/ui/Peringatan";

type Tugas = { kode: string; judul: string; uraian: string; mendesak: boolean };

export default async function DashboardKapten({ pengguna }: { pengguna: PenggunaSesi }) {
  const saya = await kaptenDariPengguna(db, pengguna.id);
  const daftar = saya ? await eventMilikKapten(saya) : [];
  const penilaian = daftar.filter((e) => e.status === "PENILAIAN");
  const bahan = await Promise.all(penilaian.map((e) => muatBahanEvent(db, e.kode)));
  const tugas: Tugas[] = [];
  for (const b of bahan) {
    if (!b) continue;
    const kehadiran = b.orang.reduce((s, o) => s + o.kehadiran.length, 0);
    const tanggal = `${labelTanggal(b.tanggalMulai)}${b.tanggalSelesai !== b.tanggalMulai ? ` sampai ${labelTanggal(b.tanggalSelesai)}` : ""}`;
    if (b.alasanTolak) tugas.push({ kode: b.kode, judul: `Laporan ${b.nama} ditolak Owner`, uraian: `"${b.alasanTolak}". Nilai ulang lalu kirim lagi.`, mendesak: true });
    else if (b.crewBelumDinilai) tugas.push({ kode: b.kode, judul: `Nilai progres crew ${b.nama}`, uraian: `${b.crewBelumDinilai} kehadiran crew belum dinilai · ${tanggal}`, mendesak: true });
    else if (kehadiran) tugas.push({ kode: b.kode, judul: `Kirim laporan ${b.nama} ke Owner`, uraian: `Semua crew sudah dinilai · ${tanggal}`, mendesak: true });
    else tugas.push({ kode: b.kode, judul: `${b.nama} menunggu kehadiran dari HRD`, uraian: `Belum ada kehadiran yang dicatat · ${tanggal}`, mendesak: false });
  }
  const menungguOwner = daftar.filter((e) => e.status === "DIAJUKAN").length;

  return (
    <>
      <KepalaHalaman judul="Dashboard" keterangan={`Selamat datang, ${pengguna.nama} (Kapten). Nilai progres crew di event yang kamu pegang, lalu kirim laporannya ke Owner.`} />
      {!saya && <Peringatan jenis="awas">Akun kapten ini belum ditautkan ke data crew. Minta Owner menautkannya di menu Pengguna.</Peringatan>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KartuRingkasan judul="Perlu dinilai atau dikirim" nilai={String(tugas.filter((t) => t.mendesak).length)} bukanUang nada={tugas.some((t) => t.mendesak) ? "kuning" : "netral"} keterangan="Event dalam tahap penilaian" />
        <KartuRingkasan judul="Menunggu Owner" nilai={String(menungguOwner)} bukanUang keterangan="Laporan sudah dikirim" />
        <KartuRingkasan judul="Event saya" nilai={String(daftar.length)} bukanUang keterangan="Sebagai kapten" />
      </div>
      <Kartu rapat>
        <KepalaKartu judul="Perlu tindakan" keterangan={tugas.length ? `${tugas.length} event` : undefined} />
        {tugas.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Tidak ada event yang menunggu penilaianmu.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tugas.map((t) => (
              <li key={t.kode} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                    {t.judul}
                    {t.mendesak && <Lencana warna="teal">untuk kamu</Lencana>}
                  </div>
                  <div className="text-xs text-slate-500">{t.uraian}</div>
                </div>
                <Link href={`/kapten?lihat=${t.kode}`} className="tombol tombol-garis tombol-kecil shrink-0">
                  Buka <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Kartu>
    </>
  );
}
