/*
 * Tes integrasi urutan nilai sisa perlengkapan (UJI_DB=1). Regresi audit: nilai sisa bulan yang lebih awal bisa
 * diisi sesudah bulan berikutnya, sehingga biaya terhitung dua kali dan saldo Perlengkapan bisa minus.
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

describe.runIf(aktif)("urutan nilai sisa perlengkapan", async () => {
  const { db } = await import("@/lib/server/db");
  const opname = await import("@/lib/aksi/konversi/nilai-sisa");
  const { ajukanJurnalKonversi } = await import("@/lib/aksi/konversi/penyusutan");
  const { buatJurnal, saldoAkun, setujuiJurnal } = await import("@/lib/server/jurnal");
  const { saldoBukuLkp, dataNilaiSisa } = await import("@/lib/data/konversi/nilai-sisa");

  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
  };
  const galat = (h: { ok: boolean; galat?: string }) => (h.ok ? "" : h.galat ?? "");
  const isi = async (P: string, f: (s: number) => number) => (await saldoBukuLkp(db, P)).map((s) => ({ perlengkapanKode: s.kode, nilaiSisa: f(s.saldoBuku) }));
  /** Status opname Oktober beserta jurnalnya, untuk mensimulasikan keadaan lama. */
  const statusOktober = async (s: "DIAJUKAN" | "DISETUJUI" | "DITOLAK") => {
    const o = await db.opname.findUniqueOrThrow({ where: { periodeId: "2026-10" } });
    await db.opname.update({ where: { no: o.no }, data: { status: s } });
    if (o.jurnalNo) await db.jurnal.update({ where: { no: o.jurnalNo }, data: { status: s } });
  };
  const jurnalKurangiPerlengkapan = async (nilai: number) => {
    const admin = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "admin" } });
    return db.$transaction((tx) => buatJurnal(tx, { tanggal: "2026-11-15", jenis: "UMUM", status: "DISETUJUI", keterangan: "uji kurangi perlengkapan", baris: [{ akun: "6-120", debit: nilai, kredit: 0 }, { akun: "1-140", debit: 0, kredit: nilai }], dibuatOlehId: admin.id }));
  };

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  it("bulan sebelumnya belum disetujui: nilai sisa November ditolak, form ikut ditahan", async () => {
    await statusOktober("DIAJUKAN");
    await masukSebagai("admin");
    const h = await opname.simpanNilaiSisa({ periode: "2026-11", nilai: await isi("2026-11", (s) => Math.floor(s / 2)) });
    expect(galat(h)).toMatch(/Nilai sisa Oktober 2026 belum disetujui Owner/);
    expect((await dataNilaiSisa("2026-11")).tahanUrutan).toMatch(/Oktober 2026 belum disetujui/);
    await statusOktober("DISETUJUI");
  });

  it("bulan sebelumnya terlewat (opname Oktober ditolak, masih bersaldo): November ditolak", async () => {
    await statusOktober("DITOLAK");
    await masukSebagai("admin");
    const h = await opname.simpanNilaiSisa({ periode: "2026-11", nilai: await isi("2026-11", (s) => Math.floor(s / 2)) });
    expect(galat(h)).toMatch(/Nilai sisa Oktober 2026 belum diinput/);
    await statusOktober("DISETUJUI");
  });

  it("penjaga: biaya yang membuat saldo akun Perlengkapan minus ditolak", async () => {
    const saldoBuku = (await saldoBukuLkp(db, "2026-11")).reduce((s, x) => s + x.saldoBuku, 0);
    const no = await jurnalKurangiPerlengkapan(saldoBuku - 100_000);
    expect(await saldoAkun(db, "1-140", "2026-11")).toBe(100_000);
    await masukSebagai("admin");
    const h = await opname.simpanNilaiSisa({ periode: "2026-11", nilai: await isi("2026-11", () => 0) });
    expect(galat(h)).toMatch(/melebihi saldo akun Perlengkapan sampai November 2026.*minus/);
    expect(await db.opname.count({ where: { periodeId: "2026-11" } })).toBe(0);
    await db.jurnal.delete({ where: { no } });
  });

  it("nilai sisa Oktober tidak bisa diinput ulang sesudah November diinput: biaya tidak terhitung dua kali", async () => {
    await masukSebagai("admin");
    const nov = await opname.simpanNilaiSisa({ periode: "2026-11", nilai: await isi("2026-11", (s) => Math.floor(s / 2)) });
    expect(nov.ok).toBe(true);
    // Keadaan yang dulu bisa terjadi: opname Oktober ditolak sesudah November diinput.
    await statusOktober("DITOLAK");
    const jurnalSebelum = await db.jurnal.count();
    const saldoSebelum = await saldoAkun(db, "1-140", "2026-11");
    const okt = await opname.simpanNilaiSisa({ periode: "2026-10", nilai: await isi("2026-10", (s) => Math.floor(s / 2)) });
    expect(galat(okt)).toMatch(/Nilai sisa November 2026 sudah diinput, jadi nilai sisa Oktober 2026 tidak bisa diinput atau diubah lagi/);
    expect(await db.jurnal.count()).toBe(jurnalSebelum);
    expect(await saldoAkun(db, "1-140", "2026-11")).toBe(saldoSebelum);
    expect((await db.opname.findUniqueOrThrow({ where: { periodeId: "2026-10" } })).status).toBe("DITOLAK");
    expect((await dataNilaiSisa("2026-10")).tahanUrutan).toMatch(/November 2026 sudah diinput/);
    await statusOktober("DISETUJUI");
  });

  it("penjaga saat persetujuan: jurnal biaya perlengkapan yang membuat saldo minus tidak bisa disetujui", async () => {
    const o = await db.opname.findUniqueOrThrow({ where: { periodeId: "2026-11" } });
    await masukSebagai("admin");
    expect((await ajukanJurnalKonversi({ no: o.jurnalNo! })).ok).toBe(true);
    const saldo = await saldoAkun(db, "1-140", "2026-11");
    const no = await jurnalKurangiPerlengkapan(saldo - o.totalBeban + 1);
    const owner = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "owner" } });
    await expect(db.$transaction((tx) => setujuiJurnal(tx, o.jurnalNo!, owner.id))).rejects.toThrow(/Perlengkapan minus/);
    await db.jurnal.delete({ where: { no } });
    await db.$transaction((tx) => setujuiJurnal(tx, o.jurnalNo!, owner.id));
    expect(await saldoAkun(db, "1-140", "2026-11")).toBe(saldo - o.totalBeban);
    expect(saldo - o.totalBeban).toBeGreaterThanOrEqual(0);
  });
});

it.skipIf(aktif)("tes urutan nilai sisa dilewati (set UJI_DB=1 untuk menjalankan)", () => {});
