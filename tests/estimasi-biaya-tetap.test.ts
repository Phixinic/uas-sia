/*
 * Tes integrasi estimasi biaya tetap penggajian (UJI_DB=1): gaji pokok dan tunjangan tetap dari setting gaji yang
 * berlaku, karyawan inhouse aktif saja, tampil di ringkasan hanya untuk bulan yang belum diajukan, tanpa menulis data.
 * PERHATIAN: database DATABASE_URL diisi ulang dengan data contoh sebelum dan sesudah tes.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const aktif = process.env.UJI_DB === "1";
const seed = () => execSync("npx tsx prisma/seed.ts", { env: { ...process.env, SEED_PAKSA: "1" }, stdio: "pipe" });

describe.runIf(aktif)("estimasi biaya tetap penggajian", async () => {
  const { db } = await import("@/lib/server/db");
  const { dataSettingGaji, estimasiBiayaTetap } = await import("@/lib/data/master/setting-gaji");
  const { ringkasanTahunGaji } = await import("@/lib/data/sdm/gaji");

  /** Pembanding: jumlah "Estimasi bruto" halaman Setting Gaji untuk karyawan aktif yang punya setting berlaku. */
  const dariSettingGaji = async (periode: string) => {
    const berlaku = (await dataSettingGaji(periode)).baris.filter((b) => b.aktif).flatMap((b) => b.aktifSekarang ?? []);
    return { total: berlaku.reduce((s, v) => s + v.estimasiBruto, 0), karyawan: berlaku.length };
  };
  const jumlahData = async () => [await db.slipGaji.count(), await db.penggajian.count(), await db.jurnal.count(), await db.settingGaji.count()];

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  it("sama dengan jumlah estimasi bruto setting gaji yang berlaku di tiap bulan, dan tidak menulis data", async () => {
    const sebelum = await jumlahData();
    const bulan = ["2026-10", "2026-12", "2027-01"];
    const e = await estimasiBiayaTetap(bulan);
    for (const p of bulan) {
      expect(e.get(p), p).toEqual(await dariSettingGaji(p));
      expect(e.get(p)!.total, p).toBeGreaterThan(0);
    }
    expect(await jumlahData()).toEqual(sebelum);
  });

  it("bulan sebelum ada setting gaji tidak punya estimasi", async () => {
    expect((await estimasiBiayaTetap(["2025-12"])).size).toBe(0);
  });

  it("karyawan nonaktif tidak dihitung", async () => {
    const semula = (await estimasiBiayaTetap(["2026-12"])).get("2026-12")!;
    const milik = (await dataSettingGaji("2026-12")).baris.find((b) => b.kode === "KRY-01")!.aktifSekarang!;
    await db.karyawan.update({ where: { kode: "KRY-01" }, data: { aktif: false } });
    try {
      expect((await estimasiBiayaTetap(["2026-12"])).get("2026-12")).toEqual({ total: semula.total - milik.estimasiBruto, karyawan: semula.karyawan - 1 });
    } finally {
      await db.karyawan.update({ where: { kode: "KRY-01" }, data: { aktif: true } });
    }
  });

  it("ringkasan tahunan: bulan dibayar memakai THP, bulan belum diajukan memakai estimasi", async () => {
    const r = await ringkasanTahunGaji(2026);
    const bulan = (p: string) => r.find((x) => x.periode === p)!;
    expect([bulan("2026-10").status, bulan("2026-10").estimasi]).toEqual(["DIBAYAR", null]);
    expect(bulan("2026-10").thp).toBeGreaterThan(0);
    expect(bulan("2026-12").estimasi).toBe((await dariSettingGaji("2026-12")).total);
    // Tahun tanpa setting gaji: semua bulan tanpa estimasi.
    expect((await ringkasanTahunGaji(2025)).every((x) => x.estimasi === null)).toBe(true);
  });
});
