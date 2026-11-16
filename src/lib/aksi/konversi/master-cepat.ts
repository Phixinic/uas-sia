"use server";

/*
 * Tambah cepat master dari form pembelian (Admin): supplier, peralatan, atau perlengkapan baru
 * tanpa meninggalkan form. Pengelolaan lengkap (ubah, nonaktifkan) ada di halaman Master Konversi.
 */
import { db } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { AWALAN, kodeBerikutnya } from "@/lib/server/nomor";
import { catatLog } from "@/lib/server/log";
import { skemaBarangCepat, skemaSupplierCepat } from "@/lib/skema/konversi";

export async function tambahSupplierCepat(input: unknown): Promise<HasilAksi<{ kode: string; nama: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["master-konversi.tambah-cepat"]);
    const d = validasi(skemaSupplierCepat, input);
    const kode = await db.$transaction(async (tx) => {
      const k = await kodeBerikutnya(tx, AWALAN.SUPPLIER);
      await tx.supplier.create({ data: { kode: k, nama: d.nama, telepon: d.telepon } });
      await catatLog(tx, pengguna.id, "supplier.tambah-cepat", "supplier", k, d.nama);
      return k;
    });
    segarkan();
    return { pesan: `${d.nama} ditambahkan ke master supplier (${kode}).`, data: { kode, nama: d.nama } };
  });
}

export async function tambahBarangCepat(input: unknown): Promise<HasilAksi<{ kode: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["master-konversi.tambah-cepat"]);
    const d = validasi(skemaBarangCepat, input);
    const peralatan = d.jenis === "PERALATAN";
    if (peralatan && !d.kategoriKode) throw new GalatAksi("Pilih kategori aset.", { kategoriKode: "Pilih kategori aset." });
    const kode = await db.$transaction(async (tx) => {
      if (peralatan) {
        const kat = await tx.kategoriAset.findUnique({ where: { kode: d.kategoriKode }, select: { aktif: true } });
        if (!kat || !kat.aktif) throw new GalatAksi("Kategori aset tidak ditemukan atau nonaktif.", { kategoriKode: "Kategori tidak valid." });
        const k = await kodeBerikutnya(tx, AWALAN.PERALATAN);
        await tx.peralatan.create({ data: { kode: k, nama: d.nama, satuan: d.satuan, kategoriKode: d.kategoriKode } });
        await catatLog(tx, pengguna.id, "peralatan.tambah-cepat", "peralatan", k, d.nama);
        return k;
      }
      const k = await kodeBerikutnya(tx, AWALAN.PERLENGKAPAN);
      await tx.perlengkapan.create({ data: { kode: k, nama: d.nama, satuan: d.satuan } });
      await catatLog(tx, pengguna.id, "perlengkapan.tambah-cepat", "perlengkapan", k, d.nama);
      return k;
    });
    segarkan();
    return { pesan: `${d.nama} ditambahkan ke master (${kode}).`, data: { kode } };
  });
}
