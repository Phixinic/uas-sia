/*
 * Tes integrasi nilai sisa, penyusutan, pelepasan, dan tambah cepat master terhadap database sungguhan (UJI_DB=1).
 * PERHATIAN: tes ini mengisi ulang database DATABASE_URL dengan data contoh (seed) sebelum dan sesudah berjalan.
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

describe.runIf(aktif)("siklus konversi lewat server action", async () => {
  const { db } = await import("@/lib/server/db");
  const opname = await import("@/lib/aksi/konversi/nilai-sisa");
  const susut = await import("@/lib/aksi/konversi/penyusutan");
  const lepas = await import("@/lib/aksi/konversi/pelepasan");
  const cepat = await import("@/lib/aksi/konversi/master-cepat");
  const { muatJurnalBuku, setujuiJurnal, tolakJurnal } = await import("@/lib/server/jurnal");
  const { neracaSaldo } = await import("@/lib/inti/buku-besar");
  const { saldoBukuLkp } = await import("@/lib/data/konversi/nilai-sisa");
  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
  };
  const neraca = async () => neracaSaldo(await muatJurnalBuku(db), (await db.akun.findMany()).map((a) => a.kode), null);
  const putuskan = async (no: string, setuju: boolean, alasan = "uji") => {
    await masukSebagai("owner");
    await db.$transaction(async (tx) => (setuju ? setujuiJurnal(tx, no, sesi.pengguna!.id) : tolakJurnal(tx, no, sesi.pengguna!.id, alasan)));
  };

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  describe("nilai sisa perlengkapan", () => {
    const semua = (saldo: { kode: string; saldoBuku: number }[], f: (s: number) => number) => saldo.map((s) => ({ perlengkapanKode: s.kode, nilaiSisa: f(s.saldoBuku) }));

    it("saldo buku November = pembelian Oktober dikurangi biaya opname Oktober", async () => {
      const saldo = await saldoBukuLkp(db, "2026-11");
      expect(Object.fromEntries(saldo.map((s) => [s.kode, s.saldoBuku]))).toEqual({ "LKP-01": 510_000, "LKP-02": 162_000, "LKP-03": 90_000, "LKP-04": 1_000_000, "LKP-05": 450_000 });
    });

    it("HRD ditolak; nilai kurang, kelebihan, atau Oktober yang sudah diinput ditolak", async () => {
      const saldo = await saldoBukuLkp(db, "2026-11");
      await masukSebagai("hrd");
      expect((await opname.simpanNilaiSisa({ periode: "2026-11", nilai: semua(saldo, (s) => s) })).ok).toBe(false);
      await masukSebagai("admin");
      const kurang = await opname.simpanNilaiSisa({ periode: "2026-11", nilai: semua(saldo, (s) => s).slice(1) });
      expect(kurang.ok).toBe(false);
      if (!kurang.ok) expect(kurang.galatIsian?.["nilai.LKP-01"]).toBeTruthy();
      const lebih = await opname.simpanNilaiSisa({ periode: "2026-11", nilai: semua(saldo, (s) => s + 1) });
      expect(lebih.ok).toBe(false);
      expect((await opname.simpanNilaiSisa({ periode: "2026-10", nilai: [] })).ok).toBe(false);
      expect((await db.opname.count({ where: { periodeId: "2026-11" } }))).toBe(0);
    });

    it("simpan: opname DRAFT, jurnal penyesuaian draf biaya = saldo - sisa", async () => {
      const saldo = await saldoBukuLkp(db, "2026-11");
      const h = await opname.simpanNilaiSisa({ periode: "2026-11", nilai: semua(saldo, (s) => Math.floor(s / 2)) });
      expect(h.ok).toBe(true);
      const o = await db.opname.findUniqueOrThrow({ where: { no: "OPN-2026-11" }, include: { jurnal: { include: { detail: true } }, detail: true } });
      const total = saldo.reduce((s, x) => s + x.saldoBuku - Math.floor(x.saldoBuku / 2), 0);
      expect([o.status, o.totalBeban, o.detail.length]).toEqual(["DRAFT", total, 5]);
      expect(o.jurnal?.status).toBe("DRAFT");
      expect(o.jurnal?.tanggal.toISOString().slice(0, 10)).toBe("2026-11-30");
      expect(o.jurnal?.detail.map((d) => [d.akunKode, d.debit, d.kredit])).toEqual([["6-120", total, 0], ["1-140", 0, total]]);
      expect((await opname.simpanNilaiSisa({ periode: "2026-11", nilai: semua(saldo, () => 0) })).ok).toBe(false);
      expect((await neraca()).seimbang).toBe(true);
    });

    it("ajukan lalu ditolak Owner: input ulang memakai baris OPN yang sama", async () => {
      await masukSebagai("admin");
      const j = (await db.opname.findUniqueOrThrow({ where: { no: "OPN-2026-11" } })).jurnalNo!;
      expect((await susut.ajukanJurnalKonversi({ no: j })).ok).toBe(true);
      await masukSebagai("hrd");
      expect((await susut.ajukanJurnalKonversi({ no: j })).ok).toBe(false);
      await putuskan(j, false, "Hitung ulang gaffer tape");
      expect((await db.opname.findUniqueOrThrow({ where: { no: "OPN-2026-11" } })).status).toBe("DITOLAK");

      await masukSebagai("admin");
      const saldo = await saldoBukuLkp(db, "2026-11");
      const h = await opname.simpanNilaiSisa({ periode: "2026-11", nilai: semua(saldo, (s) => s) });
      expect(h.ok).toBe(true);
      const o = await db.opname.findUniqueOrThrow({ where: { no: "OPN-2026-11" }, include: { detail: true } });
      // Semua barang utuh: biaya 0, tanpa jurnal, langsung berlaku.
      expect([o.status, o.totalBeban, o.jurnalNo, o.alasanTolak, o.detail.length]).toEqual(["DISETUJUI", 0, null, null, 5]);
      expect(await db.opname.count({ where: { periodeId: "2026-11" } })).toBe(1);
      expect((await db.jurnal.findUniqueOrThrow({ where: { no: j } })).status).toBe("DITOLAK");
    });
  });

  describe("proses penyusutan", () => {
    it("periode yang belum berjalan atau yang dilompati ditolak, HRD ditolak", async () => {
      await masukSebagai("hrd");
      expect((await susut.prosesPenyusutan({ periode: "2026-11" })).ok).toBe(false);
      await masukSebagai("admin");
      expect((await susut.prosesPenyusutan({ periode: "2099-01" })).ok).toBe(false);
      expect((await susut.prosesPenyusutan({ periode: "2026-10" })).ok).toBe(false); // sudah diproses
    });

    let jurnalNo = "";
    it("Admin memproses November: satu jurnal draf per periode, jadwal 9 aset ditandai", async () => {
      await masukSebagai("admin");
      const h = await susut.prosesPenyusutan({ periode: "2026-11" });
      expect(h.ok).toBe(true);
      jurnalNo = h.ok ? h.data!.jurnalNo : "";
      const j = await db.jurnal.findUniqueOrThrow({ where: { no: jurnalNo }, include: { detail: true } });
      const baris = await db.jadwalPenyusutan.findMany({ where: { periodeId: "2026-11", jurnalNo } });
      const total = baris.reduce((s, r) => s + r.beban, 0);
      expect([j.status, j.jenis, j.sumberTipe, j.sumberId, baris.length]).toEqual(["DRAFT", "PENYESUAIAN", "PENYUSUTAN", "2026-11", 9]);
      expect(j.detail.reduce((s, d) => s + d.debit, 0)).toBe(total);
      expect(j.detail.reduce((s, d) => s + d.kredit, 0)).toBe(total);
      expect((await susut.prosesPenyusutan({ periode: "2026-11" })).ok).toBe(false);
    });

    it("jurnal ditolak: baris jadwal terbuka lagi dan bisa diproses ulang", async () => {
      await masukSebagai("admin");
      expect((await susut.ajukanJurnalKonversi({ no: jurnalNo })).ok).toBe(true);
      await putuskan(jurnalNo, false, "Periksa ulang");
      expect(await db.jadwalPenyusutan.count({ where: { periodeId: "2026-11", jurnalNo: { not: null } } })).toBe(0);
      await masukSebagai("admin");
      const h = await susut.prosesPenyusutan({ periode: "2026-11" });
      expect(h.ok).toBe(true);
      jurnalNo = h.ok ? h.data!.jurnalNo : "";
    });

    it("periode yang belum berjalan tidak bisa diproses walau periode sebelumnya sudah dijurnal", async () => {
      await masukSebagai("admin");
      const h = await susut.prosesPenyusutan({ periode: "2026-12" });
      expect(h.ok).toBe(false);
    });

    it("pelepasan ditahan selama penyusutan aset belum disetujui; sesudah disetujui nilai buku mengikuti akumulasi", async () => {
      await masukSebagai("admin");
      expect((await susut.ajukanJurnalKonversi({ no: jurnalNo })).ok).toBe(true);
      await masukSebagai("owner");
      const tahan = await lepas.setujuiPelepasan({ no: "PLP-2026-0001" });
      expect(tahan.ok).toBe(false);
      if (!tahan.ok) expect(tahan.galat).toContain(jurnalNo);
      expect((await db.pelepasan.findUniqueOrThrow({ where: { no: "PLP-2026-0001" } })).status).toBe("DIAJUKAN");

      await putuskan(jurnalNo, true);
      const h = await lepas.setujuiPelepasan({ no: "PLP-2026-0001" });
      expect(h.ok).toBe(true);
      const p = await db.pelepasan.findUniqueOrThrow({ where: { no: "PLP-2026-0001" }, include: { jurnal: { include: { detail: true } }, aset: { include: { _count: { select: { jadwal: true } } } } } });
      // AST-0003: 950.000, d = 39.583 per bulan, dua bulan disetujui (Oktober dan November).
      expect([p.status, p.akumulasi, p.nilaiBuku, p.labaRugi]).toEqual(["DISETUJUI", 79_166, 870_834, -870_834]);
      expect(p.aset.status).toBe("DILEPAS");
      expect(p.aset._count.jadwal).toBe(2);
      expect(p.jurnal?.status).toBe("DISETUJUI");
      expect(p.jurnal?.detail.map((d) => [d.akunKode, d.debit, d.kredit])).toEqual([["1-151", 79_166, 0], ["8-110", 870_834, 0], ["1-150", 0, 950_000]]);
      expect((await neraca()).seimbang).toBe(true);
      expect((await lepas.setujuiPelepasan({ no: "PLP-2026-0001" })).ok).toBe(false);
    });
  });

  describe("pelepasan", () => {
    let no = "";
    it("hanya Admin yang mengajukan; harga jual wajib bila dijual; tanggal sebelum perolehan ditolak", async () => {
      const dasar = { asetKode: "AST-0001", tanggal: "2026-11-20", alasan: "DIJUAL" as const, hargaJual: 10_000_000 };
      await masukSebagai("hrd");
      expect((await lepas.ajukanPelepasan(dasar)).ok).toBe(false);
      await masukSebagai("admin");
      expect((await lepas.ajukanPelepasan({ ...dasar, hargaJual: "" })).ok).toBe(false);
      expect((await lepas.ajukanPelepasan({ ...dasar, tanggal: "2026-10-01" })).ok).toBe(false);
      const h = await lepas.ajukanPelepasan(dasar);
      expect(h.ok).toBe(true);
      no = h.ok ? h.data!.no : "";
      expect(no).toBe("PLP-2026-0002");
      expect((await lepas.ajukanPelepasan(dasar)).ok).toBe(false); // sudah ada pengajuan
    });

    it("Owner menolak dengan alasan; Admin tidak boleh memutuskan", async () => {
      await masukSebagai("admin");
      expect((await lepas.tolakPelepasan({ no, alasan: "x" })).ok).toBe(false);
      expect((await lepas.setujuiPelepasan({ no })).ok).toBe(false);
      await masukSebagai("owner");
      expect((await lepas.tolakPelepasan({ no, alasan: "" })).ok).toBe(false);
      expect((await lepas.tolakPelepasan({ no, alasan: "Harga terlalu rendah" })).ok).toBe(true);
      const p = await db.pelepasan.findUniqueOrThrow({ where: { no } });
      expect([p.status, p.alasanTolak]).toEqual(["DITOLAK", "Harga terlalu rendah"]);
      expect((await lepas.setujuiPelepasan({ no })).ok).toBe(false);
    });

    it("dijual dengan laba: jurnal kas, akumulasi, aset, dan laba pelepasan seimbang", async () => {
      await masukSebagai("admin");
      const h = await lepas.ajukanPelepasan({ asetKode: "AST-0001", tanggal: "2026-11-20", alasan: "DIJUAL", hargaJual: 15_000_000 });
      expect(h.ok).toBe(true);
      const baru = h.ok ? h.data!.no : "";
      await masukSebagai("owner");
      expect((await lepas.setujuiPelepasan({ no: baru })).ok).toBe(true);
      const p = await db.pelepasan.findUniqueOrThrow({ where: { no: baru }, include: { jurnal: { include: { detail: true } } } });
      expect(p.labaRugi).toBe(15_000_000 - p.nilaiBuku);
      expect(p.labaRugi).toBeGreaterThan(0);
      const kredit = p.jurnal!.detail.reduce((s, d) => s + d.kredit, 0);
      expect(p.jurnal!.detail.reduce((s, d) => s + d.debit, 0)).toBe(kredit);
      expect(p.jurnal!.detail.some((d) => d.akunKode === "7-110" && d.kredit === p.labaRugi)).toBe(true);
      expect((await neraca()).seimbang).toBe(true);
    });
  });

  describe("tambah cepat master", () => {
    it("Admin menambah supplier dan barang; peran lain ditolak; peralatan wajib kategori", async () => {
      await masukSebagai("hrd");
      expect((await cepat.tambahSupplierCepat({ nama: "Toko Baru" })).ok).toBe(false);
      await masukSebagai("owner");
      expect((await cepat.tambahSupplierCepat({ nama: "Toko Baru" })).ok).toBe(false);
      await masukSebagai("admin");
      expect((await cepat.tambahSupplierCepat({ nama: "  " })).ok).toBe(false);
      const s = await cepat.tambahSupplierCepat({ nama: "Toko Baru", telepon: "0341" });
      expect(s.ok && s.data?.kode).toBe("SUP-04");
      expect((await cepat.tambahBarangCepat({ jenis: "PERALATAN", nama: "Tripod", satuan: "unit" })).ok).toBe(false);
      const a = await cepat.tambahBarangCepat({ jenis: "PERALATAN", nama: "Tripod", satuan: "unit", kategoriKode: (await db.kategoriAset.findFirstOrThrow()).kode });
      expect(a.ok && a.data?.kode).toBe("ALT-07");
      const l = await cepat.tambahBarangCepat({ jenis: "PERLENGKAPAN", nama: "Lakban", satuan: "roll" });
      expect(l.ok && l.data?.kode).toBe("LKP-06");
    });
  });
});

it.skipIf(aktif)("tes aksi konversi dilewati (set UJI_DB=1 untuk menjalankan)", () => {});
