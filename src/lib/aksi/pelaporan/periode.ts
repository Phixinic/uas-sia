"use server";

/*
 * Server action tutup periode: kunci (Owner, hanya bila daftar periksa lulus) dan buka kunci (Owner, alasan wajib).
 * Setiap perubahan dicatat di riwayat_periode dan log aktivitas.
 */
import { db } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { pastikanPeriode } from "@/lib/server/periode";
import { catatLog } from "@/lib/server/log";
import { cekPeriode } from "@/lib/data/pelaporan/periode";
import { skemaBukaPeriode, skemaPeriode } from "@/lib/skema/pelaporan";
import { labelPeriode } from "@/lib/inti/tanggal";

export async function kunciPeriode(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["periode.kunci"]);
    const { periode } = validasi(skemaPeriode, input);
    const belum = (await cekPeriode(periode)).filter((x) => !x.lulus);
    if (belum.length) throw new GalatAksi(`Pemeriksaan belum lengkap: ${belum.map((x) => x.label.toLowerCase()).join("; ")}.`);
    await db.$transaction(async (tx) => {
      await pastikanPeriode(tx, periode);
      const n = await tx.periode.updateMany({ where: { id: periode, status: "TERBUKA" }, data: { status: "TERKUNCI", dikunciOleh: pengguna.id, dikunciPada: new Date() } });
      if (n.count !== 1) throw new GalatAksi(`Periode ${labelPeriode(periode)} sudah dikunci.`);
      await tx.riwayatPeriode.create({ data: { periodeId: periode, aksi: "KUNCI", olehId: pengguna.id } });
      await catatLog(tx, pengguna.id, "periode.kunci", "periode", periode);
    });
    segarkan();
    return { pesan: `${labelPeriode(periode)} dikunci.` };
  });
}

export async function bukaKunciPeriode(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["periode.kunci"]);
    const { periode, alasan } = validasi(skemaBukaPeriode, input);
    await db.$transaction(async (tx) => {
      const n = await tx.periode.updateMany({ where: { id: periode, status: "TERKUNCI" }, data: { status: "TERBUKA", dikunciOleh: null, dikunciPada: null } });
      if (n.count !== 1) throw new GalatAksi(`Periode ${labelPeriode(periode)} tidak sedang dikunci.`);
      await tx.riwayatPeriode.create({ data: { periodeId: periode, aksi: "BUKA", olehId: pengguna.id, alasan } });
      await catatLog(tx, pengguna.id, "periode.buka", "periode", periode, alasan);
    });
    segarkan();
    return { pesan: `Kunci ${labelPeriode(periode)} dibuka.` };
  });
}
