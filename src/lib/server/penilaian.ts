/*
 * Layanan penilaian kapten dan kiriman laporan fee (dipanggil server action src/lib/aksi/fee-event/penilaian.ts dan skrip seed).
 */
import type { Tx } from "@/lib/server/db";
import { GalatAksi } from "@/lib/server/aksi";
import type { PenggunaSesi } from "@/lib/server/auth";
import { AWALAN, nomorDokumen } from "@/lib/server/nomor";
import { catatLog } from "@/lib/server/log";
import { durasiKeMenit, labelDurasi, menitTercatat } from "@/lib/inti/fee-event";
import { kunciEvent, muatBahanEvent, pastikanKaptenEvent } from "@/lib/data/fee-event/bahan";
import { tahanKunciSetting } from "@/lib/server/setting-gaji";
import { skemaPenilaian } from "@/lib/skema/fee-event";
import type { z } from "zod";

export async function nilaiKehadiranDalam(tx: Tx, pengguna: PenggunaSesi, d: z.infer<typeof skemaPenilaian>) {
  const k = await tx.kehadiranEvent.findUnique({ where: { id: d.id }, include: { sesi: true, karyawan: { select: { nama: true } } } });
  if (!k) throw new GalatAksi("Kehadiran tidak ditemukan.");
  const e = await kunciEvent(tx, k.sesi.eventKode);
  const tugas = await tx.penugasanEvent.findUnique({
    where: { eventKode_karyawanKode: { eventKode: k.sesi.eventKode, karyawanKode: k.karyawanKode } },
    select: { jabatan: { select: { peranEvent: true } } },
  });
  const peranTarget = tugas?.jabatan.peranEvent ?? null;

  if (pengguna.peran === "KAPTEN") {
    const saya = await pastikanKaptenEvent(tx, pengguna.id, k.sesi.eventKode);
    if (k.karyawanKode === saya) throw new GalatAksi("Kapten tidak boleh menilai kehadirannya sendiri. Kehadiran kapten dinilai Owner.");
    if (peranTarget !== "CREW") throw new GalatAksi("Kehadiran kapten lain dinilai Owner, bukan sesama kapten.");
    if (e.status !== "PENILAIAN") throw new GalatAksi("Laporan event ini sudah dikirim ke Owner, jadi penilaian terkunci.");
  } else {
    // Owner menilai kehadiran kapten. Kehadiran crew dinilai kapten; Owner cukup mengubah fee akhir bila perlu.
    if (peranTarget !== "KAPTEN") throw new GalatAksi("Kehadiran crew dinilai kapten event. Owner menilai kehadiran kapten.");
    if (e.status === "SELESAI") throw new GalatAksi("Fee event ini sudah dibayar, jadi penilaian tidak bisa diubah.");
  }

  const batas = menitTercatat(k.sesi, k);
  let menitDiakui: number | null = null;
  if (d.penilaian === "KURANG") {
    menitDiakui = durasiKeMenit(d.jamDiakui);
    if (menitDiakui === null) throw new GalatAksi("Isi jam yang diakui dengan bentuk jam:menit, contoh 4:30.", { jamDiakui: "Bentuknya jam:menit." });
    if (menitDiakui > batas) {
      throw new GalatAksi(`Jam diakui paling banyak ${labelDurasi(batas)} (jam tercatat di dalam jadwal sesi ${k.sesi.jamMulai} sampai ${k.sesi.jamSelesai}).`, { jamDiakui: `Maksimal ${labelDurasi(batas)}.` });
    }
  }
  await tx.kehadiranEvent.update({
    where: { id: k.id },
    data: { penilaian: d.penilaian, menitDiakui, catatanNilai: d.catatan || null, dinilaiOlehId: pengguna.id, dinilaiPada: new Date() },
  });
  await catatLog(tx, pengguna.id, "kehadiran-event.nilai", "kehadiran_event", String(k.id), `${k.sesi.eventKode} ${k.sesi.nama} ${k.karyawanKode}: ${d.penilaian}${menitDiakui !== null ? ` ${menitDiakui} menit` : ""}`);
  return k.karyawan.nama;
}

export async function kirimLaporanDalam(tx: Tx, pengguna: PenggunaSesi, eventKode: string, catatan: string) {
  await pastikanKaptenEvent(tx, pengguna.id, eventKode);
  const e = await kunciEvent(tx, eventKode);
  if (e.status !== "PENILAIAN") throw new GalatAksi("Laporan event ini sudah dikirim ke Owner.");
  // Kunci bersama: usulan fee dihitung dengan tarif yang tidak sedang diubah persetujuan Owner.
  await tahanKunciSetting(tx);
  const b = await muatBahanEvent(tx, eventKode);
  if (!b) throw new GalatAksi("Event tidak ditemukan.");
  if (b.tarifKurang.length) throw new GalatAksi("Tarif jabatan di event ini belum disetujui Owner. Hubungi Owner sebelum mengirim laporan.");
  if (!b.orang.some((o) => o.peranEvent === "KAPTEN")) throw new GalatAksi("Event ini belum punya kapten.");
  if (!b.orang.some((o) => o.kehadiran.length)) throw new GalatAksi("Belum ada kehadiran yang dicatat HRD di event ini.");
  if (b.crewBelumDinilai) throw new GalatAksi(`Masih ada ${b.crewBelumDinilai} kehadiran crew yang belum dinilai. Nilai semuanya dulu.`);

  const nomor = await nomorDokumen(tx, AWALAN.LAPORAN_FEE, e.tanggalSelesai);
  const klaim = await tx.event.updateMany({ where: { kode: eventKode, status: "PENILAIAN" }, data: { status: "DIAJUKAN", alasanTolak: null } });
  if (klaim.count !== 1) throw new GalatAksi("Laporan event ini baru saja dikirim pengguna lain.");
  await tx.laporanFee.create({ data: { no: nomor, eventKode, status: "DIAJUKAN", catatanKapten: catatan, totalUsulan: b.totalUsulan, diajukanOlehId: pengguna.id } });
  const kurang = b.orang.reduce((s, o) => s + o.usulan.jumlahKurang, 0);
  await catatLog(tx, pengguna.id, "laporan-fee.ajukan", "laporan_fee", nomor, `${eventKode}, ${kurang} penilaian kurang`);
  return nomor;
}
