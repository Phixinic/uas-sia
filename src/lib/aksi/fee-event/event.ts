"use server";

/*
 * Server action pencatatan event (HRD dan Owner, izin event.kelola): event, sesi, penugasan crew, dan kehadiran per sesi.
 * Semua perubahan hanya boleh selama event berstatus PENILAIAN (laporan kapten belum dikirim ke Owner, atau sudah
 * ditolak Owner). Baris event dikunci (SELECT ... FOR UPDATE) di awal transaksi, jadi pengiriman laporan kapten dan
 * perubahan HRD tidak bisa saling menyalip.
 * Perubahan jam sesi, jam kehadiran, atau jabatan penugasan menghapus penilaian yang sudah ada, karena dasarnya berubah.
 */
import { db } from "@/lib/server/db";
import { aksiAman, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { skemaEvent, skemaIdKehadiran, skemaIdPenugasan, skemaIdSesi, skemaKehadiran, skemaKodeEvent, skemaPenugasan, skemaSesi } from "@/lib/skema/fee-event";
import { simpanEventDalam, hapusEventDalam, simpanSesiDalam, hapusSesiDalam, simpanPenugasanDalam, hapusPenugasanDalam, simpanKehadiranDalam, hapusKehadiranDalam } from "@/lib/server/event";

export async function simpanEvent(input: unknown): Promise<HasilAksi<{ kode: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const d = validasi(skemaEvent, input);
    const kode = await db.$transaction((tx) => simpanEventDalam(tx, pengguna, d));
    segarkan();
    return { pesan: `Event ${kode} tersimpan.`, data: { kode } };
  });
}

export async function hapusEvent(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const { eventKode } = validasi(skemaKodeEvent, input);
    await db.$transaction((tx) => hapusEventDalam(tx, pengguna, eventKode));
    segarkan();
    return { pesan: `Event ${eventKode} dihapus.` };
  });
}

// ---------------------------------------------------------------- Sesi

export async function simpanSesi(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const d = validasi(skemaSesi, input);
    await db.$transaction((tx) => simpanSesiDalam(tx, pengguna, d));
    segarkan();
    return { pesan: `Sesi ${d.nama} tersimpan.` };
  });
}

export async function hapusSesi(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const { id } = validasi(skemaIdSesi, input);
    const nama = await db.$transaction((tx) => hapusSesiDalam(tx, pengguna, id));
    segarkan();
    return { pesan: `Sesi ${nama} dihapus.` };
  });
}

// ---------------------------------------------------------------- Penugasan

export async function simpanPenugasan(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const d = validasi(skemaPenugasan, input);
    const pesan = await db.$transaction((tx) => simpanPenugasanDalam(tx, pengguna, d));
    segarkan();
    return { pesan };
  });
}

export async function hapusPenugasan(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const { id } = validasi(skemaIdPenugasan, input);
    await db.$transaction((tx) => hapusPenugasanDalam(tx, pengguna, id));
    segarkan();
    return { pesan: "Penugasan dihapus." };
  });
}

// ---------------------------------------------------------------- Kehadiran

export async function simpanKehadiran(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const d = validasi(skemaKehadiran, input);
    await db.$transaction((tx) => simpanKehadiranDalam(tx, pengguna, d));
    segarkan();
    return { pesan: "Kehadiran tersimpan." };
  });
}

export async function hapusKehadiran(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["event.kelola"]);
    const { id } = validasi(skemaIdKehadiran, input);
    await db.$transaction((tx) => hapusKehadiranDalam(tx, pengguna, id));
    segarkan();
    return { pesan: "Kehadiran dihapus." };
  });
}
