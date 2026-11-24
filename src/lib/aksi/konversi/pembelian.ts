"use server";

/*
 * Server action pembelian peralatan dan perlengkapan (pola rujukan, lihat docs/KONTRAK.md).
 * Use case: Kelola draf pembelian peralatan, perlengkapan; Posting pembelian (include Buat kartu aset dan jadwal penyusutan).
 * Aturan peran (sama dengan app lama):
 *   simpan/ubah/hapus draf : Admin
 *   posting                : Admin atau Owner  (posting = status DISETUJUI, jurnal umum langsung berlaku)
 *   balik                  : Owner             (jurnal pembalik bertanggal hari ini, aset dibatalkan)
 */
import { db } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { buatJurnal } from "@/lib/server/jurnal";
import { catatLog } from "@/lib/server/log";
import { skemaNoDanAlasan, skemaNoDokumen, skemaPembelian } from "@/lib/skema/pembelian";
import { barisPembalik } from "@/lib/inti/jurnal";
import { dariDate, hariIni, periodeDari } from "@/lib/inti/tanggal";
import { OPSI_TX, postingPembelianDalam, simpanPembelianDalam } from "@/lib/server/pembelian";

export async function simpanPembelian(input: unknown): Promise<HasilAksi<{ no: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["pembelian.kelola-draf"]);
    const d = validasi(skemaPembelian, input);

    const no = await db.$transaction((tx) => simpanPembelianDalam(tx, pengguna, d), OPSI_TX);

    segarkan();
    return { pesan: d.posting ? `${no} disimpan dan diposting.` : `Draf ${no} tersimpan.`, data: { no } };
  });
}

export async function hapusPembelian(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["pembelian.kelola-draf"]);
    const { no } = validasi(skemaNoDokumen, input);
    await db.$transaction(async (tx) => {
      const n = await tx.pembelian.deleteMany({ where: { no, status: "DRAFT" } });
      if (n.count !== 1) throw new GalatAksi("Hanya draf yang bisa dihapus.");
      await catatLog(tx, pengguna.id, "pembelian.hapus", "pembelian", no);
    });
    segarkan();
    return { pesan: `Draf ${no} dihapus.` };
  });
}

export async function postingPembelian(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["pembelian.posting"]);
    const { no } = validasi(skemaNoDokumen, input);
    const hasil = await db.$transaction((tx) => postingPembelianDalam(tx, no, pengguna), OPSI_TX);
    segarkan();
    return { pesan: `${no} diposting. Jurnal ${hasil.jurnalNo} dibuat${hasil.aset.length ? `, ${hasil.aset.length} kartu aset ditambahkan` : ""}.` };
  });
}

/**
 * Balik pembelian yang sudah diposting: jurnal asli tetap ada, dibuat jurnal pembalik bertanggal hari ini.
 * Peralatan: semua kartu asetnya harus masih aktif dan belum punya penyusutan yang dijurnal; kartunya dibatalkan.
 * Perlengkapan: belum ada input nilai sisa di periode pembelian atau sesudahnya.
 */
export async function balikPembelian(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["pembelian.balik"]);
    const { no, alasan } = validasi(skemaNoDanAlasan, input);
    const jurnalNo = await db.$transaction(async (tx) => {
      const b = await tx.pembelian.findUnique({
        where: { no },
        include: { jurnal: { include: { detail: { orderBy: { noUrut: "asc" } } } }, detail: { include: { aset: { include: { jadwal: { where: { jurnalNo: { not: null } }, select: { periodeKe: true } } } } } } },
      });
      if (!b || b.status !== "DISETUJUI") throw new GalatAksi("Hanya pembelian yang sudah diposting yang bisa dibalik.");
      if (!b.jurnal) throw new GalatAksi("Jurnal asli pembelian ini tidak ditemukan.");
      const aset = b.detail.flatMap((d) => d.aset);
      if (b.jenis === "PERALATAN") {
        for (const a of aset) {
          if (a.status !== "AKTIF" || a.jadwal.length) {
            throw new GalatAksi(`${a.kode} sudah punya penyusutan yang dijurnal atau sudah dilepas. Gunakan Pelepasan Peralatan.`);
          }
        }
      } else {
        const opname = await tx.opname.count({ where: { status: { not: "DITOLAK" }, periodeId: { gte: periodeDari(dariDate(b.tanggal)) } } });
        if (opname) throw new GalatAksi("Nilai sisa perlengkapan untuk periode ini atau sesudahnya sudah diinput, jadi pembelian tidak bisa dibalik.");
      }
      const klaim = await tx.pembelian.updateMany({ where: { no, status: "DISETUJUI" }, data: { status: "DIBALIK", alasanBalik: alasan, dibalikOlehId: pengguna.id, dibalikPada: new Date() } });
      if (klaim.count !== 1) throw new GalatAksi(`${no} baru saja dibalik pengguna lain.`);
      const jb = await buatJurnal(tx, {
        tanggal: hariIni(),
        jenis: "PEMBALIK",
        status: "DISETUJUI",
        keterangan: `Pembalik ${b.jurnal.no} (pembelian ${no}): ${alasan}`,
        baris: barisPembalik(b.jurnal.detail.map((x) => ({ akun: x.akunKode, debit: x.debit, kredit: x.kredit }))),
        sumberTipe: "PEMBELIAN",
        sumberId: no,
        pembalikDariNo: b.jurnal.no,
        dibuatOlehId: pengguna.id,
        disetujuiOlehId: pengguna.id,
      });
      if (aset.length) {
        await tx.jadwalPenyusutan.deleteMany({ where: { asetKode: { in: aset.map((a) => a.kode) } } });
        await tx.aset.updateMany({ where: { kode: { in: aset.map((a) => a.kode) } }, data: { status: "BATAL" } });
      }
      await tx.pembelian.update({ where: { no }, data: { jurnalPembalikNo: jb } });
      await catatLog(tx, pengguna.id, "pembelian.balik", "pembelian", no, alasan);
      return jb;
    });
    segarkan();
    return { pesan: `${no} dibalik dengan jurnal ${jurnalNo}.` };
  });
}
