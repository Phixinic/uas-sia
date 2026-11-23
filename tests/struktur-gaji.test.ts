/*
 * Tes integrasi tab Struktur gaji di Master SDM (UJI_DB=1). Tab ini hanya menggabungkan tampilan: tambah, ubah, dan
 * nonaktifkan tetap lewat simpanMaster dan ubahStatusMaster, jadi izinnya harus sama dengan tab lama per jenis.
 * Ringkasan pemakaian dihitung dari setting gaji yang berlaku bulan berjalan (sama dengan halaman Setting Gaji).
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

describe.runIf(aktif)("tab Struktur gaji: izin aksi dan ringkasan pemakaian", async () => {
  const { db } = await import("@/lib/server/db");
  const master = await import("@/lib/aksi/master/master");
  const { dataStrukturGaji } = await import("@/lib/data/master/struktur-gaji");
  const { dataSettingGaji } = await import("@/lib/data/master/setting-gaji");
  const { IZIN } = await import("@/lib/peran");
  const { DEF_MASTER, JENIS_STRUKTUR } = await import("@/lib/skema/master");

  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
  };
  const contoh = {
    jabatan: { nama: "Jabatan Uji Struktur", tunjJabatan: 250000, tunjKeluarga: 100000, akunBebanKode: "6-210" },
    jabatanEvent: { nama: "Crew Uji Struktur", peranEvent: "CREW", satuanTarif: "JAM", tarif: 25000, akunBebanKode: "6-230" },
    golongan: { nama: "Golongan Uji Struktur", jumlah: 4200000 },
    tunjangan: { nama: "Tunjangan Uji Struktur", nominal: 150000 },
  } as const;

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  it("izin per jenis tidak berubah: jabatan, golongan, tunjangan HRD dan Owner; jabatan event Owner; nonaktifkan Owner", () => {
    expect(JENIS_STRUKTUR.map((j) => [j, IZIN[DEF_MASTER[j].izin]])).toEqual([
      ["jabatan", ["HRD", "OWNER"]],
      ["jabatanEvent", ["OWNER"]],
      ["golongan", ["HRD", "OWNER"]],
      ["tunjangan", ["HRD", "OWNER"]],
    ]);
    expect(IZIN["master.nonaktifkan"]).toEqual(["OWNER"]);
  });

  it("Admin tidak bisa menambah, mengubah, atau menonaktifkan apa pun di Struktur gaji", async () => {
    await masukSebagai("admin");
    for (const jenis of JENIS_STRUKTUR) expect((await master.simpanMaster({ jenis, nilai: contoh[jenis] })).ok, jenis).toBe(false);
    expect((await master.simpanMaster({ jenis: "golongan", kode: "GP-01", nilai: { nama: "Golongan I", jumlah: 1 } })).ok).toBe(false);
    expect((await master.ubahStatusMaster({ jenis: "golongan", kode: "GP-01", aktif: false })).ok).toBe(false);
    expect((await db.golongan.findUniqueOrThrow({ where: { kode: "GP-01" } })).jumlah).toBe(3_800_000);
  });

  it("HRD: jabatan, golongan, tunjangan boleh; tarif jabatan event dan nonaktifkan ditolak", async () => {
    await masukSebagai("hrd");
    for (const jenis of ["jabatan", "golongan", "tunjangan"] as const) expect((await master.simpanMaster({ jenis, nilai: contoh[jenis] })).ok, jenis).toBe(true);
    expect((await master.simpanMaster({ jenis: "golongan", kode: "GP-01", nilai: { nama: "Golongan I", jumlah: 3_900_000 } })).ok).toBe(true);
    expect((await db.golongan.findUniqueOrThrow({ where: { kode: "GP-01" } })).jumlah).toBe(3_900_000);

    expect((await master.simpanMaster({ jenis: "jabatanEvent", nilai: contoh.jabatanEvent })).ok).toBe(false);
    const h = await master.simpanMaster({ jenis: "jabatanEvent", kode: "JBT-06", nilai: { ...contoh.jabatanEvent, nama: "Crew Event", tarif: 99_000 } });
    expect(h.ok).toBe(false);
    expect((await db.jabatan.findUniqueOrThrow({ where: { kode: "JBT-06" } })).tarif).toBe(20_000);
    expect((await master.ubahStatusMaster({ jenis: "tunjangan", kode: "TNJ-01", aktif: false })).ok).toBe(false);
  });

  it("Owner: mengubah tarif jabatan event dan menonaktifkan; jabatan event tidak bisa diubah lewat jenis jabatan inhouse", async () => {
    await masukSebagai("owner");
    expect((await master.simpanMaster({ jenis: "jabatanEvent", kode: "JBT-06", nilai: { ...contoh.jabatanEvent, nama: "Crew Event", tarif: 22_000 } })).ok).toBe(true);
    expect((await db.jabatan.findUniqueOrThrow({ where: { kode: "JBT-06" } })).tarif).toBe(22_000);
    expect((await master.simpanMaster({ jenis: "jabatan", kode: "JBT-06", nilai: contoh.jabatan })).ok).toBe(false);
    const tunj = await db.tunjangan.findFirstOrThrow({ where: { nama: contoh.tunjangan.nama } });
    expect((await master.ubahStatusMaster({ jenis: "tunjangan", kode: tunj.kode, aktif: false })).ok).toBe(true);
  });

  it("ringkasan: jumlah karyawan per jabatan dan golongan serta kisaran bruto dari setting yang berlaku", async () => {
    const P = "2026-11";
    const [d, s] = await Promise.all([dataStrukturGaji(P), dataSettingGaji(P)]);
    const berlaku = s.baris.filter((b) => b.aktif && b.aktifSekarang).map((b) => b.aktifSekarang!);
    expect(d.karyawanBersetting).toBe(berlaku.length);
    expect(d.karyawanAktif).toBe(s.baris.filter((b) => b.aktif).length);
    // Data contoh November: JBT-02 dipakai KRY-04 dan KRY-05 (promosi KRY-04 baru berlaku Desember), GP-01 dua karyawan.
    expect(d.pemakaian.jabatan["JBT-02"]).toBe(2);
    expect(d.pemakaian.golongan["GP-01"]).toBe(2);
    for (const j of d.ringkasJabatan) {
      const milik = berlaku.filter((v) => v.jabatanKode === j.kode).map((v) => v.estimasiBruto);
      expect(j.karyawan, j.kode).toBe(milik.length);
      expect(j.brutoMin, j.kode).toBe(milik.length ? Math.min(...milik) : null);
      expect(j.brutoMaks, j.kode).toBe(milik.length ? Math.max(...milik) : null);
    }
    // Ringkasan hanya jabatan inhouse; jabatan event tetap di daftarnya sendiri.
    expect(d.ringkasJabatan.some((j) => j.kode === "JBT-05")).toBe(false);
    expect(d.daftar.jabatanEvent.baris.map((b) => b.kode)).toEqual(["JBT-05", "JBT-06"]);
    // Desember: promosi KRY-04 ke JBT-03 berlaku.
    const des = await dataStrukturGaji("2026-12");
    expect(des.pemakaian.jabatan["JBT-02"]).toBe(1);
  });
});
