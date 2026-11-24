/*
 * Riwayat persetujuan jurnal penyesuaian dari siklus konversi (penyusutan dan nilai sisa) untuk ditampilkan di
 * halamannya sendiri: status, pembuat, pengaju, pemutus, waktu, dan alasan tolak. Hanya baca.
 * Pengaju diambil dari log aktivitas "jurnal.ajukan" (kolom jurnal hanya menyimpan waktunya).
 */
import { db } from "@/lib/server/db";
import type { StatusPersetujuan } from "@/generated/prisma/enums";

export type JurnalPersetujuan = {
  no: string;
  periode: string;
  status: StatusPersetujuan;
  /** Jumlah debit = jumlah kredit. */
  total: number;
  alasanTolak: string | null;
  dibuatOlehId: number;
  dibuatOleh: string;
  dibuatPada: string;
  diajukanOleh: string | null;
  diajukanPada: string | null;
  /** Owner yang menyetujui atau menolak (penyusutan: Admin yang memproses, karena langsung disetujui). */
  diputuskanOleh: string | null;
  diputuskanOlehId: number | null;
  diputuskanPada: string | null;
};

/** Semua jurnal satu sumber (PENYUSUTAN atau OPNAME), terbaru dulu, termasuk yang ditolak. */
export async function riwayatJurnalSumber(sumber: "PENYUSUTAN" | "OPNAME"): Promise<JurnalPersetujuan[]> {
  const daftar = await db.jurnal.findMany({
    where: { sumberTipe: sumber },
    orderBy: [{ periodeId: "desc" }, { no: "desc" }],
    select: {
      no: true, periodeId: true, status: true, alasanTolak: true, dibuatOlehId: true, dibuatPada: true, diajukanPada: true, disetujuiPada: true, disetujuiOlehId: true,
      dibuatOleh: { select: { nama: true } },
      disetujuiOleh: { select: { nama: true } },
      detail: { select: { debit: true } },
    },
  });
  const log = daftar.length
    ? await db.logAktivitas.findMany({
        where: { aksi: "jurnal.ajukan", entitas: "jurnal", entitasId: { in: daftar.map((j) => j.no) } },
        orderBy: { waktu: "asc" },
        select: { entitasId: true, pengguna: { select: { nama: true } } },
      })
    : [];
  // Log terakhir per jurnal menang (urut waktu naik).
  const pengaju = new Map(log.map((l) => [l.entitasId, l.pengguna?.nama ?? null]));
  return daftar.map((j) => ({
    no: j.no,
    periode: j.periodeId,
    status: j.status,
    total: j.detail.reduce((s, d) => s + d.debit, 0),
    alasanTolak: j.alasanTolak,
    dibuatOlehId: j.dibuatOlehId,
    dibuatOleh: j.dibuatOleh.nama,
    dibuatPada: j.dibuatPada.toISOString(),
    diajukanOleh: j.diajukanPada ? (pengaju.get(j.no) ?? null) : null,
    diajukanPada: j.diajukanPada?.toISOString() ?? null,
    diputuskanOleh: j.status === "DISETUJUI" || j.status === "DITOLAK" ? (j.disetujuiOleh?.nama ?? null) : null,
    diputuskanOlehId: j.status === "DISETUJUI" || j.status === "DITOLAK" ? j.disetujuiOlehId : null,
    diputuskanPada: j.status === "DISETUJUI" || j.status === "DITOLAK" ? (j.disetujuiPada?.toISOString() ?? null) : null,
  }));
}

/**
 * Jurnal yang mewakili satu periode: yang masih menunggu (draf atau diajukan) bila ada, selain itu jurnal terbaru.
 * Satu periode bisa punya lebih dari satu jurnal penyusutan (misalnya aset baru diproses sesudah jurnal pertama
 * disetujui), jadi penolakan terbaru tidak boleh tertutup oleh persetujuan yang lebih lama.
 * Daftar sudah urut nomor terbaru dulu.
 */
export function jurnalPeriode(riwayat: JurnalPersetujuan[], periode: string): JurnalPersetujuan | null {
  const milik = riwayat.filter((j) => j.periode === periode);
  return milik.find((j) => j.status === "DRAFT" || j.status === "DIAJUKAN") ?? milik[0] ?? null;
}
