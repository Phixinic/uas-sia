import type { ReactNode } from "react";
import type { StatusAset, StatusEvent, StatusPembelian, StatusPeriode, StatusPersetujuan } from "@/generated/prisma/enums";
import { LABEL_STATUS_ASET, LABEL_STATUS_EVENT, LABEL_STATUS_PEMBELIAN, LABEL_STATUS_PERIODE, LABEL_STATUS_PERSETUJUAN, LABEL_STATUS_REVISI, LABEL_STATUS_SLIP } from "@/lib/format";

export type WarnaLencana = "hijau" | "kuning" | "merah" | "biru" | "abu" | "teal";

export default function Lencana({ warna = "abu", children }: { warna?: WarnaLencana; children: ReactNode }) {
  return <span className={`lencana lencana-${warna}`}>{children}</span>;
}

const WARNA_STATUS: Record<string, WarnaLencana> = {
  DRAFT: "kuning",
  DIAJUKAN: "biru",
  DISETUJUI: "hijau",
  DITOLAK: "merah",
  DIBALIK: "abu",
  AKTIF: "hijau",
  DILEPAS: "abu",
  BATAL: "merah",
  TERBUKA: "teal",
  TERKUNCI: "abu",
  PENILAIAN: "kuning",
  SELESAI: "hijau",
};

type JenisStatus =
  | { jenis: "persetujuan"; status: StatusPersetujuan }
  | { jenis: "pembelian"; status: StatusPembelian }
  | { jenis: "slip"; status: StatusPersetujuan }
  | { jenis: "revisi"; status: StatusPersetujuan }
  | { jenis: "aset"; status: StatusAset }
  | { jenis: "periode"; status: StatusPeriode }
  | { jenis: "event"; status: StatusEvent };

/**
 * Lencana status dokumen dengan warna dan label yang konsisten di semua halaman.
 * Contoh: <LencanaStatus jenis="pembelian" status={b.status} />  (DISETUJUI tampil "Diposting")
 *         <LencanaStatus jenis="slip" status={s.status} />        (DISETUJUI tampil "Dibayar")
 *         <LencanaStatus jenis="revisi" status={r.status} />      (DITOLAK tampil "Dikembalikan", untuk nilai sisa)
 */
export function LencanaStatus(p: JenisStatus) {
  const label =
    p.jenis === "pembelian" ? LABEL_STATUS_PEMBELIAN[p.status]
    : p.jenis === "slip" ? LABEL_STATUS_SLIP[p.status]
    : p.jenis === "revisi" ? LABEL_STATUS_REVISI[p.status]
    : p.jenis === "aset" ? LABEL_STATUS_ASET[p.status]
    : p.jenis === "periode" ? LABEL_STATUS_PERIODE[p.status]
    : p.jenis === "event" ? LABEL_STATUS_EVENT[p.status]
    : LABEL_STATUS_PERSETUJUAN[p.status];
  return <Lencana warna={WARNA_STATUS[p.status] ?? "abu"}>{label}</Lencana>;
}
