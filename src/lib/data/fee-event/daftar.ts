/*
 * Kueri baca halaman fee event (Event & Kehadiran, Laporan & Fee). Hanya untuk komponen server.
 * Hasil berupa objek biasa (tanggal sudah jadi string) supaya aman dikirim ke komponen klien.
 */
import { db } from "@/lib/server/db";
import { dariDate } from "@/lib/inti/tanggal";
import type { PeranEvent, SatuanTarif, StatusEvent, StatusPersetujuan } from "@/generated/prisma/enums";

export type RingkasEvent = {
  kode: string;
  nama: string;
  klien: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  status: StatusEvent;
  alasanTolak: string | null;
  jumlahSesi: number;
  jumlahOrang: number;
  kapten: string[];
  jumlahKehadiran: number;
  belumDinilai: number;
};

export async function daftarEvent(): Promise<RingkasEvent[]> {
  const d = await db.event.findMany({
    orderBy: [{ tanggalMulai: "desc" }, { kode: "desc" }],
    include: {
      sesi: { select: { kehadiran: { select: { penilaian: true, karyawanKode: true } } } },
      penugasan: { select: { karyawanKode: true, karyawan: { select: { nama: true } }, jabatan: { select: { peranEvent: true } } } },
    },
  });
  return d.map((e) => {
    const peran = new Map(e.penugasan.map((p) => [p.karyawanKode, p.jabatan.peranEvent]));
    const kehadiran = e.sesi.flatMap((s) => s.kehadiran);
    return {
      kode: e.kode,
      nama: e.nama,
      klien: e.klien,
      tanggalMulai: dariDate(e.tanggalMulai),
      tanggalSelesai: dariDate(e.tanggalSelesai),
      status: e.status,
      alasanTolak: e.alasanTolak,
      jumlahSesi: e.sesi.length,
      jumlahOrang: e.penugasan.length,
      kapten: e.penugasan.filter((p) => p.jabatan.peranEvent === "KAPTEN").map((p) => p.karyawan.nama),
      jumlahKehadiran: kehadiran.length,
      belumDinilai: kehadiran.filter((k) => !k.penilaian && peran.get(k.karyawanKode) === "CREW").length,
    };
  });
}

export type OpsiCrew = { kode: string; nama: string; aktif: boolean };
export type OpsiJabatanEvent = { kode: string; nama: string; peranEvent: PeranEvent; satuanTarif: SatuanTarif; tarif: number; aktif: boolean };

/** Karyawan berjenis EVENT dan jabatan berkelompok EVENT untuk form penugasan. */
export async function opsiPenugasan(): Promise<{ crew: OpsiCrew[]; jabatan: OpsiJabatanEvent[] }> {
  const [crew, jabatan] = await Promise.all([
    db.karyawan.findMany({ where: { jenis: "EVENT" }, orderBy: { kode: "asc" }, select: { kode: true, nama: true, aktif: true } }),
    db.jabatan.findMany({ where: { kelompok: "EVENT" }, orderBy: { kode: "asc" } }),
  ]);
  return {
    crew,
    jabatan: jabatan
      .filter((j) => j.peranEvent && j.satuanTarif)
      .map((j) => ({ kode: j.kode, nama: j.nama, peranEvent: j.peranEvent!, satuanTarif: j.satuanTarif!, tarif: j.tarif, aktif: j.aktif })),
  };
}

export type RingkasLaporan = {
  no: string;
  eventKode: string;
  event: string;
  klien: string;
  tanggalSelesai: string;
  status: StatusPersetujuan;
  catatanKapten: string;
  totalUsulan: number;
  totalFee: number | null;
  totalPph: number | null;
  totalDibayar: number | null;
  alasanTolak: string | null;
  jurnalNo: string | null;
  diajukanOleh: string;
  diajukanPada: string;
  diputuskanOleh: string | null;
  diputuskanPada: string | null;
};

const sertaiLaporan = { event: { select: { nama: true, klien: true, tanggalSelesai: true } }, diajukanOleh: { select: { nama: true } }, diputuskanOleh: { select: { nama: true } } } as const;
type LaporanDb = Awaited<ReturnType<typeof db.laporanFee.findMany<{ include: typeof sertaiLaporan }>>>[number];

