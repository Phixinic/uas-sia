"use server";

/*
 * Server action pencatatan event (HRD dan Owner, izin event.kelola): event, sesi, penugasan crew, dan kehadiran per sesi.
 * Semua perubahan hanya boleh selama event berstatus PENILAIAN (laporan kapten belum dikirim ke Owner, atau sudah
 * ditolak Owner). Baris event dikunci (SELECT ... FOR UPDATE) di awal transaksi, jadi pengiriman laporan kapten dan
 * perubahan HRD tidak bisa saling menyalip.
 * Perubahan jam sesi, jam kehadiran, atau jabatan penugasan menghapus penilaian yang sudah ada, karena dasarnya berubah.
 */
import { db, type Tx } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { AWALAN, nomorDokumen } from "@/lib/server/nomor";
import { catatLog } from "@/lib/server/log";
import { keDate, labelTanggal } from "@/lib/inti/tanggal";
import { kunciEvent } from "@/lib/data/fee-event/bahan";
import {
  skemaEvent, skemaIdKehadiran, skemaIdPenugasan, skemaIdSesi, skemaKehadiran, skemaKodeEvent, skemaPenugasan, skemaSesi,
} from "@/lib/skema/fee-event";

const PENILAIAN_KOSONG = { penilaian: null, menitDiakui: null, catatanNilai: null, dinilaiOlehId: null, dinilaiPada: null } as const;

/** Event harus masih dalam tahap penilaian supaya datanya boleh diubah. */
async function wajibPenilaian(tx: Tx, kode: string) {
  const e = await kunciEvent(tx, kode);
  if (e.status === "DIAJUKAN") throw new GalatAksi("Laporan event ini sedang menunggu keputusan Owner, jadi datanya terkunci. Minta Owner menolak laporan bila ada yang perlu dibetulkan.");
  if (e.status === "SELESAI") throw new GalatAksi("Fee event ini sudah dibayar, jadi datanya tidak bisa diubah lagi.");
  return e;
}

function pastikanDalamRentang(tanggal: string, e: { tanggalMulai: string; tanggalSelesai: string }) {
  if (tanggal < e.tanggalMulai || tanggal > e.tanggalSelesai) {
    throw new GalatAksi(`Tanggal sesi harus di antara ${labelTanggal(e.tanggalMulai)} dan ${labelTanggal(e.tanggalSelesai)}.`, { tanggal: "Di luar tanggal event." });
  }
}

// ---------------------------------------------------------------- Event

export async function simpanEvent(input: unknown): Promise<HasilAksi<{ kode: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const d = validasi(skemaEvent, input);
    const kode = await db.$transaction(async (tx) => {
      const data = { nama: d.nama, klien: d.klien, tanggalMulai: keDate(d.tanggalMulai), tanggalSelesai: keDate(d.tanggalSelesai) };
      if (d.kode) {
        await wajibPenilaian(tx, d.kode);
        const luar = await tx.sesiEvent.count({ where: { eventKode: d.kode, OR: [{ tanggal: { lt: data.tanggalMulai } }, { tanggal: { gt: data.tanggalSelesai } }] } });
        if (luar) throw new GalatAksi(`Ada ${luar} sesi di luar rentang tanggal baru. Ubah atau hapus sesinya dulu.`, { tanggalMulai: "Ada sesi di luar rentang ini." });
        await tx.event.update({ where: { kode: d.kode }, data });
        await catatLog(tx, pengguna.id, "event.ubah", "event", d.kode, d.nama);
        return d.kode;
      }
      const baru = await nomorDokumen(tx, AWALAN.EVENT, d.tanggalMulai);
      await tx.event.create({ data: { kode: baru, ...data, dibuatOlehId: pengguna.id } });
      await catatLog(tx, pengguna.id, "event.buat", "event", baru, d.nama);
      return baru;
    });
    segarkan();
    return { pesan: `Event ${kode} tersimpan.`, data: { kode } };
  });
}

