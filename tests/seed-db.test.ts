/*
 * Tes integrasi: memeriksa isi database sesudah `npm run db:seed` sama dengan data app lama.
 * Hanya jalan bila UJI_DB=1 (butuh DATABASE_URL yang sudah dimigrasi dan di-seed): npm run uji:db
 */
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { muatAppLama, koleksi } from "./app-lama";

const aktif = process.env.UJI_DB === "1";

describe.runIf(aktif)("isi database hasil seed", async () => {
  const { db } = await import("@/lib/server/db");
  const { muatJurnalBuku, saldoAkun } = await import("@/lib/server/jurnal");
  const { neracaSaldo } = await import("@/lib/inti/buku-besar");
  const { hitungJadwal } = await import("@/lib/inti/penyusutan");
  const { seed, jalankan } = muatAppLama();
  afterAll(() => db.$disconnect());

  it("jumlah baris tiap tabel sama dengan data lama", async () => {
    expect(await db.jurnal.count()).toBe(Object.keys(seed.jurnal).length);
    expect(await db.pembelian.count()).toBe(Object.keys(seed.pembelian).length);
    expect(await db.aset.count()).toBe(Object.keys(seed.aset).length);
    expect(await db.presensi.count()).toBe(Object.keys(seed.presensi).length);
    expect(await db.slipGaji.count()).toBe(Object.keys(seed.slip).length);
    expect(await db.pengguna.count()).toBe(3);
  });

  it("neraca saldo s.d. Oktober 2026 dari database seimbang Rp145.622.573", async () => {
    const akun = (await db.akun.findMany({ select: { kode: true } })).map((a) => a.kode);
    const ns = neracaSaldo(await muatJurnalBuku(db, "2026-10"), akun, "2026-10");
    expect([ns.debit, ns.kredit]).toEqual([145_622_573, 145_622_573]);
  });

  it("saldo kas lewat agregasi SQL sama dengan app lama", async () => {
    expect(await saldoAkun(db, "1-110", "2026-10")).toBe(jalankan<number>("saldo('1-110','2026-10')"));
  });

  it("jadwal penyusutan tiap aset di database = rumus = seed lama", async () => {
    const lama = koleksi<{ jadwal: { p: number; beban: number; jurnal_id: string | null }[] }>(seed, "aset");
    for (const a of await db.aset.findMany({ include: { jadwal: { orderBy: { periodeKe: "asc" } } } })) {
      const h = hitungJadwal(a.nilaiPerolehan, a.residu, a.n, a.bulanMulai);
      expect(a.jadwal.map((r) => [r.periodeKe, r.periodeId, r.beban, r.akumulasi, r.nilaiBuku])).toEqual(h.baris.map((r) => [r.periodeKe, r.periode, r.beban, r.akumulasi, r.nilaiBuku]));
      const l = lama.find((x) => x.id === a.kode)!;
      expect(a.jadwal.map((r) => r.jurnalNo)).toEqual(l.jadwal.map((r) => r.jurnal_id));
    }
  });

  it("slip Oktober: total bruto, PPh 21, THP; penggajian yang tidak ditolak punya minimal satu slip", async () => {
    const s = await db.slipGaji.aggregate({ where: { periodeId: "2026-10" }, _sum: { bruto: true, pph21: true, thp: true } });
    expect([s._sum.bruto, s._sum.pph21, s._sum.thp]).toEqual([31_500_001, 299_658, 31_200_343]);
    // Penggajian DITOLAK melepas slipnya (relasi penggajian -> slip_gaji digambar 0..N di logical database).
    for (const g of await db.penggajian.findMany({ where: { status: { not: "DITOLAK" } }, include: { _count: { select: { slip: true } } } })) expect(g._count.slip).toBeGreaterThan(0);
  });
});

it.skipIf(aktif)("tes database dilewati (set UJI_DB=1 untuk menjalankan)", () => {});
