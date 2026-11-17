"use server";

/*
 * Server action tutup periode: kunci (Owner, hanya bila daftar periksa lulus) dan buka kunci (Owner, alasan wajib).
 * Kunci berurutan: periode P hanya boleh dikunci bila semua periode sebelum P sudah terkunci, dan hanya boleh dibuka
 * bila tidak ada periode sesudah P yang terkunci. Tanpa aturan ini, November bisa dikunci sementara Oktober masih
 * terbuka, lalu pembelian bertanggal 30 Oktober yang diposting ikut mengubah saldo November yang sudah ditutup.
 * Setiap perubahan dicatat di riwayat_periode dan log aktivitas.
 */
import { db } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { pastikanPeriode, tahanKunciPeriode } from "@/lib/server/periode";
import { catatLog } from "@/lib/server/log";
import { cekPeriode } from "@/lib/data/pelaporan/periode";
import { skemaBukaPeriode, skemaPeriode } from "@/lib/skema/pelaporan";
import { labelPeriode } from "@/lib/inti/tanggal";

/** Menunggu kunci eksklusif bisa sampai posting panjang (pembelian, sampai 20 detik) selesai. */
const OPSI_TX = { timeout: 30_000, maxWait: 10_000 };

export async function kunciPeriode(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["periode.kunci"]);
    const { periode } = validasi(skemaPeriode, input);
    await db.$transaction(async (tx) => {
      // Kunci eksklusif: menunggu posting yang sedang berjalan selesai, dan menahan posting baru sampai commit.
      await tahanKunciPeriode(tx, true);
      const ini = await tx.periode.findUnique({ where: { id: periode }, select: { status: true } });
      if (ini?.status === "TERKUNCI") throw new GalatAksi(`Periode ${labelPeriode(periode)} sudah dikunci.`);
      const sebelum = await tx.periode.findFirst({ where: { id: { lt: periode }, status: "TERBUKA" }, orderBy: { id: "asc" }, select: { id: true } });
      if (sebelum) {
        throw new GalatAksi(`${labelPeriode(sebelum.id)} belum dikunci. Periode dikunci berurutan dari yang paling lama, jadi kunci ${labelPeriode(sebelum.id)} dulu sebelum ${labelPeriode(periode)}.`);
      }
      const belum = (await cekPeriode(periode, undefined, tx)).filter((x) => !x.lulus);
      if (belum.length) throw new GalatAksi(`Pemeriksaan belum lengkap: ${belum.map((x) => x.label.toLowerCase()).join("; ")}.`);
      await pastikanPeriode(tx, periode);
      const n = await tx.periode.updateMany({ where: { id: periode, status: "TERBUKA" }, data: { status: "TERKUNCI", dikunciOleh: pengguna.id, dikunciPada: new Date() } });
      if (n.count !== 1) throw new GalatAksi(`Periode ${labelPeriode(periode)} sudah dikunci.`);
      await tx.riwayatPeriode.create({ data: { periodeId: periode, aksi: "KUNCI", olehId: pengguna.id } });
      await catatLog(tx, pengguna.id, "periode.kunci", "periode", periode);
    }, OPSI_TX);
    segarkan();
    return { pesan: `${labelPeriode(periode)} dikunci.` };
  });
}

export async function bukaKunciPeriode(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["periode.kunci"]);
    const { periode, alasan } = validasi(skemaBukaPeriode, input);
    await db.$transaction(async (tx) => {
      await tahanKunciPeriode(tx, true);
      const ini = await tx.periode.findUnique({ where: { id: periode }, select: { status: true } });
      if (ini?.status !== "TERKUNCI") throw new GalatAksi(`Periode ${labelPeriode(periode)} tidak sedang dikunci.`);
      const sesudah = await tx.periode.findFirst({ where: { id: { gt: periode }, status: "TERKUNCI" }, orderBy: { id: "desc" }, select: { id: true } });
      if (sesudah) {
        throw new GalatAksi(`${labelPeriode(sesudah.id)} masih terkunci. Kunci dibuka berurutan dari periode terakhir, jadi buka kunci ${labelPeriode(sesudah.id)} dulu sebelum ${labelPeriode(periode)}.`);
      }
      const n = await tx.periode.updateMany({ where: { id: periode, status: "TERKUNCI" }, data: { status: "TERBUKA", dikunciOleh: null, dikunciPada: null } });
      if (n.count !== 1) throw new GalatAksi(`Periode ${labelPeriode(periode)} tidak sedang dikunci.`);
      await tx.riwayatPeriode.create({ data: { periodeId: periode, aksi: "BUKA", olehId: pengguna.id, alasan } });
      await catatLog(tx, pengguna.id, "periode.buka", "periode", periode, alasan);
    }, OPSI_TX);
    segarkan();
    return { pesan: `Kunci ${labelPeriode(periode)} dibuka.` };
  });
}