export async function hapusEvent(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const { eventKode } = validasi(skemaKodeEvent, input);
    await db.$transaction(async (tx) => {
      await wajibPenilaian(tx, eventKode);
      if (await tx.laporanFee.count({ where: { eventKode } })) throw new GalatAksi("Event ini sudah pernah dilaporkan ke Owner, jadi tidak bisa dihapus.");
      if (await tx.kehadiranEvent.count({ where: { sesi: { eventKode } } })) throw new GalatAksi("Event ini sudah punya kehadiran. Hapus kehadirannya dulu bila event memang batal.");
      await tx.event.delete({ where: { kode: eventKode } });
      await catatLog(tx, pengguna.id, "event.hapus", "event", eventKode);
    });
    segarkan();
    return { pesan: `Event ${eventKode} dihapus.` };
  });
}

// ---------------------------------------------------------------- Sesi

export async function simpanSesi(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const d = validasi(skemaSesi, input);
    await db.$transaction(async (tx) => {
      const e = await wajibPenilaian(tx, d.eventKode);
      pastikanDalamRentang(d.tanggal, e);
      const data = { nama: d.nama, tanggal: keDate(d.tanggal), jamMulai: d.jamMulai, jamSelesai: d.jamSelesai };
      if (d.id) {
        const lama = await tx.sesiEvent.findUnique({ where: { id: d.id } });
        if (!lama || lama.eventKode !== d.eventKode) throw new GalatAksi("Sesi tidak ditemukan.");
        await tx.sesiEvent.update({ where: { id: d.id }, data });
        if (lama.jamMulai !== d.jamMulai || lama.jamSelesai !== d.jamSelesai) {
          await tx.kehadiranEvent.updateMany({ where: { sesiId: d.id }, data: PENILAIAN_KOSONG });
        }
        await catatLog(tx, pengguna.id, "sesi-event.ubah", "sesi_event", String(d.id), `${d.eventKode} ${d.nama}`);
      } else {
        const s = await tx.sesiEvent.create({ data: { eventKode: d.eventKode, ...data } });
        await catatLog(tx, pengguna.id, "sesi-event.buat", "sesi_event", String(s.id), `${d.eventKode} ${d.nama}`);
      }
    });
    segarkan();
    return { pesan: `Sesi ${d.nama} tersimpan.` };
  });
}

export async function hapusSesi(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const { id } = validasi(skemaIdSesi, input);
    const nama = await db.$transaction(async (tx) => {
      const s = await tx.sesiEvent.findUnique({ where: { id }, select: { eventKode: true, nama: true, _count: { select: { kehadiran: true } } } });
      if (!s) throw new GalatAksi("Sesi tidak ditemukan atau sudah dihapus.");
      await wajibPenilaian(tx, s.eventKode);
      if (s._count.kehadiran) throw new GalatAksi("Sesi ini sudah punya kehadiran. Hapus kehadirannya dulu.");
      await tx.sesiEvent.delete({ where: { id } });
      await catatLog(tx, pengguna.id, "sesi-event.hapus", "sesi_event", String(id), `${s.eventKode} ${s.nama}`);
      return s.nama;
    });
    segarkan();
    return { pesan: `Sesi ${nama} dihapus.` };
  });
}

// ---------------------------------------------------------------- Penugasan