const ringkasLaporan = (l: LaporanDb): RingkasLaporan => ({
  no: l.no,
  eventKode: l.eventKode,
  event: l.event.nama,
  klien: l.event.klien,
  tanggalSelesai: dariDate(l.event.tanggalSelesai),
  status: l.status,
  catatanKapten: l.catatanKapten,
  totalUsulan: l.totalUsulan,
  totalFee: l.totalFee,
  totalPph: l.totalPph,
  totalDibayar: l.totalDibayar,
  alasanTolak: l.alasanTolak,
  jurnalNo: l.jurnalNo,
  diajukanOleh: l.diajukanOleh.nama,
  diajukanPada: l.diajukanPada.toISOString(),
  diputuskanOleh: l.diputuskanOleh?.nama ?? null,
  diputuskanPada: l.diputuskanPada?.toISOString() ?? null,
});

/** Semua laporan, yang menunggu keputusan di atas. */
export async function daftarLaporan(): Promise<RingkasLaporan[]> {
  const d = await db.laporanFee.findMany({ orderBy: [{ diajukanPada: "desc" }, { no: "desc" }], include: sertaiLaporan });
  return d.map(ringkasLaporan).sort((a, b) => Number(b.status === "DIAJUKAN") - Number(a.status === "DIAJUKAN"));
}

export async function ambilLaporan(no: string): Promise<RingkasLaporan | null> {
  const l = await db.laporanFee.findUnique({ where: { no }, include: sertaiLaporan });
  return l ? ringkasLaporan(l) : null;
}

/** Riwayat laporan satu event (termasuk yang ditolak), terbaru dulu. */
export async function riwayatLaporanEvent(eventKode: string): Promise<RingkasLaporan[]> {
  const d = await db.laporanFee.findMany({ where: { eventKode }, orderBy: [{ diajukanPada: "desc" }, { no: "desc" }], include: sertaiLaporan });
  return d.map(ringkasLaporan);
}

export type DataSlipFee = {
  no: string;
  laporanNo: string;
  jurnalNo: string | null;
  eventKode: string;
  event: string;
  klien: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  karyawanKode: string;
  karyawan: string;
  bank: string;
  noRek: string;
  jabatan: string;
  peranEvent: PeranEvent;
  satuanTarif: SatuanTarif;
  tarif: number;
  jumlahSesi: number;
  menitTercatat: number;
  menitDiakui: number;
  jumlahHari: number;
  feeUsulan: number;
  feeAkhir: number;
  alasanUbah: string | null;
  dpp: number;
  pph21: number;
  dibayar: number;
  dibayarPada: string | null;
};

/** Slip fee satu laporan yang disetujui (opsional satu orang saja). */
export async function slipFeeLaporan(laporanNo: string, karyawanKode?: string): Promise<DataSlipFee[]> {
  const d = await db.slipFee.findMany({
    where: { laporanNo, ...(karyawanKode ? { karyawanKode } : {}) },
    orderBy: [{ peranEvent: "asc" }, { karyawanKode: "asc" }],
    include: { karyawan: true, jabatan: { select: { nama: true } }, event: true, laporan: { select: { jurnalNo: true, diputuskanPada: true } } },
  });
  return d.map((s) => ({
    no: s.no,
    laporanNo: s.laporanNo,
    jurnalNo: s.laporan.jurnalNo,
    eventKode: s.eventKode,
    event: s.event.nama,
    klien: s.event.klien,
    tanggalMulai: dariDate(s.event.tanggalMulai),
    tanggalSelesai: dariDate(s.event.tanggalSelesai),
    karyawanKode: s.karyawanKode,
    karyawan: s.karyawan.nama,
    bank: s.karyawan.bank,
    noRek: s.karyawan.noRek,
    jabatan: s.jabatan.nama,
    peranEvent: s.peranEvent,
    satuanTarif: s.satuanTarif,
    tarif: s.tarif,
    jumlahSesi: s.jumlahSesi,
    menitTercatat: s.menitTercatat,
    menitDiakui: s.menitDiakui,
    jumlahHari: s.jumlahHari,
    feeUsulan: s.feeUsulan,
    feeAkhir: s.feeAkhir,
    alasanUbah: s.alasanUbah,
    dpp: s.dpp,
    pph21: s.pph21,
    dibayar: s.dibayar,
    dibayarPada: s.laporan.diputuskanPada?.toISOString() ?? null,
  }));
}
