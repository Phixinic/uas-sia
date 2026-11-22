"use server";

/*
 * Server action penilaian progres dan laporan kapten.
 *   nilaiKehadiran : Kapten menilai kehadiran CREW di event yang ia pegang (selama PENILAIAN). Kapten tidak boleh menilai
 *                    dirinya sendiri atau kapten lain; kehadiran kapten dinilai Owner (selama PENILAIAN atau DIAJUKAN).
 *                    SESUAI = menit tercatat diakui penuh. KURANG = catatan wajib dan jam diakui, paling banyak menit
 *                    tercatat yang dipotong ke jadwal sesi.
 *   kirimLaporan   : Kapten mengirim laporan ke Owner setelah semua kehadiran crew dinilai -> laporan FEE-YYYY-NNNN
 *                    DIAJUKAN, event DIAJUKAN (data event terkunci sampai Owner memutuskan).
 * Kepemilikan kapten selalu dicek di server (pastikanKaptenEvent), bukan hanya disembunyikan di UI.
 */
import { db } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { AWALAN, nomorDokumen } from "@/lib/server/nomor";
import { catatLog } from "@/lib/server/log";
import { durasiKeMenit, labelDurasi, menitTercatat } from "@/lib/inti/fee-event";
import { kunciEvent, muatBahanEvent, pastikanKaptenEvent } from "@/lib/data/fee-event/bahan";
import { skemaKirimLaporan, skemaPenilaian } from "@/lib/skema/fee-event";

export async function nilaiKehadiran(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.nilai"]);
    const d = validasi(skemaPenilaian, input);
    const nama = await db.$transaction(async (tx) => {
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
    });
    segarkan();
    return { pesan: `Penilaian ${nama} tersimpan.` };
  });
}

export async function kirimLaporan(input: unknown): Promise<HasilAksi<{ no: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.lapor"]);
    const { eventKode, catatan } = validasi(skemaKirimLaporan, input);
    const no = await db.$transaction(async (tx) => {
      await pastikanKaptenEvent(tx, pengguna.id, eventKode);
      const e = await kunciEvent(tx, eventKode);
      if (e.status !== "PENILAIAN") throw new GalatAksi("Laporan event ini sudah dikirim ke Owner.");
      const b = await muatBahanEvent(tx, eventKode);
      if (!b) throw new GalatAksi("Event tidak ditemukan.");
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
    });
    segarkan();
    return { pesan: `Laporan ${no} dikirim ke Owner.`, data: { no } };
  });
}