export async function simpanPenugasan(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const d = validasi(skemaPenugasan, input);
    const pesan = await db.$transaction(async (tx) => {
      await wajibPenilaian(tx, d.eventKode);
      const lama = d.id ? await tx.penugasanEvent.findUnique({ where: { id: d.id }, include: { jabatan: true } }) : null;
      if (d.id && (!lama || lama.eventKode !== d.eventKode)) throw new GalatAksi("Penugasan tidak ditemukan.");
      const [karyawan, jabatan] = await Promise.all([
        tx.karyawan.findUnique({ where: { kode: d.karyawanKode }, select: { nama: true, aktif: true, jenis: true } }),
        tx.jabatan.findUnique({ where: { kode: d.jabatanKode }, select: { nama: true, aktif: true, kelompok: true, peranEvent: true } }),
      ]);
      if (!karyawan) throw new GalatAksi("Crew tidak ditemukan.", { karyawanKode: "Crew tidak ditemukan." });
      if (!karyawan.aktif && lama?.karyawanKode !== d.karyawanKode) throw new GalatAksi(`${karyawan.nama} sudah nonaktif.`, { karyawanKode: "Crew nonaktif." });
      if (!jabatan || jabatan.kelompok !== "EVENT" || !jabatan.peranEvent) throw new GalatAksi("Pilih jabatan event (Kapten atau Crew).", { jabatanKode: "Bukan jabatan event." });
      // Karyawan inhouse boleh ikut event seperti crew (upahnya dibayar lewat Gaji Bulanan). Kapten tetap crew freelance
      // yang punya akun kapten, karena kaptenlah yang menilai kehadiran crew.
      if (karyawan.jenis === "INHOUSE" && jabatan.peranEvent !== "CREW") throw new GalatAksi(`${karyawan.nama} karyawan inhouse, jadi hanya bisa ditugaskan sebagai crew. Kapten event adalah crew freelance yang punya akun kapten.`, { jabatanKode: "Karyawan inhouse hanya sebagai crew." });
      if (!jabatan.aktif && lama?.jabatanKode !== d.jabatanKode) throw new GalatAksi(`Jabatan ${jabatan.nama} sudah nonaktif.`, { jabatanKode: "Jabatan nonaktif." });

      const bentrok = await tx.penugasanEvent.findUnique({ where: { eventKode_karyawanKode: { eventKode: d.eventKode, karyawanKode: d.karyawanKode } }, select: { id: true } });
      if (bentrok && bentrok.id !== (d.id ?? null)) throw new GalatAksi(`${karyawan.nama} sudah ditugaskan di event ini. Ubah penugasannya bila jabatannya berganti.`, { karyawanKode: "Sudah ditugaskan." });

      if (lama) {
        if (lama.karyawanKode !== d.karyawanKode && (await tx.kehadiranEvent.count({ where: { karyawanKode: lama.karyawanKode, sesi: { eventKode: d.eventKode } } }))) {
          throw new GalatAksi("Orang di penugasan ini sudah punya kehadiran, jadi orangnya tidak bisa diganti. Tambahkan penugasan baru untuk orang lain.", { karyawanKode: "Sudah punya kehadiran." });
        }
        await tx.penugasanEvent.update({ where: { id: lama.id }, data: { karyawanKode: d.karyawanKode, jabatanKode: d.jabatanKode } });
        // Peran berubah (crew jadi kapten atau sebaliknya): penilai kehadirannya ikut berubah, jadi penilaian lama dihapus.
        if (lama.jabatan.peranEvent !== jabatan.peranEvent) {
          await tx.kehadiranEvent.updateMany({ where: { karyawanKode: d.karyawanKode, sesi: { eventKode: d.eventKode } }, data: PENILAIAN_KOSONG });
        }
        await catatLog(tx, pengguna.id, "penugasan-event.ubah", "penugasan_event", String(lama.id), `${d.eventKode} ${d.karyawanKode}: ${lama.jabatanKode} -> ${d.jabatanKode}`);
        return `Penugasan ${karyawan.nama} diubah menjadi ${jabatan.nama}.`;
      }
      const baru = await tx.penugasanEvent.create({ data: { eventKode: d.eventKode, karyawanKode: d.karyawanKode, jabatanKode: d.jabatanKode } });
      await catatLog(tx, pengguna.id, "penugasan-event.buat", "penugasan_event", String(baru.id), `${d.eventKode} ${d.karyawanKode} ${d.jabatanKode}`);
      return `${karyawan.nama} ditugaskan sebagai ${jabatan.nama}.`;
    });
    segarkan();
    return { pesan };
  });
}

export async function hapusPenugasan(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const { id } = validasi(skemaIdPenugasan, input);
    await db.$transaction(async (tx) => {
      const p = await tx.penugasanEvent.findUnique({ where: { id } });
      if (!p) throw new GalatAksi("Penugasan tidak ditemukan atau sudah dihapus.");
      await wajibPenilaian(tx, p.eventKode);
      if (await tx.kehadiranEvent.count({ where: { karyawanKode: p.karyawanKode, sesi: { eventKode: p.eventKode } } })) {
        throw new GalatAksi("Orang ini sudah punya kehadiran di event ini. Hapus kehadirannya dulu.");
      }
      await tx.penugasanEvent.delete({ where: { id } });
      await catatLog(tx, pengguna.id, "penugasan-event.hapus", "penugasan_event", String(id), `${p.eventKode} ${p.karyawanKode}`);
    });
    segarkan();
    return { pesan: "Penugasan dihapus." };
  });
}

