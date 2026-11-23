/*
 * Tes integrasi Investasi Kas lewat server action terhadap database sungguhan (UJI_DB=1): catat, setujui (jurnal benar),
 * tolak, akses terlarang (HRD, Kapten, Admin menyetujui), periode tertutup, dashboard Owner, dan ringkasan = buku besar.
 * PERHATIAN: tes ini mengisi ulang database DATABASE_URL dengan data contoh (seed) sebelum dan sesudah berjalan.
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

describe.runIf(aktif)("Investasi Kas lewat server action", async () => {
  const { db } = await import("@/lib/server/db");
  const inv = await import("@/lib/aksi/modal/investasi-kas");
  const { saldoAkun } = await import("@/lib/server/jurnal");
  const { ringkasanKasModal } = await import("@/lib/data/modal/investasi-kas");
  const { dataDashboard } = await import("@/lib/data/pelaporan/dashboard");
  const { IZIN } = await import("@/lib/peran");
  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
  };
  const setoran = { tanggal: "2026-11-05", jumlah: 12_500_000, keterangan: "Setoran pemilik dari rekening pribadi" };

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  it("seed: dua setoran modal data contoh tercatat sebagai Investasi Kas DISETUJUI yang menunjuk jurnalnya", async () => {
    const daftar = await db.investasiKas.findMany({ orderBy: { no: "asc" }, include: { jurnal: true } });
    expect(daftar.map((s) => [s.no, s.jumlah, s.status, s.jurnalNo, s.jurnal?.sumberTipe, s.jurnal?.sumberId])).toEqual([
      ["INV-2026-0001", 30_000_000, "DISETUJUI", "JU-2026-0001", "INVESTASI_KAS", "INV-2026-0001"],
      ["INV-2026-0002", 75_000_000, "DISETUJUI", "JU-2026-0010", "INVESTASI_KAS", "INV-2026-0002"],
    ]);
    expect(await db.jurnal.count({ where: { sumberTipe: "SALDO_AWAL" } })).toBe(0);
  });

  it("izin: halaman dan aksi hanya Admin dan Owner; menyetujui hanya Owner", () => {
    expect(IZIN["investasi-kas.lihat"]).toEqual(["ADMIN", "OWNER"]);
    expect(IZIN["investasi-kas.catat"]).toEqual(["ADMIN", "OWNER"]);
    expect(IZIN["investasi-kas.putuskan"]).toEqual(["OWNER"]);
  });

  it("HRD dan Kapten tidak bisa mencatat setoran", async () => {
    for (const u of ["hrd", "kapten"]) {
      await masukSebagai(u);
      const h = await inv.catatInvestasiKas(setoran);
      expect(h.ok).toBe(false);
    }
    expect(await db.investasiKas.count()).toBe(2);
  });

  let no = "";
  it("Admin mencatat: DIAJUKAN tanpa jurnal, nomor INV melanjutkan data contoh, isian salah ditolak per isian", async () => {
    await masukSebagai("admin");
    const salah = await inv.catatInvestasiKas({ tanggal: "", jumlah: "0", keterangan: "" });
    expect(salah.ok).toBe(false);
    if (!salah.ok) expect(Object.keys(salah.galatIsian ?? {}).sort()).toEqual(["jumlah", "keterangan", "tanggal"]);
    const jurnalSebelum = await db.jurnal.count();
    const h = await inv.catatInvestasiKas(setoran);
    expect(h.ok).toBe(true);
    no = h.ok ? h.data!.no : "";
    expect(no).toBe("INV-2026-0003");
    const s = await db.investasiKas.findUniqueOrThrow({ where: { no } });
    expect([s.status, s.jumlah, s.jurnalNo, s.keterangan]).toEqual(["DIAJUKAN", 12_500_000, null, setoran.keterangan]);
    expect(await db.jurnal.count()).toBe(jurnalSebelum);
  });

  it("dashboard Owner: setoran menunggu muncul di Perlu tindakan", async () => {
    const d = await dataDashboard("2026-11");
    const t = d.tindakan.find((x) => x.href === "/modal/investasi-kas");
    expect(t?.peran).toEqual(["OWNER"]);
    expect(t?.judul).toMatch(/1 setoran modal menunggu keputusan/);
    expect(d.menunggu.setoran).toBe(1);
  });

  it("Admin dan HRD tidak bisa menyetujui atau menolak", async () => {
    for (const u of ["admin", "hrd"]) {
      await masukSebagai(u);
      expect((await inv.setujuiInvestasiKas({ no })).ok).toBe(false);
      expect((await inv.tolakInvestasiKas({ no, alasan: "coba" })).ok).toBe(false);
    }
    expect((await db.investasiKas.findUniqueOrThrow({ where: { no } })).status).toBe("DIAJUKAN");
  });

  it("Owner menyetujui: jurnal umum DISETUJUI Dr Kas, Kr Modal bertanggal setoran; kas naik; tidak bisa diputuskan dua kali", async () => {
    const kasSebelum = await saldoAkun(db, "1-110");
    await masukSebagai("owner");
    const owner = sesi.pengguna!;
    const h = await inv.setujuiInvestasiKas({ no });
    expect(h.ok).toBe(true);
    const s = await db.investasiKas.findUniqueOrThrow({ where: { no }, include: { jurnal: { include: { detail: { orderBy: { noUrut: "asc" } } } } } });
    expect([s.status, s.jurnalNo, s.diputuskanOlehId]).toEqual(["DISETUJUI", "JU-2026-0012", owner.id]);
    const jr = s.jurnal!;
    expect([jr.jenis, jr.status, jr.sumberTipe, jr.sumberId, jr.periodeId, jr.tanggal.toISOString().slice(0, 10), jr.disetujuiOlehId]).toEqual(["UMUM", "DISETUJUI", "INVESTASI_KAS", no, "2026-11", "2026-11-05", owner.id]);
    expect(jr.detail.map((d) => [d.akunKode, d.debit, d.kredit])).toEqual([["1-110", 12_500_000, 0], ["3-110", 0, 12_500_000]]);
    expect(await saldoAkun(db, "1-110")).toBe(kasSebelum + 12_500_000);
    expect((await inv.setujuiInvestasiKas({ no })).ok).toBe(false);
    expect((await inv.tolakInvestasiKas({ no, alasan: "terlambat" })).ok).toBe(false);
  });

  it("Owner menolak setoran lain: alasan wajib, tanpa jurnal", async () => {
    await masukSebagai("admin");
    const h = await inv.catatInvestasiKas({ ...setoran, jumlah: 1_000_000, keterangan: "Salah ketik nominal" });
    const no2 = h.ok ? h.data!.no : "";
    await masukSebagai("owner");
    expect((await inv.tolakInvestasiKas({ no: no2, alasan: "  " })).ok).toBe(false);
    const t = await inv.tolakInvestasiKas({ no: no2, alasan: "Nominal tidak sesuai bukti transfer" });
    expect(t.ok).toBe(true);
    const s = await db.investasiKas.findUniqueOrThrow({ where: { no: no2 } });
    expect([s.status, s.alasanTolak, s.jurnalNo]).toEqual(["DITOLAK", "Nominal tidak sesuai bukti transfer", null]);
    expect((await inv.setujuiInvestasiKas({ no: no2 })).ok).toBe(false);
  });

  it("periode tertutup menolak catat dan persetujuan setoran bertanggal di dalamnya", async () => {
    await masukSebagai("owner");
    const h = await inv.catatInvestasiKas({ ...setoran, tanggal: "2026-10-20" });
    expect(h.ok).toBe(true);
    const no3 = h.ok ? h.data!.no : "";
    await db.periode.update({ where: { id: "2026-10" }, data: { status: "TERKUNCI" } });
    try {
      const s = await inv.setujuiInvestasiKas({ no: no3 });
      expect(s.ok).toBe(false);
      if (!s.ok) expect(s.galat).toMatch(/sudah dikunci/);
      const c = await inv.catatInvestasiKas({ ...setoran, tanggal: "2026-10-21" });
      expect(c.ok).toBe(false);
      expect((await db.investasiKas.findUniqueOrThrow({ where: { no: no3 } })).status).toBe("DIAJUKAN");
    } finally {
      await db.periode.update({ where: { id: "2026-10" }, data: { status: "TERBUKA" } });
    }
  });

  it("CHECK tabel: setoran DISETUJUI tanpa jurnal dan jumlah 0 ditolak database", async () => {
    const u = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "admin" } });
    await expect(db.investasiKas.create({ data: { no: "INV-UJI-1", tanggal: new Date("2026-11-01"), jumlah: 1, keterangan: "uji", status: "DISETUJUI", dibuatOlehId: u.id } })).rejects.toThrow();
    await expect(db.investasiKas.create({ data: { no: "INV-UJI-2", tanggal: new Date("2026-11-01"), jumlah: 0, keterangan: "uji", dibuatOlehId: u.id } })).rejects.toThrow();
  });

  it("ringkasan kas dan modal = saldo buku besar, kumulatif dan per periode", async () => {
    for (const p of [null, "2026-10", "2026-11"]) {
      const { ringkasan, bukuBesar } = await ringkasanKasModal(p);
      expect(bukuBesar.kasCocok && bukuBesar.modalCocok, `rentang ${p}`).toBe(true);
      expect(ringkasan.biayaSdm.dibayar).toBe(ringkasan.kas.keluar.sdm);
    }
    const { ringkasan } = await ringkasanKasModal(null);
    expect(ringkasan.modal.setoranKas.jumlah).toBe(30_000_000 + 75_000_000 + 12_500_000);
    expect(ringkasan.modal.setoranBarang.jumlah).toBe(3_800_000);
  });
});
it.skipIf(aktif)("tes database Investasi Kas dilewati (set UJI_DB=1 untuk menjalankan)", () => {});
