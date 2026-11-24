/*
 * Penanda status di halaman Gaji Bulanan: titik berwarna dan teks biasa, bukan lencana berbentuk pil, supaya tidak terlihat
 * seperti tombol. Yang bisa ditindaklanjuti (belum ada presensi) berupa tautan bergaris bawah.
 * Kosakata mengikuti alur: Belum ada presensi, Belum diajukan (angkanya estimasi), Dikembalikan Owner, Menunggu Owner, Dibayar.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import type { StatusPersetujuan } from "@/generated/prisma/enums";
import { denganPeriode } from "@/lib/inti/tanggal";

type Warna = "abu" | "kuning" | "biru" | "hijau" | "merah";
const TITIK: Record<Warna, string> = { abu: "bg-slate-400", kuning: "bg-amber-500", biru: "bg-blue-500", hijau: "bg-emerald-500", merah: "bg-rose-500" };

export function TandaStatus({ warna, href, children }: { warna: Warna; href?: string; children: ReactNode }) {
  const isi = (
    <>
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${TITIK[warna]}`} />
      {children}
    </>
  );
  const kelas = "inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-700";
  return href ? (
    <Link href={href} className={`${kelas} underline underline-offset-2 hover:text-slate-900`}>{isi}</Link>
  ) : (
    <span className={kelas}>{isi}</span>
  );
}

/** Tautan ke presensi satu bulan (dan satu karyawan bila diberi). */
export const alamatPresensi = (periode: string, karyawanKode?: string) =>
  `${denganPeriode("/sdm/presensi", periode)}${karyawanKode ? `&tab=harian&karyawan=${karyawanKode}` : ""}`;

/** Status gaji satu karyawan di satu bulan (Gaji Bulanan). */
export function StatusSlipKaryawan({ slipStatus, jumlahPresensi, periode, karyawanKode, dikembalikan }: { slipStatus: StatusPersetujuan | null; jumlahPresensi: number; periode: string; karyawanKode: string; dikembalikan?: boolean }) {
  if (slipStatus === "DISETUJUI") return <TandaStatus warna="hijau">Dibayar</TandaStatus>;
  if (slipStatus === "DIAJUKAN") return <TandaStatus warna="biru">Menunggu Owner</TandaStatus>;
  if (!jumlahPresensi) return <TandaStatus warna="kuning" href={alamatPresensi(periode, karyawanKode)}>Belum ada presensi</TandaStatus>;
  if (dikembalikan) return <TandaStatus warna="merah">Dikembalikan Owner</TandaStatus>;
  return <TandaStatus warna="abu">Belum diajukan</TandaStatus>;
}