// ---------------------------------------------------------------- Kehadiran

export async function simpanKehadiran(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const d = validasi(skemaKehadiran, input);
    await db.$transaction(async (tx) => {
      const sesi = await tx.sesiEvent.findUnique({ where: { id: d.sesiId }, select: { eventKode: true, nama: true } });
      if (!sesi) throw new GalatAksi("Sesi tidak ditemukan.", { sesiId: "Sesi tidak ditemukan." });
      await wajibPenilaian(tx, sesi.eventKode);
      const tugas = await tx.penugasanEvent.findUnique({ where: { eventKode_karyawanKode: { eventKode: sesi.eventKode, karyawanKode: d.karyawanKode } }, select: { id: true } });
      if (!tugas) throw new GalatAksi("Orang ini belum ditugaskan di event ini. Tambahkan penugasannya dulu.", { karyawanKode: "Belum ditugaskan." });

      const lama = d.id ? await tx.kehadiranEvent.findUnique({ where: { id: d.id }, include: { sesi: { select: { eventKode: true } } } }) : null;
      if (d.id && (!lama || lama.sesi.eventKode !== sesi.eventKode)) throw new GalatAksi("Kehadiran tidak ditemukan.");
      const bentrok = await tx.kehadiranEvent.findUnique({ where: { sesiId_karyawanKode: { sesiId: d.sesiId, karyawanKode: d.karyawanKode } }, select: { id: true } });
      if (bentrok && bentrok.id !== (d.id ?? null)) throw new GalatAksi("Kehadiran orang ini di sesi tersebut sudah ada. Ubah data yang ada.", { karyawanKode: "Sudah ada di sesi ini." });

      const data = { sesiId: d.sesiId, karyawanKode: d.karyawanKode, jamMasuk: d.jamMasuk, jamPulang: d.jamPulang, catatanProgres: d.catatanProgres };
      if (lama) {
        const berubah = lama.sesiId !== d.sesiId || lama.karyawanKode !== d.karyawanKode || lama.jamMasuk !== d.jamMasuk || lama.jamPulang !== d.jamPulang || lama.catatanProgres !== d.catatanProgres;
        await tx.kehadiranEvent.update({ where: { id: lama.id }, data: { ...data, ...(berubah ? PENILAIAN_KOSONG : {}) } });
        await catatLog(tx, pengguna.id, "kehadiran-event.ubah", "kehadiran_event", String(lama.id), `${sesi.eventKode} ${sesi.nama} ${d.karyawanKode}${berubah && lama.penilaian ? " (penilaian dihapus)" : ""}`);
      } else {
        const k = await tx.kehadiranEvent.create({ data: { ...data, dibuatOlehId: pengguna.id } });
        await catatLog(tx, pengguna.id, "kehadiran-event.buat", "kehadiran_event", String(k.id), `${sesi.eventKode} ${sesi.nama} ${d.karyawanKode}`);
      }
    });
    segarkan();
    return { pesan: "Kehadiran tersimpan." };
  });
}

export async function hapusKehadiran(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const { id } = validasi(skemaIdKehadiran, input);
    await db.$transaction(async (tx) => {
      const k = await tx.kehadiranEvent.findUnique({ where: { id }, include: { sesi: { select: { eventKode: true, nama: true } } } });
      if (!k) throw new GalatAksi("Kehadiran tidak ditemukan atau sudah dihapus.");
      await wajibPenilaian(tx, k.sesi.eventKode);
      await tx.kehadiranEvent.delete({ where: { id } });
      await catatLog(tx, pengguna.id, "kehadiran-event.hapus", "kehadiran_event", String(id), `${k.sesi.eventKode} ${k.sesi.nama} ${k.karyawanKode}`);
    });
    segarkan();
    return { pesan: "Kehadiran dihapus." };
  });
}
