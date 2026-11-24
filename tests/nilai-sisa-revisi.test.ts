/*
 * Tes integrasi revisi nilai sisa perlengkapan (UJI_DB=1): dikembalikan Owner sebelum disetujui (opname kembali draf,
 * Admin mengubah dan mengajukan ulang, alasan tetap di riwayat), lalu revisi sesudah disetujui (dikembalikan, diajukan
 * ulang, disetujui: jurnal lama dibalik, jurnal baru dibuat, saldo buku bulan berikutnya ikut nilai baru).
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
const P = "2026-11";

describe.runIf(aktif)("revisi nilai sisa perlengkapan", async () => {
  const { db } = await import("@/lib/server/db");
  const aksi = await import("@/lib/aksi/konversi/nilai-sisa");
  const jurnal = await import("@/lib/aksi/pelaporan/jurnal");
  const { saldoAkun, muatJurnalBuku } = await import("@/lib/server/jurnal");
  const { neracaSaldo } = await import("@/lib/inti/buku-besar");
  const { saldoBukuLkp, dataNilaiSisa } = await import("@/lib/data/konversi/nilai-sisa");
  const { cekPeriode } = await import("@/lib/data/pelaporan/periode");

  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
    return p;
  };
  const galat = (h: { ok: boolean; galat?: string }) => (h.ok ? "" : h.galat ?? "");
  const isi = (saldo: { kode: string; saldoBuku: number }[], f: (s: number) => number) => saldo.map((s) => ({ perlengkapanKode: s.kode, nilaiSisa: f(s.saldoBuku) }));
  const seimbang = async () => neracaSaldo(await muatJurnalBuku(db), (await db.akun.findMany()).map((a) => a.kode), null).seimbang;
  const butirOpname = async () => (await cekPeriode(P)).find((x) => x.label === "Nilai sisa perlengkapan sudah diinput")!;

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  let saldo: Awaited<ReturnType<typeof saldoBukuLkp>> = [];
  let j1 = "";

  it("sebelum disetujui: Owner mengembalikan dengan alasan wajib; opname kembali draf berisi nilai lama, jurnalnya tetap di riwayat", async () => {
    await masukSebagai("admin");
    saldo = await saldoBukuLkp(db, P);
    expect((await aksi.simpanNilaiSisa({ periode: P, nilai: isi(saldo, (s) => Math.floor(s / 2)) })).ok).toBe(true);
    j1 = (await db.opname.findUniqueOrThrow({ where: { periodeId: P } })).jurnalNo!;
    expect((await jurnal.ajukanJurnalPenyesuaian({ no: j1 })).ok).toBe(true);
    await masukSebagai("owner");
    expect((await jurnal.tolakJurnalPenyesuaian({ no: j1, alasan: " " })).ok).toBe(false);
    const h = await jurnal.tolakJurnalPenyesuaian({ no: j1, alasan: "Dus kabel di gudang belakang belum dihitung" });
    expect(h.ok && h.pesan).toMatch(/dikembalikan ke Admin untuk revisi/);

    const o = await db.opname.findUniqueOrThrow({ where: { periodeId: P }, include: { detail: true } });
    expect([o.status, o.jurnalNo, o.alasanTolak]).toEqual(["DRAFT", null, "Dus kabel di gudang belakang belum dihitung"]);
    expect(o.detail.map((x) => x.nilaiSisa)).toEqual(saldo.map((s) => Math.floor(s.saldoBuku / 2)));
    const j = await db.jurnal.findUniqueOrThrow({ where: { no: j1 } });
    expect([j.status, j.alasanTolak]).toEqual(["DITOLAK", "Dus kabel di gudang belakang belum dihitung"]);
    expect(await db.logAktivitas.count({ where: { aksi: "jurnal.kembalikan", entitasId: j1 } })).toBe(1);
    // Draf tanpa jurnal belum final: daftar periksa Tutup Periode menahan, halaman menampilkan alasannya.
    expect(await butirOpname()).toMatchObject({ lulus: false, catatan: "masih draf atau dikembalikan untuk revisi" });
    const d = await dataNilaiSisa(P);
    expect([d.opname?.status, d.opname?.alasanTolak, d.jurnalIni?.no, d.jurnalIni?.status]).toEqual(["DRAFT", "Dus kabel di gudang belakang belum dihitung", j1, "DITOLAK"]);
  });

  let j2 = "";
  it("Admin mengubah lalu mengajukan ulang; Owner menyetujui; riwayat memuat jurnal yang dikembalikan beserta alasannya", async () => {
    await masukSebagai("admin");
    expect((await aksi.simpanNilaiSisa({ periode: P, nilai: isi(saldo, (s) => Math.floor(s * 0.6)) })).ok).toBe(true);
    const o = await db.opname.findUniqueOrThrow({ where: { periodeId: P } });
    j2 = o.jurnalNo!;
    expect(j2).not.toBe(j1);
    expect([o.status, o.alasanTolak]).toEqual(["DRAFT", null]);
    expect((await jurnal.ajukanJurnalPenyesuaian({ no: j2 })).ok).toBe(true);
    await masukSebagai("owner");
    expect((await jurnal.setujuiJurnalPenyesuaian({ no: j2 })).ok).toBe(true);
    expect((await db.opname.findUniqueOrThrow({ where: { periodeId: P } })).status).toBe("DISETUJUI");
    const d = await dataNilaiSisa(P);
    const milik = d.riwayatJurnal.filter((j) => j.periode === P);
    expect(milik.map((j) => [j.no, j.status])).toEqual([[j2, "DISETUJUI"], [j1, "DITOLAK"]]);
    expect(milik[1].alasanTolak).toBe("Dus kabel di gudang belakang belum dihitung");
    expect(d.tahanRevisi).toBeNull();
    expect((await butirOpname()).lulus).toBe(true);
  });

  it("revisi sesudah disetujui: alasan wajib, nilai sama ditolak, hanya Admin, satu revisi menunggu", async () => {
    await masukSebagai("hrd");
    expect((await aksi.ajukanRevisiNilaiSisa({ periode: P, nilai: isi(saldo, (s) => Math.floor(s * 0.7)), alasan: "uji" })).ok).toBe(false);
    await masukSebagai("admin");
    expect((await aksi.ajukanRevisiNilaiSisa({ periode: P, nilai: isi(saldo, (s) => Math.floor(s * 0.7)), alasan: "" })).ok).toBe(false);
    expect(galat(await aksi.ajukanRevisiNilaiSisa({ periode: P, nilai: isi(saldo, (s) => Math.floor(s * 0.6)), alasan: "sama" }))).toMatch(/sama persis/);
    expect(galat(await aksi.simpanNilaiSisa({ periode: P, nilai: isi(saldo, () => 0) }))).toMatch(/Ajukan revisi/);
    const h = await aksi.ajukanRevisiNilaiSisa({ periode: P, nilai: isi(saldo, (s) => Math.floor(s * 0.7)), alasan: "Salah hitung lakban" });
    expect(h.ok).toBe(true);
    expect(h.ok && h.data?.no).toBe("OPN-2026-11-R1");
    expect(galat(await aksi.ajukanRevisiNilaiSisa({ periode: P, nilai: isi(saldo, (s) => Math.floor(s * 0.8)), alasan: "dua kali" }))).toMatch(/masih menunggu/);
    expect(await butirOpname()).toMatchObject({ lulus: false, catatan: "revisi menunggu Owner" });
  });

  it("Owner mengembalikan revisi: nilai berlaku tidak berubah, alasan tersimpan; Admin mengajukan revisi baru", async () => {
    await masukSebagai("owner");
    const sebelum = await db.opname.findUniqueOrThrow({ where: { periodeId: P }, include: { detail: true } });
    expect((await aksi.kembalikanRevisiNilaiSisa({ no: "OPN-2026-11-R1", alasan: "" })).ok).toBe(false);
    expect((await aksi.kembalikanRevisiNilaiSisa({ no: "OPN-2026-11-R1", alasan: "Lampirkan foto hitung ulang" })).ok).toBe(true);
    const r1 = await db.revisiOpname.findUniqueOrThrow({ where: { no: "OPN-2026-11-R1" } });
    expect([r1.status, r1.alasanTolak]).toEqual(["DITOLAK", "Lampirkan foto hitung ulang"]);
    const sesudah = await db.opname.findUniqueOrThrow({ where: { periodeId: P }, include: { detail: true } });
    expect([sesudah.totalBeban, sesudah.jurnalNo, sesudah.detail.map((x) => x.nilaiSisa)]).toEqual([sebelum.totalBeban, j2, sebelum.detail.map((x) => x.nilaiSisa)]);

    await masukSebagai("admin");
    const h = await aksi.ajukanRevisiNilaiSisa({ periode: P, nilai: isi(saldo, (s) => Math.floor(s * 0.75)), alasan: "Hitung ulang dengan foto" });
    expect(h.ok && h.data?.no).toBe("OPN-2026-11-R2");
    const d = await dataNilaiSisa(P);
    expect(d.opname?.revisi.map((r) => [r.no, r.status])).toEqual([["OPN-2026-11-R2", "DIAJUKAN"], ["OPN-2026-11-R1", "DITOLAK"]]);
  });

  it("Owner menyetujui revisi: jurnal lama dibalik, jurnal baru dibuat, nilai opname diganti, neraca seimbang, saldo bulan berikut ikut", async () => {
    const lama = await db.opname.findUniqueOrThrow({ where: { periodeId: P } });
    const saldoLkpSebelum = await saldoAkun(db, "1-140", P);
    await masukSebagai("owner");
    const h = await aksi.setujuiRevisiNilaiSisa({ no: "OPN-2026-11-R2" });
    expect(h.ok).toBe(true);
    const r = await db.revisiOpname.findUniqueOrThrow({ where: { no: "OPN-2026-11-R2" } });
    expect(r.status).toBe("DISETUJUI");
    expect(r.jurnalLamaNo).toBe(j2);
    const total = saldo.reduce((s, x) => s + x.saldoBuku - Math.floor(x.saldoBuku * 0.75), 0);
    expect([r.totalBebanLama, r.totalBeban]).toEqual([lama.totalBeban, total]);

    const balik = await db.jurnal.findUniqueOrThrow({ where: { no: r.jurnalPembalikNo! }, include: { detail: { orderBy: { noUrut: "asc" } } } });
    expect([balik.status, balik.jenis, balik.pembalikDariNo, balik.sumberTipe, balik.periodeId, balik.tanggal.toISOString().slice(0, 10)]).toEqual(["DISETUJUI", "PENYESUAIAN", j2, "OPNAME", P, "2026-11-30"]);
    expect(balik.detail.map((x) => [x.akunKode, x.debit, x.kredit])).toEqual([["6-120", 0, lama.totalBeban], ["1-140", lama.totalBeban, 0]]);
    const baru = await db.jurnal.findUniqueOrThrow({ where: { no: r.jurnalBaruNo! }, include: { detail: { orderBy: { noUrut: "asc" } } } });
    expect([baru.status, baru.jenis, baru.periodeId]).toEqual(["DISETUJUI", "PENYESUAIAN", P]);
    expect(baru.detail.map((x) => [x.akunKode, x.debit, x.kredit])).toEqual([["6-120", total, 0], ["1-140", 0, total]]);
    // Jurnal lama tetap DISETUJUI (sudah dibalik), opname menunjuk jurnal baru.
    expect((await db.jurnal.findUniqueOrThrow({ where: { no: j2 } })).status).toBe("DISETUJUI");
    const o = await db.opname.findUniqueOrThrow({ where: { periodeId: P }, include: { detail: { orderBy: { perlengkapanKode: "asc" } } } });
    expect([o.status, o.totalBeban, o.jurnalNo]).toEqual(["DISETUJUI", total, r.jurnalBaruNo]);
    expect(o.detail.map((x) => x.nilaiSisa)).toEqual(saldo.map((s) => Math.floor(s.saldoBuku * 0.75)));

    expect(await saldoAkun(db, "1-140", P)).toBe(saldoLkpSebelum + lama.totalBeban - total);
    expect(await seimbang()).toBe(true);
    // Saldo buku Desember = nilai sisa November yang baru (tanpa pembelian Desember di data contoh).
    const des = await saldoBukuLkp(db, "2026-12");
    for (const x of o.detail) expect(des.find((y) => y.kode === x.perlengkapanKode)?.saldoBuku ?? 0).toBeGreaterThanOrEqual(x.nilaiSisa);
    expect((await aksi.setujuiRevisiNilaiSisa({ no: "OPN-2026-11-R2" })).ok).toBe(false);
  });

  it("revisi ditahan sesudah nilai sisa bulan berikutnya diinput", async () => {
    await masukSebagai("admin");
    const des = await saldoBukuLkp(db, "2026-12");
    expect((await aksi.simpanNilaiSisa({ periode: "2026-12", nilai: isi(des, (s) => s) })).ok).toBe(true);
    expect(galat(await aksi.ajukanRevisiNilaiSisa({ periode: P, nilai: isi(saldo, (s) => Math.floor(s * 0.9)), alasan: "terlambat" }))).toMatch(/Desember 2026 sudah diinput/);
    expect((await dataNilaiSisa(P)).tahanRevisi).toMatch(/Desember 2026 sudah diinput/);
  });
});

it.skipIf(aktif)("tes revisi nilai sisa dilewati (set UJI_DB=1 untuk menjalankan)", () => {});
