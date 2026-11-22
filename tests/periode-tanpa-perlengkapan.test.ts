/*
 * Tes integrasi (UJI_DB=1): bulan tanpa saldo perlengkapan tetap bisa dikunci.
 * Regresi audit: input nilai sisa ditolak dengan "Tidak ada perlengkapan untuk dihitung", tetapi daftar periksa tutup
 * periode tetap meminta opname, sehingga bulan itu dan (karena kunci berurutan) semua bulan sesudahnya tidak bisa dikunci.
 * Skenario: semua perlengkapan habis dipakai di Oktober (nilai sisa Oktober nol), jadi November tidak bersaldo.
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

describe.runIf(aktif)("kunci bulan tanpa saldo perlengkapan", async () => {
  const { db } = await import("@/lib/server/db");
  const opname = await import("@/lib/aksi/konversi/nilai-sisa");
  const susut = await import("@/lib/aksi/konversi/penyusutan");
  const lepas = await import("@/lib/aksi/konversi/pelepasan");
  const beli = await import("@/lib/aksi/konversi/pembelian");
  const periode = await import("@/lib/aksi/pelaporan/periode");
  const { setujuiJurnal } = await import("@/lib/server/jurnal");
  const { saldoBukuLkp } = await import("@/lib/data/konversi/nilai-sisa");
  const { cekPeriode } = await import("@/lib/data/pelaporan/periode");

  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
    return p;
  };
  const galat = (h: { ok: boolean; galat?: string }) => (h.ok ? "" : h.galat ?? "");
  const butirOpname = async (P: string) => (await cekPeriode(P)).find((x) => x.label === "Nilai sisa perlengkapan sudah diinput")!;
  const setujui = async (no: string) => {
    const owner = await masukSebagai("owner");
    await db.$transaction((tx) => setujuiJurnal(tx, no, owner.id));
  };

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  it("semua perlengkapan habis di Oktober: November tidak bersaldo dan tidak diminta nilai sisa", async () => {
    // Opname Oktober contoh dianggap ditolak Owner, lalu Admin menginput ulang: semua barang habis (nilai sisa 0).
    const lama = await db.opname.findUniqueOrThrow({ where: { periodeId: "2026-10" } });
    await db.opname.update({ where: { no: lama.no }, data: { status: "DITOLAK" } });
    await db.jurnal.update({ where: { no: lama.jurnalNo! }, data: { status: "DITOLAK" } });
    expect((await butirOpname("2026-11")).lulus).toBe(false); // November masih bersaldo selama Oktober belum diinput ulang

    await masukSebagai("admin");
    const okt = await opname.simpanNilaiSisa({ periode: "2026-10", nilai: (await saldoBukuLkp(db, "2026-10")).map((s) => ({ perlengkapanKode: s.kode, nilaiSisa: 0 })) });
    expect(okt.ok).toBe(true);
    const baru = await db.opname.findUniqueOrThrow({ where: { periodeId: "2026-10" } });
    expect((await susut.ajukanJurnalKonversi({ no: baru.jurnalNo! })).ok).toBe(true);
    await setujui(baru.jurnalNo!);

    expect(await saldoBukuLkp(db, "2026-11")).toEqual([]);
    await masukSebagai("admin");
    expect(galat(await opname.simpanNilaiSisa({ periode: "2026-11", nilai: [] }))).toMatch(/Tidak ada perlengkapan untuk dihitung/);
    expect(await butirOpname("2026-11")).toEqual({ label: "Nilai sisa perlengkapan sudah diinput", lulus: true, catatan: "tidak ada saldo perlengkapan" });
    expect((await butirOpname("2026-10")).lulus).toBe(true);
  });

  it("November tanpa saldo perlengkapan bisa dikunci sesudah Oktober, jadi bulan sesudahnya tidak ikut tertahan", async () => {
    // Selesaikan pekerjaan November yang lain: draf pembelian, penyusutan, dan pengajuan pelepasan.
    await masukSebagai("admin");
    expect((await beli.hapusPembelian({ no: "BP-2026-0007" })).ok).toBe(true);
    const h = await susut.prosesPenyusutan({ periode: "2026-11" });
    expect(h.ok).toBe(true);
    const jurnalNo = h.ok ? h.data!.jurnalNo : "";
    expect((await susut.ajukanJurnalKonversi({ no: jurnalNo })).ok).toBe(true);
    await setujui(jurnalNo);
    expect((await lepas.tolakPelepasan({ no: "PLP-2026-0001", alasan: "uji kunci bulan tanpa saldo" })).ok).toBe(true);

    expect((await cekPeriode("2026-11")).filter((x) => !x.lulus)).toEqual([]);
    expect((await periode.kunciPeriode({ periode: "2026-10" })).ok).toBe(true);
    const nov = await periode.kunciPeriode({ periode: "2026-11" });
    expect(galat(nov)).toBe("");
    expect((await db.periode.findUniqueOrThrow({ where: { id: "2026-11" } })).status).toBe("TERKUNCI");
  });
});

it.skipIf(aktif)("tes kunci bulan tanpa saldo dilewati (set UJI_DB=1 untuk menjalankan)", () => {});
