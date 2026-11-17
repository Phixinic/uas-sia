/*
 * Tes integrasi angka penyusutan di dashboard (UJI_DB=1). Regresi audit: angka "disetujui" dihitung dari jadwal
 * aset AKTIF saja, jadi aset yang dilepas sesudah penyusutannya disetujui hilang dari angka dashboard
 * (November tertulis 1.532.498, jurnalnya 1.572.081). Sumber kebenaran sekarang jurnal penyusutan yang disetujui.
 * Ikut diuji: periode bawaan halaman SDM sama dengan dashboard, dan tautan dashboard membawa ?periode.
 * PERHATIAN: database DATABASE_URL diisi ulang dengan data contoh sebelum dan sesudah tes.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const aktif = process.env.UJI_DB === "1";
const sesi: { pengguna: { id: number; namaPengguna: string; nama: string; peran: "ADMIN" | "HRD" | "OWNER" } | null } = { pengguna: null };

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

describe.runIf(aktif)("dashboard: penyusutan dan periode", async () => {
  const { db } = await import("@/lib/server/db");
  const susut = await import("@/lib/aksi/konversi/penyusutan");
  const lepas = await import("@/lib/aksi/konversi/pelepasan");
  const { setujuiJurnal } = await import("@/lib/server/jurnal");
  const { dataDashboard } = await import("@/lib/data/pelaporan/dashboard");
  const { periodeDipilih } = await import("@/lib/data/sdm/umum");
  const { periodeIni } = await import("@/lib/inti/tanggal");

  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
  };

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  it("aset dilepas sesudah penyusutannya disetujui tetap terhitung: angka dashboard = jurnal penyusutan November", async () => {
    await masukSebagai("admin");
    const h = await susut.prosesPenyusutan({ periode: "2026-11" });
    expect(h.ok).toBe(true);
    const jurnalNo = h.ok ? h.data!.jurnalNo : "";
    expect((await susut.ajukanJurnalKonversi({ no: jurnalNo })).ok).toBe(true);
    const owner = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "owner" } });
    await db.$transaction((tx) => setujuiJurnal(tx, jurnalNo, owner.id));
    // AST-0003 dilepas 10 November (PLP-2026-0001), sesudah penyusutan Novembernya disetujui.
    await masukSebagai("owner");
    expect((await lepas.setujuiPelepasan({ no: "PLP-2026-0001" })).ok).toBe(true);
    expect((await db.aset.findUniqueOrThrow({ where: { kode: "AST-0003" } })).status).toBe("DILEPAS");

    const jurnal = await db.detailJurnal.aggregate({ where: { jurnalNo }, _sum: { debit: true } });
    const bebanAst3 = (await db.jadwalPenyusutan.findFirstOrThrow({ where: { asetKode: "AST-0003", periodeId: "2026-11" } })).beban;
    const d = await dataDashboard("2026-11");
    expect(d.susut.disetujui).toBe(jurnal._sum.debit);
    expect(d.susut.jadwal).toBe(d.susut.disetujui);
    // Cara lama (jadwal aset AKTIF dengan jurnal disetujui) kehilangan beban AST-0003.
    const lama = await db.jadwalPenyusutan.aggregate({ where: { periodeId: "2026-11", aset: { status: "AKTIF" }, jurnal: { status: "DISETUJUI" } }, _sum: { beban: true } });
    expect((lama._sum.beban ?? 0) + bebanAst3).toBe(d.susut.disetujui);
    expect(bebanAst3).toBeGreaterThan(0);
  });

  it("periode bawaan halaman SDM = periode berjalan (sama dengan dashboard); tautan tindakan membawa ?periode", async () => {
    expect(periodeDipilih()).toBe(periodeIni());
    expect(periodeDipilih("2026-10")).toBe("2026-10");
    // Pengajuan penggajian Oktober yang menunggu: tautannya mendarat di Oktober, bukan di periode yang sedang dilihat.
    await db.penggajian.updateMany({ where: { periodeId: "2026-10" }, data: { status: "DIAJUKAN" } });
    const d = await dataDashboard("2026-11");
    expect(d.tindakan.find((t) => t.judul.includes("pengajuan penggajian"))?.href).toBe("/sdm/distribusi?periode=2026-10");
    for (const t of d.tindakan.filter((x) => x.href.startsWith("/sdm/") || x.href.startsWith("/konversi/penyusutan"))) expect(t.href).toMatch(/\?periode=\d{4}-\d{2}$/);
  });
});

it.skipIf(aktif)("tes dashboard dilewati (set UJI_DB=1 untuk menjalankan)", () => {});
