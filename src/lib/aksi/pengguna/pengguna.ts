"use server";

/*
 * Server action kelola pengguna (hanya Owner): buat, ubah nama/peran, reset kata sandi, aktif/nonaktif.
 * Menonaktifkan pengguna atau mereset kata sandinya menghapus semua sesinya, jadi aksesnya langsung putus.
 * Owner tidak boleh menonaktifkan atau menurunkan peran dirinya sendiri, dan harus selalu ada satu Owner aktif.
 * Akun Kapten wajib ditautkan ke satu karyawan berjenis Event (satu karyawan satu akun); peran lain tidak ditautkan.
 */
import { db, type Tx } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { hashKataSandi } from "@/lib/server/kata-sandi";
import { catatLog } from "@/lib/server/log";
import { skemaBuatPengguna, skemaResetSandi, skemaStatusPengguna, skemaUbahPengguna } from "@/lib/skema/pengguna";

const ambil = async (tx: Tx, id: number) => {
  const p = await tx.pengguna.findUnique({ where: { id } });
  if (!p) throw new GalatAksi("Pengguna tidak ditemukan.");
  return p;
};

/** Karyawan yang ditautkan ke akun Kapten: wajib ada, berjenis Event, aktif, dan belum dipegang akun lain. */
async function karyawanKapten(tx: Tx, peran: string, kode: string | null | undefined, penggunaId: number | null): Promise<string | null> {
  if (peran !== "KAPTEN") return null;
  if (!kode) throw new GalatAksi("Pilih crew yang dipegang akun kapten ini.", { karyawanKode: "Wajib untuk peran Kapten." });
  const k = await tx.karyawan.findUnique({ where: { kode }, select: { jenis: true, aktif: true, pengguna: { select: { id: true, namaPengguna: true } } } });
  if (!k || k.jenis !== "EVENT") throw new GalatAksi("Akun kapten harus ditautkan ke karyawan berjenis Event.", { karyawanKode: "Bukan karyawan event." });
  if (!k.aktif) throw new GalatAksi("Karyawan ini sudah nonaktif.", { karyawanKode: "Karyawan nonaktif." });
  if (k.pengguna && k.pengguna.id !== penggunaId) throw new GalatAksi(`Karyawan ini sudah dipegang akun @${k.pengguna.namaPengguna}.`, { karyawanKode: "Sudah punya akun." });
  return kode;
}

/** Setelah perubahan, harus tersisa minimal satu Owner aktif. */
const pastikanAdaOwner = async (tx: Tx) => {
  if ((await tx.pengguna.count({ where: { peran: "OWNER", aktif: true } })) < 1) throw new GalatAksi("Harus ada minimal satu Owner aktif.");
};

export async function buatPengguna(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const aktor = await wajibPeran(IZIN["pengguna.kelola"]);
    const d = validasi(skemaBuatPengguna, input);
    const hash = await hashKataSandi(d.kataSandi);
    await db.$transaction(async (tx) => {
      if (await tx.pengguna.findUnique({ where: { namaPengguna: d.namaPengguna }, select: { id: true } })) {
        throw new GalatAksi("Nama pengguna sudah dipakai.", { namaPengguna: "Nama pengguna sudah dipakai." });
      }
      const karyawanKode = await karyawanKapten(tx, d.peran, d.karyawanKode, null);
      const p = await tx.pengguna.create({ data: { namaPengguna: d.namaPengguna, nama: d.nama, peran: d.peran, karyawanKode, kataSandiHash: hash } });
      await catatLog(tx, aktor.id, "pengguna.buat", "pengguna", String(p.id), `${d.namaPengguna} (${d.peran})`);
    });
    segarkan();
    return { pesan: `Pengguna ${d.namaPengguna} dibuat.` };
  });
}

export async function ubahPengguna(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const aktor = await wajibPeran(IZIN["pengguna.kelola"]);
    const d = validasi(skemaUbahPengguna, input);
    await db.$transaction(async (tx) => {
      const p = await ambil(tx, d.id);
      if (p.id === aktor.id && d.peran !== "OWNER") throw new GalatAksi("Kamu tidak bisa menurunkan peran akunmu sendiri.", { peran: "Tidak bisa mengubah peran sendiri." });
      const karyawanKode = await karyawanKapten(tx, d.peran, d.karyawanKode, d.id);
      await tx.pengguna.update({ where: { id: d.id }, data: { nama: d.nama, peran: d.peran, karyawanKode } });
      await pastikanAdaOwner(tx);
      await catatLog(tx, aktor.id, "pengguna.ubah", "pengguna", String(d.id), `${p.namaPengguna}: ${p.peran} -> ${d.peran}`);
    });
    segarkan();
    return { pesan: "Data pengguna tersimpan." };
  });
}

export async function resetKataSandi(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const aktor = await wajibPeran(IZIN["pengguna.kelola"]);
    const d = validasi(skemaResetSandi, input);
    const hash = await hashKataSandi(d.kataSandi);
    await db.$transaction(async (tx) => {
      const p = await ambil(tx, d.id);
      await tx.pengguna.update({ where: { id: d.id }, data: { kataSandiHash: hash } });
      // Sesi lama dihapus (kecuali milik Owner yang sedang mereset dirinya sendiri, supaya tidak terlempar keluar).
      if (p.id !== aktor.id) await tx.sesi.deleteMany({ where: { penggunaId: p.id } });
      await catatLog(tx, aktor.id, "pengguna.reset-sandi", "pengguna", String(p.id), p.namaPengguna);
    });
    segarkan();
    return { pesan: "Kata sandi diganti." };
  });
}

export async function ubahStatusPengguna(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const aktor = await wajibPeran(IZIN["pengguna.kelola"]);
    const d = validasi(skemaStatusPengguna, input);
    await db.$transaction(async (tx) => {
      const p = await ambil(tx, d.id);
      if (!d.aktif && p.id === aktor.id) throw new GalatAksi("Kamu tidak bisa menonaktifkan akunmu sendiri.");
      await tx.pengguna.update({ where: { id: d.id }, data: { aktif: d.aktif } });
      if (!d.aktif) await tx.sesi.deleteMany({ where: { penggunaId: d.id } });
      await pastikanAdaOwner(tx);
      await catatLog(tx, aktor.id, d.aktif ? "pengguna.aktifkan" : "pengguna.nonaktifkan", "pengguna", String(d.id), p.namaPengguna);
    });
    segarkan();
    return { pesan: d.aktif ? "Pengguna diaktifkan." : "Pengguna dinonaktifkan dan sesinya diputus." };
  });
}
