/*
 * Sumber investasi pada pembelian cara bayar Investasi: Pemilik (3-110), Investor (3-120), Hibah (3-130).
 * Bagian skema jalan tanpa database. Bagian alur jalan bila UJI_DB=1 dan mengisi ulang database DATABASE_URL
 * dengan data contoh (seed) sebelum dan sesudah tes. Sesi dan revalidatePath ditiru dengan vi.mock.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { skemaPembelian } from "@/lib/skema/pembelian";

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

const perlengkapan = { jenis: "PERLENGKAPAN", tanggal: "2026-11-05", baris: [{ barangKode: "LKP-01", qty: 4, harga: 50_000 }] };

describe("skema pembelian: sumber investasi", () => {
  it("Investasi boleh tanpa supplier dan tanpa sumber (server mengisi Pemilik); sumber tak dikenal ditolak", () => {
    expect(skemaPembelian.safeParse({ ...perlengkapan, caraBayar: "INVESTASI" }).success).toBe(true);
    expect(skemaPembelian.safeParse({ ...perlengkapan, caraBayar: "INVESTASI", sumberInvestasi: "HIBAH" }).success).toBe(true);
    const salah = skemaPembelian.safeParse({ ...perlengkapan, caraBayar: "INVESTASI", sumberInvestasi: "TEMAN" });
    expect(salah.success).toBe(false);
    if (!salah.success) expect(salah.error.issues.find((i) => i.path[0] === "sumberInvestasi")?.message).toBe("Pilih sumber investasi.");
  });
  it("Tunai tetap wajib supplier walau sumber diisi", () => {
    const h = skemaPembelian.safeParse({ ...perlengkapan, caraBayar: "TUNAI", sumberInvestasi: "INVESTOR" });
    expect(h.success).toBe(false);
    if (!h.success) expect(h.error.issues.map((i) => i.path[0])).toContain("supplierKode");
  });
});

describe.runIf(aktif)("alur pembelian Investasi per sumber (database)", async () => {
  const seed = () => execSync("npx tsx prisma/seed.ts", { env: { ...process.env, SEED_PAKSA: "1" }, stdio: "pipe" });
  const { db } = await import("@/lib/server/db");
  const aksi = await import("@/lib/aksi/konversi/pembelian");
  const { muatJurnalBuku, saldoAkun } = await import("@/lib/server/jurnal");
  const { neracaSaldo } = await import("@/lib/inti/buku-besar");
  const { ringkasanKasModal } = await import("@/lib/data/modal/investasi-kas");
  const { daftarPembelian } = await import("@/lib/data/konversi/pembelian");
  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
  };
  const neraca = async () => neracaSaldo(await muatJurnalBuku(db), (await db.akun.findMany()).map((a) => a.kode), null);
  const baris = (detail: { akunKode: string; debit: number; kredit: number }[]) => detail.map((d) => [d.akunKode, d.debit, d.kredit]);

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  it("seed punya akun 3-120 Modal Investor dan 3-130 Modal Hibah, dan pembelian Investasi lama bersumber Pemilik", async () => {
    const akun = await db.akun.findMany({ where: { kode: { in: ["3-120", "3-130"] } }, orderBy: { kode: "asc" } });
    expect(akun.map((a) => [a.kode, a.nama, a.tipe, a.saldoNormal])).toEqual([["3-120", "Modal Investor", "EKUITAS", "K"], ["3-130", "Modal Hibah", "EKUITAS", "K"]]);
    const inv = await db.pembelian.findMany({ where: { caraBayar: "INVESTASI" }, select: { sumberInvestasi: true } });
    expect(inv.length).toBeGreaterThan(0);
    expect(inv.every((b) => b.sumberInvestasi === "PEMILIK")).toBe(true);
    expect(await db.pembelian.count({ where: { caraBayar: { not: "INVESTASI" }, sumberInvestasi: { not: null } } })).toBe(0);
  });

  let no = "";
  it("Investor: posting Dr Peralatan, Kr 3-120; kas dan Modal Pemilik tetap; ringkasan sama dengan buku besar", async () => {
    await masukSebagai("admin");
    const kas = await saldoAkun(db, "1-110");
    const modalPemilik = await saldoAkun(db, "3-110");
    const h = await aksi.simpanPembelian({
      jenis: "PERALATAN", tanggal: "2026-11-05", caraBayar: "INVESTASI", sumberInvestasi: "INVESTOR", supplierKode: "", posting: true,
      baris: [{ barangKode: "ALT-05", qty: 2, harga: 950_000, residu: 0, garansiBulan: 24, masaManfaatBulan: 24, dasarN: "GARANSI" }],
    });
    expect(h.ok).toBe(true);
    no = h.ok ? h.data!.no : "";
    const b = await db.pembelian.findUniqueOrThrow({ where: { no }, include: { jurnal: { include: { detail: { orderBy: { noUrut: "asc" } } } }, detail: { include: { aset: true } } } });
    expect([b.status, b.caraBayar, b.sumberInvestasi, b.supplierKode]).toEqual(["DISETUJUI", "INVESTASI", "INVESTOR", null]);
    expect(baris(b.jurnal!.detail)).toEqual([["1-150", 1_900_000, 0], ["3-120", 0, 1_900_000]]);
    expect(b.jurnal!.keterangan).toBe(`Pembelian peralatan ${no}, Setoran investor (Investasi, Investor)`);
    expect(b.detail[0].aset).toHaveLength(2);
    expect(await saldoAkun(db, "1-110")).toBe(kas);
    expect(await saldoAkun(db, "3-110")).toBe(modalPemilik);
    expect(await saldoAkun(db, "3-120")).toBe(1_900_000);

    const { ringkasan, bukuBesar } = await ringkasanKasModal(null);
    expect(bukuBesar).toMatchObject({ kasCocok: true, modalCocok: true, modalInvestorCocok: true, modalHibahCocok: true, modalInvestor: 1_900_000 });
    expect(ringkasan.modalInvestor.setoranBarang.rincian.map((r) => [r.sumberId, r.jumlah])).toEqual([[no, 1_900_000]]);
    expect(ringkasan.totalModal.akhir).toBe(modalPemilik + 1_900_000);
    const nov = await ringkasanKasModal("2026-11");
    expect(nov.bukuBesar.modalInvestorCocok).toBe(true);
    expect(nov.ringkasan.modalInvestor.setoranBarang.jumlah).toBe(1_900_000);

    const daftar = await daftarPembelian("PERALATAN");
    expect(daftar.find((x) => x.no === no)).toMatchObject({ supplier: "Setoran investor", caraBayar: "INVESTASI", sumberInvestasi: "INVESTOR" });
    expect((await neraca()).seimbang).toBe(true);
  });

  it("Owner membalik: jurnal pembalik Dr 3-120, saldo Modal Investor kembali 0", async () => {
    await masukSebagai("owner");
    const h = await aksi.balikPembelian({ no, alasan: "Investor membatalkan setoran" });
    expect(h.ok).toBe(true);
    const b = await db.pembelian.findUniqueOrThrow({ where: { no }, include: { jurnalPembalik: { include: { detail: { orderBy: { noUrut: "asc" } } } } } });
    expect(b.status).toBe("DIBALIK");
    expect(baris(b.jurnalPembalik!.detail)).toEqual([["1-150", 0, 1_900_000], ["3-120", 1_900_000, 0]]);
    expect(await saldoAkun(db, "3-120")).toBe(0);
    const { ringkasan, bukuBesar } = await ringkasanKasModal(null);
    expect(bukuBesar.modalInvestorCocok).toBe(true);
    expect(ringkasan.modalInvestor.setoranBarang.rincian.map((r) => r.jumlah)).toEqual([1_900_000, -1_900_000]);
    expect((await neraca()).seimbang).toBe(true);
  });

  it("draf: sumber tersimpan, ganti ke Tunai mengosongkannya, Investasi tanpa sumber menjadi Pemilik; Hibah ke 3-130", async () => {
    await masukSebagai("admin");
    const buat = await aksi.simpanPembelian({ ...perlengkapan, caraBayar: "INVESTASI", sumberInvestasi: "HIBAH" });
    expect(buat.ok).toBe(true);
    const nd = buat.ok ? buat.data!.no : "";
    const sumber = async () => (await db.pembelian.findUniqueOrThrow({ where: { no: nd } })).sumberInvestasi;
    expect(await sumber()).toBe("HIBAH");

    expect((await aksi.simpanPembelian({ ...perlengkapan, no: nd, caraBayar: "TUNAI", sumberInvestasi: "HIBAH", supplierKode: "SUP-01" })).ok).toBe(true);
    expect(await sumber()).toBeNull();
    expect((await aksi.simpanPembelian({ ...perlengkapan, no: nd, caraBayar: "INVESTASI" })).ok).toBe(true);
    expect(await sumber()).toBe("PEMILIK");
    const salah = await aksi.simpanPembelian({ ...perlengkapan, no: nd, caraBayar: "INVESTASI", sumberInvestasi: "TEMAN" });
    expect(salah.ok).toBe(false);
    if (!salah.ok) expect(salah.galatIsian?.sumberInvestasi).toBe("Pilih sumber investasi.");

    expect((await aksi.simpanPembelian({ ...perlengkapan, no: nd, caraBayar: "INVESTASI", sumberInvestasi: "HIBAH" })).ok).toBe(true);
    await masukSebagai("owner");
    expect((await aksi.postingPembelian({ no: nd })).ok).toBe(true);
    const j = await db.jurnal.findFirstOrThrow({ where: { sumberTipe: "PEMBELIAN", sumberId: nd }, include: { detail: { orderBy: { noUrut: "asc" } } } });
    expect(baris(j.detail)).toEqual([["1-140", 200_000, 0], ["3-130", 0, 200_000]]);
    expect(await saldoAkun(db, "3-130")).toBe(200_000);
    const { bukuBesar } = await ringkasanKasModal(null);
    expect([bukuBesar.modalHibah, bukuBesar.modalHibahCocok, bukuBesar.kasCocok, bukuBesar.modalCocok]).toEqual([200_000, true, true, true]);
    expect((await neraca()).seimbang).toBe(true);
  });

  it("CHECK database menolak sumber pada pembelian Tunai dan Investasi tanpa sumber", async () => {
    const tunai = await db.pembelian.findFirstOrThrow({ where: { caraBayar: "TUNAI" } });
    await expect(db.pembelian.update({ where: { no: tunai.no }, data: { sumberInvestasi: "INVESTOR" } })).rejects.toThrow();
    const inv = await db.pembelian.findFirstOrThrow({ where: { caraBayar: "INVESTASI" } });
    await expect(db.pembelian.update({ where: { no: inv.no }, data: { sumberInvestasi: null } })).rejects.toThrow();
  });
});

it.skipIf(aktif)("tes alur sumber investasi dilewati (set UJI_DB=1 untuk menjalankan)", () => {});
