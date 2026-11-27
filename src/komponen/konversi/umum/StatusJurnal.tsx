/*
 * Status jurnal penyesuaian di halaman Proses Penyusutan dan Nilai Sisa Perlengkapan (komponen server).
 * Penyusutan langsung disetujui saat diproses, jadi tidak punya tombol keputusan. Tombol jurnal nilai sisa memakai
 * AksiJurnal, komponen dan server action yang sama dengan halaman Jurnal Penyesuaian, jadi aturan peran dan larangan
 * menyetujui jurnal sendiri tetap satu tempat.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { boleh, type Peran } from "@/lib/peran";
import { labelWaktu, rupiah } from "@/lib/format";
import { denganPeriode, labelPeriode } from "@/lib/inti/tanggal";
import type { JurnalPersetujuan } from "@/lib/data/konversi/persetujuan";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import { LencanaStatus } from "@/komponen/ui/Lencana";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import Rupiah from "@/komponen/ui/Rupiah";
import AksiJurnal from "@/komponen/pelaporan/AksiJurnal";
import { belumDiAtas, belumDiputuskan } from "@/lib/inti/urut";

type Sumber = "penyusutan" | "opname";

const ARTI: Record<JurnalPersetujuan["status"], (s: Sumber) => string> = {
  DRAFT: () => "Draf. Belum masuk buku besar sampai diajukan Admin lalu disetujui Owner.",
  DIAJUKAN: () => "Diajukan, menunggu keputusan Owner. Belum masuk buku besar.",
  DISETUJUI: (s) =>
    s === "penyusutan"
      ? "Sudah masuk buku besar dan neraca saldo setelah penyesuaian. Penyusutan dihitung dari jadwal aset, jadi langsung berlaku tanpa persetujuan."
      : "Disetujui. Sudah masuk buku besar dan neraca saldo setelah penyesuaian.",
  DITOLAK: (s) =>
    s === "penyusutan"
      ? "Ditolak (riwayat dari sebelum penyusutan diproses otomatis). Jadwalnya dibuka lagi saat itu dan diproses ulang."
      : "Dikembalikan Owner untuk revisi. Form nilai sisa terbuka lagi berisi nilai yang diajukan; Admin mengubahnya lalu mengajukan ulang.",
};

/** Siapa yang ditunggu, untuk peran yang tidak punya tombol pada status ini. */
function menunggu(j: JurnalPersetujuan, peran: Peran): string | null {
  if (j.status === "DRAFT" && !boleh(peran, "jurnal-penyesuaian.ajukan")) return "Menunggu Admin mengajukan ke Owner.";
  if (j.status === "DIAJUKAN" && !boleh(peran, "jurnal-penyesuaian.putuskan")) return "Menunggu keputusan Owner.";
  return null;
}

/** Jejak satu jurnal: dibuat, diajukan, diputuskan. */
export function JejakJurnal({ j, sumber }: { j: JurnalPersetujuan; sumber?: Sumber }) {
  if (sumber === "penyusutan" && j.status === "DISETUJUI" && j.dibuatOlehId === j.diputuskanOlehId) {
    return <p className="text-xs whitespace-nowrap text-slate-500">Diproses {j.dibuatOleh}, {labelWaktu(j.dibuatPada)}</p>;
  }
  const baris: ReactNode[] = [`Dibuat ${j.dibuatOleh}, ${labelWaktu(j.dibuatPada)}`];
  if (j.diajukanPada) baris.push(`Diajukan ${j.diajukanOleh ? `${j.diajukanOleh}, ` : ""}${labelWaktu(j.diajukanPada)}`);
  if (j.diputuskanPada) baris.push(`${j.status === "DITOLAK" ? (sumber === "opname" ? "Dikembalikan" : "Ditolak") : "Disetujui"} ${j.diputuskanOleh ?? ""}, ${labelWaktu(j.diputuskanPada)}`);
  return (
    <ul className="space-y-0.5 text-xs text-slate-500">
      {baris.map((b, i) => <li key={i} className="whitespace-nowrap">{b}</li>)}
    </ul>
  );
}

function Tombol({ j, penggunaId, peran, sumber }: { j: JurnalPersetujuan; penggunaId: number; peran: Peran; sumber: Sumber }) {
  if (sumber === "penyusutan") return null;
  const tunggu = menunggu(j, peran);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <AksiJurnal no={j.no} status={j.status} dibuatOlehId={j.dibuatOlehId} penggunaId={penggunaId} peran={peran} sumber={sumber === "opname" ? "OPNAME" : "PENYUSUTAN"} />
      {tunggu && <span className="text-xs text-slate-500">{tunggu}</span>}
    </div>
  );
}

