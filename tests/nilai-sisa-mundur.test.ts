/*
 * Tes integrasi (UJI_DB=1): pembelian perlengkapan bertanggal mundur sesudah opname tidak boleh membuat nilai sisa macet.
 * Regresi audit: sesudah opname Oktober ada pembelian bertanggal September; November ditolak dengan "isi September dulu",
 * September ditolak karena Oktober sudah diinput, dan pembelian itu tidak bisa dibalik. Bulan terlewat sekarang hanya
 * dihitung sesudah opname terakhir.
 * PERHATIAN: database DATABASE_URL diisi ulang dengan data contoh sebelum dan sesudah tes.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const aktif = process.env.UJI_DB === "1";
const sesi: { pengguna: { id: number; namaPengguna: string; nama: string; peran: "ADMIN" | "HRD" | "OWNER" | "KAPTEN" } | null } = { pengguna: null };

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/server/auth", async () => {
  const { GalatAksi } = await import("@/lib/server/aksi");
  return {
    wajibPeran: async (peran: readonly string[]) => {
      if (!sesi.pengguna) throw new GalatAksi("Sesi sudah berakhir.");
      if (!peran.includes(sesi.pengguna.peran)) throw new GalatAksi(`Aksi ini hanya untuk ${peran.join(" atau ")}.`);
      return sesi.pengguna;
    },
  };
});

const seed = () => execSync("npx tsx prisma/seed.ts", { env: { ...process.env, SEED_PAKSA: "1" }, stdio: "pipe" });

describe.runIf(aktif)("nilai sisa sesudah pembelian bertanggal mundur", async () => {
  const { db } = await import("@/lib/server/db");
  const beli = await import("@/lib/aksi/konversi/pembelian");
  const opname = await import("@/lib/aksi/konversi/nilai-sisa");
  const { saldoBukuLkp, periodeNilaiSisa, dataNilaiSisa } = await import("@/lib/data/konversi/nilai-sisa");
  const { bulanNilaiSisaTerlewat } = await import("@/lib/data/konversi/hitung");

  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
  };
  const galat = (h: { ok: boolean; galat?: string }) => (h.ok ? "" : h.galat ?? "");
  const isi = async (P: string, f: (s: number) => number) => (await saldoBukuLkp(db, P)).map((s) => ({ perlengkapanKode: s.kode, nilaiSisa: f(s.saldoBuku) }));

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  it("fungsi murni: bulan sebelum opname terakhir tidak dihitung terlewat, bulan bersaldo sesudahnya tetap terlewat", () => {
    const pembelian = [
      { perlengkapanKode: "A", periode: "2026-09", nilai: 100 },
      { perlengkapanKode: "A", periode: "2026-10", nilai: 100 },
      { perlengkapanKode: "A", periode: "2026-11", nilai: 100 },
    ];
    const beban = [{ perlengkapanKode: "A", periode: "2026-10", beban: 50 }];
    expect(bulanNilaiSisaTerlewat(pembelian, beban, new Set(["2026-10"]), "2026-11")).toBeNull();
    expect(bulanNilaiSisaTerlewat(pembelian, beban, new Set(["2026-10"]), "2026-12")).toBe("2026-11");
    expect(bulanNilaiSisaTerlewat(pembelian, [], new Set(), "2026-11")).toBe("2026-09");
  });

  it("pembelian September diposting sesudah opname Oktober: November tetap bisa diinput dan saldonya memuat pembelian itu", async () => {
    const sebelum = (await saldoBukuLkp(db, "2026-11")).reduce((s, x) => s + x.saldoBuku, 0);
    await masukSebagai("admin");
    const h = await beli.simpanPembelian({
      jenis: "PERLENGKAPAN", tanggal: "2026-09-20", caraBayar: "TUNAI", supplierKode: "SUP-01", keterangan: "uji tanggal mundur",
      baris: [{ barangKode: "LKP-01", qty: 4, harga: 25_000 }], posting: true,
    });
    expect(h.ok).toBe(true);
    expect((await saldoBukuLkp(db, "2026-11")).reduce((s, x) => s + x.saldoBuku, 0)).toBe(sebelum + 100_000);

    // Halaman langsung mengarah ke November, bukan ke September yang tidak mungkin diisi lagi.
    expect((await periodeNilaiSisa()).periode).toBe("2026-11");
    expect((await dataNilaiSisa("2026-11")).tahanUrutan).toBeNull();
    const sep = await opname.simpanNilaiSisa({ periode: "2026-09", nilai: await isi("2026-09", (s) => s) });
    expect(galat(sep)).toMatch(/Nilai sisa Oktober 2026 sudah diinput/);

    const nov = await opname.simpanNilaiSisa({ periode: "2026-11", nilai: await isi("2026-11", (s) => Math.floor(s / 2)) });
    expect(nov.ok).toBe(true);
    expect((await db.opname.findUniqueOrThrow({ where: { periodeId: "2026-11" } })).status).toBe("DRAFT");
  });
});

it.skipIf(aktif)("tes nilai sisa tanggal mundur dilewati (set UJI_DB=1 untuk menjalankan)", () => {});
