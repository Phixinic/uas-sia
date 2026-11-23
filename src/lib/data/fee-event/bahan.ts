/*
 * Bahan bersama fee event untuk halaman dan server action (supaya angka di layar sama dengan yang disimpan):
 * - muatBahanEvent: event, sesi, penugasan, kehadiran, dan usulan fee per orang (rumus di src/lib/inti/fee-event.ts).
 * - kaptenDariPengguna / pastikanKaptenEvent: kepemilikan kapten (kapten hanya boleh menyentuh event yang ia pegang).
 * Tarif tiap jabatan event = versi tarif yang berlaku di bulan tanggal selesai event (riwayat nominal, versi_nominal),
 * sama dengan bulan jurnal fee-nya. Satu event selalu memakai satu tarif per jabatan, walau sesinya melewati pergantian bulan.
 * Hanya untuk server.
 */
import { db, type DbAtauTx, type Tx } from "@/lib/server/db";
import { GalatAksi } from "@/lib/server/aksi";
import { dariDate, periodeDari } from "@/lib/inti/tanggal";
import { muatPetaNominal } from "@/lib/server/nominal";
import { hitungFeeOrang, menitTercatat, type HasilFeeOrang, type KodePenilaian, type KodePeranEvent, type KodeSatuan } from "@/lib/inti/fee-event";
import type { StatusEvent } from "@/generated/prisma/enums";

export type SesiBahan = { id: number; nama: string; tanggal: string; jamMulai: string; jamSelesai: string };

export type KehadiranBahan = {
  id: number;
  sesiId: number;
  karyawanKode: string;
  jamMasuk: string;
  jamPulang: string;
  catatanProgres: string;
  penilaian: KodePenilaian | null;
  menitDiakui: number | null;
  catatanNilai: string | null;
  dinilaiOleh: string | null;
  dinilaiPada: string | null;
  /** Menit tercatat yang sudah dipotong ke jadwal sesi (batas atas jam diakui). */
  menitTercatat: number;
};

export type OrangBahan = {
  penugasanId: number;
  karyawanKode: string;
  nama: string;
  bank: string;
  noRek: string;
  jabatanKode: string;
  jabatan: string;
  peranEvent: KodePeranEvent;
  satuanTarif: KodeSatuan;
  tarif: number;
  /** Versi tarif yang dipakai (berlaku di bulan tanggal selesai event). null = jabatan belum punya tarif disetujui di bulan itu. */
  versiTarif: { kode: string; berlakuMulai: string } | null;
  akunBebanKode: string;
  kehadiran: KehadiranBahan[];
  usulan: HasilFeeOrang;
};

export type BahanEvent = {
  kode: string;
  nama: string;
  klien: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  status: StatusEvent;
  alasanTolak: string | null;
  sesi: SesiBahan[];
  /** Kapten di atas, lalu urut kode karyawan. */
  orang: OrangBahan[];
  /** Kehadiran crew yang belum dinilai kapten. */
  crewBelumDinilai: number;
  /** Bulan tarif ("YYYY-MM") = bulan tanggal selesai event. */
  periodeTarif: string;
  /** Jabatan yang belum punya tarif disetujui dan berlaku di bulan tarif (laporan tidak bisa dikirim atau disetujui). */
  tarifKurang: string[];
  totalUsulan: number;
};

export async function muatBahanEvent(klien: DbAtauTx, kode: string): Promise<BahanEvent | null> {
  const e = await klien.event.findUnique({
    where: { kode },
    include: {
      sesi: { orderBy: [{ tanggal: "asc" }, { jamMulai: "asc" }, { id: "asc" }], include: { kehadiran: { include: { dinilaiOleh: { select: { nama: true } } } } } },
      penugasan: { include: { karyawan: true, jabatan: true } },
    },
  });
  if (!e) return null;
  const periodeTarif = periodeDari(dariDate(e.tanggalSelesai));
  const peta = await muatPetaNominal(klien);
  const sesi: SesiBahan[] = e.sesi.map((s) => ({ id: s.id, nama: s.nama, tanggal: dariDate(s.tanggal), jamMulai: s.jamMulai, jamSelesai: s.jamSelesai }));
  const petaSesi = new Map(sesi.map((s) => [s.id, s]));
  const semuaKehadiran = e.sesi.flatMap((s) =>
    s.kehadiran.map((k): KehadiranBahan => ({
      id: k.id,
      sesiId: k.sesiId,
      karyawanKode: k.karyawanKode,
      jamMasuk: k.jamMasuk,
      jamPulang: k.jamPulang,
      catatanProgres: k.catatanProgres,
      penilaian: k.penilaian,
      menitDiakui: k.menitDiakui,
      catatanNilai: k.catatanNilai,
      dinilaiOleh: k.dinilaiOleh?.nama ?? null,
      dinilaiPada: k.dinilaiPada?.toISOString() ?? null,
      menitTercatat: menitTercatat(s, k),
    })),
  );

  const orang: OrangBahan[] = e.penugasan
    .filter((p) => p.jabatan.peranEvent && p.jabatan.satuanTarif)
    .map((p) => {
      const kehadiran = semuaKehadiran.filter((k) => k.karyawanKode === p.karyawanKode);
      const satuanTarif = p.jabatan.satuanTarif as KodeSatuan;
      const v = peta.pada("JABATAN_EVENT", p.jabatanKode, periodeTarif);
      const tarif = v?.nominal ?? 0;
      return {
        penugasanId: p.id,
        karyawanKode: p.karyawanKode,
        nama: p.karyawan.nama,
        bank: p.karyawan.bank,
        noRek: p.karyawan.noRek,
        jabatanKode: p.jabatanKode,
        jabatan: p.jabatan.nama,
        peranEvent: p.jabatan.peranEvent as KodePeranEvent,
        satuanTarif,
        tarif,
        versiTarif: v ? { kode: v.kode, berlakuMulai: v.berlakuMulai } : null,
        akunBebanKode: p.jabatan.akunBebanKode,
        kehadiran,
        usulan: hitungFeeOrang({
          satuanTarif,
          tarif,
          kehadiran: kehadiran.map((k) => ({ ...k, sesi: petaSesi.get(k.sesiId)! })),
        }),
      };
    })
    .sort((a, b) => (a.peranEvent === b.peranEvent ? 0 : a.peranEvent === "KAPTEN" ? -1 : 1) || a.karyawanKode.localeCompare(b.karyawanKode));

  return {
    kode: e.kode,
    nama: e.nama,
    klien: e.klien,
    tanggalMulai: dariDate(e.tanggalMulai),
    tanggalSelesai: dariDate(e.tanggalSelesai),
    status: e.status,
    alasanTolak: e.alasanTolak,
    sesi,
    orang,
    periodeTarif,
    tarifKurang: [...new Set(orang.filter((o) => !o.versiTarif).map((o) => o.jabatan))],
    crewBelumDinilai: orang.filter((o) => o.peranEvent === "CREW").reduce((s, o) => s + o.kehadiran.filter((k) => !k.penilaian).length, 0),
    totalUsulan: orang.reduce((s, o) => s + o.usulan.fee, 0),
  };
}

