import type { Metadata } from "next";
import Link from "next/link";
import { wajibMasuk } from "@/lib/server/auth";
import { petaAkun } from "@/lib/data/umum";
import { daftarJurnalPenyesuaian } from "@/lib/data/pelaporan/jurnal";
import { labelTanggal } from "@/lib/inti/tanggal";
import { labelWaktu, rupiah } from "@/lib/format";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import { TautanTombol } from "@/komponen/ui/Tombol";
import Kartu from "@/komponen/ui/Kartu";
import { LencanaStatus } from "@/komponen/ui/Lencana";
import TabelJurnal from "@/komponen/ui/TabelJurnal";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import AksiJurnal from "@/komponen/pelaporan/AksiJurnal";
import { LABEL_PERAN } from "@/lib/peran";
import type { StatusPersetujuan } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Jurnal Penyesuaian" };

const TAB: { nilai: StatusPersetujuan | "semua"; label: string }[] = [
  { nilai: "DRAFT", label: "Draf" },
  { nilai: "DIAJUKAN", label: "Diajukan" },
  { nilai: "DISETUJUI", label: "Disetujui" },
  { nilai: "DITOLAK", label: "Ditolak" },
  { nilai: "semua", label: "Semua" },
];

export default async function Halaman({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const pengguna = await wajibMasuk();
  const { status: s } = await searchParams;
  const aktif = TAB.find((t) => t.nilai === s)?.nilai ?? "semua";
  const [{ daftar, hitung }, namaAkun] = await Promise.all([daftarJurnalPenyesuaian(aktif === "semua" ? null : aktif), petaAkun()]);

  return (
    <>
      <KepalaHalaman
        judul="Jurnal Penyesuaian"
        keterangan={`Admin mengajukan, Owner menyetujui atau menolak dengan alasan. Hanya jurnal yang disetujui masuk buku besar dan neraca saldo setelah penyesuaian. Kamu masuk sebagai ${LABEL_PERAN[pengguna.peran]}.`}
        aksi={<TautanTombol href="/pelaporan/neraca-saldo?tahap=setelah">Lihat setelah penyesuaian</TautanTombol>}
      />

      <nav className="flex flex-wrap gap-2" aria-label="Filter status">
        {TAB.map((t) => (
          <Link
            key={t.nilai}
            href={t.nilai === "semua" ? "/pelaporan/jurnal-penyesuaian" : `/pelaporan/jurnal-penyesuaian?status=${t.nilai}`}
            aria-current={aktif === t.nilai ? "page" : undefined}
            className={`tombol tombol-kecil ${aktif === t.nilai ? "tombol-gelap" : "tombol-garis"}`}
          >
            {t.label} ({hitung[t.nilai]})
          </Link>
        ))}
      </nav>

      {hitung.DIAJUKAN > 0 && pengguna.peran === "OWNER" && aktif !== "DIAJUKAN" && (
        <Peringatan jenis="awas">{hitung.DIAJUKAN} jurnal penyesuaian menunggu keputusan kamu.</Peringatan>
      )}

      {daftar.length === 0 ? (
        <Kartu>
          <KeadaanKosong judul="Tidak ada jurnal penyesuaian dengan status ini" keterangan="Jurnal dibuat dari menu Proses Penyusutan dan Nilai Sisa Perlengkapan." />
        </Kartu>
      ) : (
        <div className="space-y-4">
          {daftar.map((j) => {
            const total = j.baris.reduce((x, b) => x + b.debit, 0);
            return (
              <Kartu key={j.no} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <b className="kode text-sm!">{j.no}</b>
                    <span className="text-xs text-slate-500">{labelTanggal(j.tanggal)}</span>
                    <LencanaStatus jenis="persetujuan" status={j.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AksiJurnal no={j.no} status={j.status} dibuatOlehId={j.dibuatOlehId} penggunaId={pengguna.id} peran={pengguna.peran} />
                  </div>
                </div>
                <p className="text-sm text-slate-800">{j.keterangan}</p>
                <TabelJurnal baris={j.baris} namaAkun={namaAkun} />
                {j.rincian.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-[13px] font-semibold text-aksen">Rincian ({j.rincian.length})</summary>
                    <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {j.rincian.map((r, i) => (
                        <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-1.5">
                          <span>{r.label} <span className="text-xs text-slate-500">{r.info}</span></span>
                          <span className="angka">{rupiah(r.nilai)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {j.status === "DITOLAK" && j.alasanTolak && (
                  <Peringatan jenis="galat">
                    <b>Alasan ditolak:</b> {j.alasanTolak}. Sumbernya sudah dibuka lagi, jadi Admin bisa memproses ulang.
                  </Peringatan>
                )}
                <p className="text-xs text-slate-500">
                  Total {rupiah(total)} · dibuat {j.dibuatOleh}
                  {j.diajukanPada && j.status !== "DISETUJUI" && ` · diajukan ${labelWaktu(j.diajukanPada)}`}
                  {j.disetujuiOleh && ` · ${j.status === "DITOLAK" ? "ditolak" : "disetujui"} ${j.disetujuiOleh} ${labelWaktu(j.disetujuiPada)}`}
                </p>
              </Kartu>
            );
          })}
        </div>
      )}
    </>
  );
}