/** Kartu status jurnal untuk periode yang sedang dibuka. */
export function PanelStatusJurnal({ j, sumber, penggunaId, peran, judul }: { j: JurnalPersetujuan; sumber: Sumber; penggunaId: number; peran: Peran; judul: string }) {
  return (
    <Kartu label={judul}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="judul-kartu flex flex-wrap items-center gap-2">
            {judul} <span className="kode">{j.no}</span> <LencanaStatus jenis={sumber === "opname" ? "revisi" : "persetujuan"} status={j.status} />
          </h2>
          <p className="text-[13px] text-slate-700">{ARTI[j.status](sumber)} Total {rupiah(j.total)}.</p>
          <JejakJurnal j={j} sumber={sumber} />
        </div>
        <Tombol j={j} penggunaId={penggunaId} peran={peran} sumber={sumber} />
      </div>
      {j.status === "DITOLAK" && j.alasanTolak && (
        <div className="mt-3">
          <Peringatan jenis="galat"><b>{sumber === "opname" ? "Alasan dikembalikan:" : "Alasan ditolak:"}</b> {j.alasanTolak}</Peringatan>
        </div>
      )}
    </Kartu>
  );
}

/** Tabel riwayat jurnal satu sumber, dengan status, jejak, alasan tolak, dan tombol keputusan per baris. */
export function TabelRiwayatJurnal({ riwayat, sumber, alamat, penggunaId, peran, judul, kolomTambahan, tombolDiAtas, dikembalikan }: {
  riwayat: JurnalPersetujuan[];
  sumber: Sumber;
  /** Alamat halaman untuk tautan periode. */
  alamat: string;
  penggunaId: number;
  peran: Peran;
  judul: string;
  kolomTambahan?: { judul: string; isi: (j: JurnalPersetujuan) => ReactNode };
  /** Nomor jurnal yang tombolnya sudah tampil di panel status di atas (tidak diulang di tabel). */
  tombolDiAtas?: string | null;
  /** Nomor jurnal yang dikembalikan Owner dan belum diajukan ulang; ikut ditampilkan di atas. */
  dikembalikan?: ReadonlySet<string>;
}) {
  return (
    <Kartu rapat label={judul}>
      <KepalaKartu
        judul={judul}
        keterangan={
          sumber === "penyusutan"
            ? `${riwayat.length} jurnal. Jurnal penyusutan langsung disetujui saat diproses dan masuk buku besar.`
            : `${riwayat.length} jurnal. Hanya yang berstatus Disetujui masuk buku besar. Keputusan Owner juga bisa dari menu Jurnal Penyesuaian.`
        }
      />
      {riwayat.length === 0 ? (
        <KeadaanKosong judul={sumber === "penyusutan" ? "Belum ada jurnal penyusutan" : "Belum ada jurnal biaya perlengkapan"} />
      ) : (
        <Tabel label={judul}>
          <thead>
            <tr>
              <th>Jurnal</th>
              {kolomTambahan && <th className="kolom-angka">{kolomTambahan.judul}</th>}
              <th className="kolom-angka">Total (Rp)</th>
              <th>Status</th>
              <th>Jejak</th>
              {sumber !== "penyusutan" && <th className="text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {/* Data datang terbaru dulu (dipakai jurnalPeriode); tabel menampilkan yang belum diputuskan di atas, lalu dari yang paling lama. */}
            {belumDiAtas([...riwayat].reverse(), (j) => belumDiputuskan(j.status) || !!dikembalikan?.has(j.no)).map((j) => (
              <tr key={j.no}>
                <td>
                  <div className="kode">{j.no}</div>
                  <Link className="text-xs whitespace-nowrap hover:underline" href={denganPeriode(alamat, j.periode)}>{labelPeriode(j.periode)}</Link>
                  {j.pembalikDariNo && <div className="text-[11px] text-slate-500">Pembalik {j.pembalikDariNo}</div>}
                </td>
                {kolomTambahan && <td className="kolom-angka">{kolomTambahan.isi(j)}</td>}
                <td className="kolom-angka"><Rupiah nilai={j.total} polos /></td>
                <td>
                  <LencanaStatus jenis={sumber === "opname" ? "revisi" : "persetujuan"} status={j.status} />
                  {j.alasanTolak && j.status === "DITOLAK" && <div className="mt-0.5 max-w-56 text-[11px] text-rose-600">Alasan: {j.alasanTolak}</div>}
                </td>
                <td><JejakJurnal j={j} sumber={sumber} /></td>
                {sumber !== "penyusutan" && (
                  <td>{j.no === tombolDiAtas && (j.status === "DRAFT" || j.status === "DIAJUKAN") ? <span className="block text-right text-xs text-slate-500">Lihat panel di atas</span> : <Tombol j={j} penggunaId={penggunaId} peran={peran} sumber={sumber} />}</td>
                )}
              </tr>
            ))}
          </tbody>
        </Tabel>
      )}
    </Kartu>
  );
}