/**
 * Mengunci baris event (SELECT ... FOR UPDATE) sampai transaksi selesai dan mengembalikan status serta rentang tanggalnya.
 * Dipakai semua server action yang mengubah data event, supaya perubahan HRD, penilaian kapten, pengiriman laporan,
 * dan keputusan Owner berjalan satu per satu untuk event yang sama.
 */
export async function kunciEvent(tx: Tx, kode: string): Promise<{ status: StatusEvent; tanggalMulai: string; tanggalSelesai: string }> {
  const baris = await tx.$queryRaw<{ status: StatusEvent; tanggal_mulai: Date; tanggal_selesai: Date }[]>`
    SELECT status, tanggal_mulai, tanggal_selesai FROM event WHERE id_event = ${kode} FOR UPDATE`;
  if (!baris.length) throw new GalatAksi("Event tidak ditemukan.");
  return { status: baris[0].status, tanggalMulai: dariDate(baris[0].tanggal_mulai), tanggalSelesai: dariDate(baris[0].tanggal_selesai) };
}

/** Kode karyawan yang ditautkan ke akun kapten (null bila akun bukan kapten atau belum ditautkan). */
export async function kaptenDariPengguna(klien: DbAtauTx, penggunaId: number): Promise<string | null> {
  const p = await klien.pengguna.findUnique({ where: { id: penggunaId }, select: { peran: true, aktif: true, karyawanKode: true } });
  if (!p || !p.aktif || p.peran !== "KAPTEN") return null;
  return p.karyawanKode;
}

/** true bila karyawan ditugaskan sebagai Kapten di event itu. */
export async function kaptenDiEvent(klien: DbAtauTx, eventKode: string, karyawanKode: string): Promise<boolean> {
  const n = await klien.penugasanEvent.count({ where: { eventKode, karyawanKode, jabatan: { peranEvent: "KAPTEN" } } });
  return n > 0;
}

/**
 * Server action: kapten hanya boleh menyentuh event yang ia pegang sebagai Kapten.
 * Pesannya sama untuk event yang tidak ada dan event milik kapten lain, supaya kode event lain tidak bisa ditebak.
 */
export async function pastikanKaptenEvent(klien: DbAtauTx, penggunaId: number, eventKode: string): Promise<string> {
  const karyawanKode = await kaptenDariPengguna(klien, penggunaId);
  if (!karyawanKode) throw new GalatAksi("Akun kapten ini belum ditautkan ke data crew. Minta Owner menautkannya di menu Pengguna.");
  if (!(await kaptenDiEvent(klien, eventKode, karyawanKode))) throw new GalatAksi("Event ini tidak ditemukan atau bukan event yang kamu pegang sebagai kapten.");
  return karyawanKode;
}

/** Event yang dipegang kapten, terbaru dulu. */
export async function eventMilikKapten(karyawanKode: string) {
  const d = await db.event.findMany({
    where: { penugasan: { some: { karyawanKode, jabatan: { peranEvent: "KAPTEN" } } } },
    orderBy: [{ tanggalMulai: "desc" }, { kode: "desc" }],
    select: { kode: true, nama: true, klien: true, tanggalMulai: true, tanggalSelesai: true, status: true, alasanTolak: true },
  });
  return d.map((e) => ({ ...e, tanggalMulai: dariDate(e.tanggalMulai), tanggalSelesai: dariDate(e.tanggalSelesai) }));
}
