/*
 * Tes integrasi nilai sisa, penyusutan, pelepasan, dan tambah cepat master terhadap database sungguhan (UJI_DB=1).
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

describe.runIf(aktif)("siklus konversi lewat server action", async () => {
  const { db } = await import("@/lib/server/db");
  const opname = await import("@/lib/aksi/konversi/nilai-sisa");
  const susut = await import("@/lib/aksi/konversi/penyusutan");
  const lepas = await import("@/lib/aksi/konversi/pelepasan");
  const cepat = await import("@/lib/aksi/konversi/master-cepat");
  const { muatJurnalBuku, setujuiJurnal, tolakJurnal } = await import("@/lib/server/jurnal");
  const { prosesPenyusutanDalam, prosesPenyusutanSampaiDalam } = await import("@/lib/server/penyusutan");
  const jurnalAksi = await import("@/lib/aksi/pelaporan/jurnal");
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

    it("batas proses sampai Desember tahun berjalan: Desember kena aturan urutan, Januari tahun depan ditolak", async () => {
      const saldo = await saldoBukuLkp(db, "2026-12");
      await masukSebagai("admin");
      const des = await opname.simpanNilaiSisa({ periode: "2026-12", nilai: semua(saldo, (s) => s) });
      expect(des.ok).toBe(false);
      if (!des.ok) {
        expect(des.galat).not.toContain("hanya bisa diinput sampai");
        expect(des.galat).toContain("Nilai sisa November 2026 belum diinput");
      }
      const jan = await opname.simpanNilaiSisa({ periode: "2027-01", nilai: [] });
      expect(jan.ok).toBe(false);
      if (!jan.ok) expect(jan.galat).toContain("hanya bisa diinput sampai Desember 2026");
      expect(await db.opname.count({ where: { periodeId: { in: ["2026-12", "2027-01"] } } })).toBe(0);
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
      // Masih draf: Admin boleh mengubah; jurnal draf yang sama diganti isinya (nomor tetap).
      const ubah = semua(saldo, (x) => Math.floor(x / 4));
      expect((await opname.simpanNilaiSisa({ periode: "2026-11", nilai: ubah })).ok).toBe(true);
      const o2 = await db.opname.findUniqueOrThrow({ where: { no: "OPN-2026-11" }, include: { jurnal: { include: { detail: true } } } });
      const total2 = saldo.reduce((s, x) => s + x.saldoBuku - Math.floor(x.saldoBuku / 4), 0);
      expect([o2.status, o2.totalBeban, o2.jurnalNo]).toEqual(["DRAFT", total2, o.jurnalNo]);
      expect(o2.jurnal?.detail.map((d) => [d.akunKode, d.debit, d.kredit])).toEqual([["6-120", total2, 0], ["1-140", 0, total2]]);
      expect((await opname.simpanNilaiSisa({ periode: "2026-11", nilai: semua(saldo, (x) => Math.floor(x / 2)) })).ok).toBe(true);
      expect((await neraca()).seimbang).toBe(true);
    });

    it("ajukan lalu dikembalikan Owner untuk revisi: opname kembali draf, input ulang memakai baris OPN yang sama", async () => {
      await masukSebagai("admin");
      const j = (await db.opname.findUniqueOrThrow({ where: { no: "OPN-2026-11" } })).jurnalNo!;
      expect((await susut.ajukanJurnalKonversi({ no: j })).ok).toBe(true);
      await masukSebagai("hrd");
      expect((await susut.ajukanJurnalKonversi({ no: j })).ok).toBe(false);
      await masukSebagai("admin");
      expect((await opname.simpanNilaiSisa({ periode: "2026-11", nilai: semua(await saldoBukuLkp(db, "2026-11"), () => 0) })).ok).toBe(false); // sedang diajukan
      await putuskan(j, false, "Hitung ulang gaffer tape");
      const kembali = await db.opname.findUniqueOrThrow({ where: { no: "OPN-2026-11" }, include: { detail: true } });
      expect([kembali.status, kembali.jurnalNo, kembali.alasanTolak, kembali.detail.length]).toEqual(["DRAFT", null, "Hitung ulang gaffer tape", 5]);

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
    it("periode di luar batas atau yang dilompati ditolak, HRD ditolak", async () => {
      await masukSebagai("hrd");
      expect((await susut.prosesPenyusutan({ periode: "2026-11" })).ok).toBe(false);
      await masukSebagai("admin");
      expect((await susut.prosesPenyusutan({ periode: "2099-01" })).ok).toBe(false);
      const jan = await susut.prosesPenyusutan({ periode: "2027-01" });
      expect(jan.ok).toBe(false);
      if (!jan.ok) expect(jan.galat).toContain("hanya bisa diproses sampai Desember 2026");
      // Desember lolos batas, tetapi November belum diproses, jadi ditahan aturan urutan (bukan "belum berjalan").
      const des = await susut.prosesPenyusutan({ periode: "2026-12" });
      expect(des.ok).toBe(false);
      if (!des.ok) expect(des.galat).toContain("November 2026 belum diproses");
      expect((await susut.prosesPenyusutan({ periode: "2026-10" })).ok).toBe(false); // sudah diproses
      // Owner lolos pemeriksaan peran (tombol "Setujui semua"), jadi yang menolaknya hanya aturan periode.
      await masukSebagai("owner");
      const owner = await susut.prosesPenyusutan({ periode: "2026-10" });
      expect(owner.ok).toBe(false);
      if (!owner.ok) expect(owner.galat).toContain("sudah diproses");
    });

    it("Setujui semua: November dan Desember diproses berurutan dalam satu transaksi (dicoba lalu dibatalkan)", async () => {
      await masukSebagai("owner");
      const batal = new Error("batalkan");
      await expect(
        db.$transaction(async (tx) => {
          const h = await prosesPenyusutanSampaiDalam(tx, sesi.pengguna!.id, "2026-12");
          expect(h.map((x) => x.periode)).toEqual(["2026-11", "2026-12"]);
          expect(await tx.jadwalPenyusutan.count({ where: { periodeId: { lte: "2026-12" }, jurnalNo: null, aset: { status: "AKTIF" } } })).toBe(0);
          throw batal;
        }),
      ).rejects.toBe(batal);
      expect(await db.jadwalPenyusutan.count({ where: { periodeId: "2026-11", jurnalNo: { not: null } } })).toBe(0);
    });

    let jurnalNo = "";
    it("Admin memproses November: satu jurnal langsung disetujui dan masuk buku besar, jadwal 9 aset ditandai", async () => {
      await masukSebagai("admin");
      const admin = sesi.pengguna!.id;
      const h = await susut.prosesPenyusutan({ periode: "2026-11" });
      expect(h.ok).toBe(true);
      jurnalNo = h.ok ? h.data!.jurnalNo : "";
      const j = await db.jurnal.findUniqueOrThrow({ where: { no: jurnalNo }, include: { detail: true } });
      const baris = await db.jadwalPenyusutan.findMany({ where: { periodeId: "2026-11", jurnalNo } });
      const total = baris.reduce((s, r) => s + r.beban, 0);
      expect([j.status, j.jenis, j.sumberTipe, j.sumberId, baris.length]).toEqual(["DISETUJUI", "PENYESUAIAN", "PENYUSUTAN", "2026-11", 9]);
      expect([j.dibuatOlehId, j.disetujuiOlehId, !!j.disetujuiPada]).toEqual([admin, admin, true]);
      expect(j.detail.reduce((s, d) => s + d.debit, 0)).toBe(total);
      expect(j.detail.reduce((s, d) => s + d.kredit, 0)).toBe(total);
      const buku = await muatJurnalBuku(db);
      expect(buku.some((x) => x.no === jurnalNo)).toBe(true);
      expect((await susut.prosesPenyusutan({ periode: "2026-11" })).ok).toBe(false);
    });

    it("jurnal penyusutan tidak bisa diajukan atau ditolak (layanan dan server action), jadwalnya tetap terkunci", async () => {
      await masukSebagai("owner");
      const tolak = await jurnalAksi.tolakJurnalPenyesuaian({ no: jurnalNo, alasan: "Coba tolak" });
      expect(tolak.ok).toBe(false);
      if (!tolak.ok) expect(tolak.galat).toContain("tidak bisa ditolak");
      await expect(db.$transaction((tx) => tolakJurnal(tx, jurnalNo, sesi.pengguna!.id, "uji"))).rejects.toThrow("tidak bisa ditolak");
      await masukSebagai("admin");
      expect((await jurnalAksi.ajukanJurnalPenyesuaian({ no: jurnalNo })).ok).toBe(false);
      expect((await susut.ajukanJurnalKonversi({ no: jurnalNo })).ok).toBe(false);
      expect((await db.jurnal.findUniqueOrThrow({ where: { no: jurnalNo } })).status).toBe("DISETUJUI");
      expect(await db.jadwalPenyusutan.count({ where: { periodeId: "2026-11", jurnalNo } })).toBe(9);
    });

    it("Desember (sesudah bulan berjalan) bisa diproses setelah November; Januari 2027 di luar batas (dicoba lalu dibatalkan)", async () => {
      await masukSebagai("admin");
      const batal = new Error("batalkan");
      await expect(
        db.$transaction(async (tx) => {
          const h = await prosesPenyusutanDalam(tx, sesi.pengguna!.id, "2026-12");
          const j = await tx.jurnal.findUniqueOrThrow({ where: { no: h.jurnalNo } });
          expect([j.status, j.jenis, j.sumberId, j.tanggal.toISOString().slice(0, 10)]).toEqual(["DISETUJUI", "PENYESUAIAN", "2026-12", "2026-12-31"]);
          expect(await tx.jadwalPenyusutan.count({ where: { periodeId: "2026-12", jurnalNo: h.jurnalNo } })).toBeGreaterThan(0);
          throw batal;
        }),
      ).rejects.toBe(batal);
      expect(await db.jadwalPenyusutan.count({ where: { periodeId: "2026-12", jurnalNo: { not: null } } })).toBe(0);
      expect((await susut.prosesPenyusutan({ periode: "2027-01" })).ok).toBe(false);
    });

    it("pelepasan sesudah penyusutan diproses: nilai buku mengikuti akumulasi", async () => {
      await masukSebagai("owner");
      const h = await lepas.setujuiPelepasan({ no: "PLP-2026-0001" });
      expect(h.ok).toBe(true);
      const p = await db.pelepasan.findUniqueOrThrow({ where: { no: "PLP-2026-0001" }, include: { jurnal: { include: { detail: true } }, aset: { include: { _count: { select: { jadwal: true } } } } } });
      // AST-0003: 950.000, d = 39.583 per bulan, dua bulan diproses (Oktober dan November).
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
    it("jadwal belum lengkap: AST-0001 dilepas 16 November saat Oktober belum diproses ditolak (ajukan dan setujui)", async () => {
      await masukSebagai("admin");
      const okt = await db.jadwalPenyusutan.findFirstOrThrow({ where: { asetKode: "AST-0001", periodeId: "2026-10" } });
      const dasar = { asetKode: "AST-0001", tanggal: "2026-11-16", alasan: "DIJUAL" as const, hargaJual: 10_000_000 };
      try {
        await db.jadwalPenyusutan.update({ where: { asetKode_periodeKe: { asetKode: "AST-0001", periodeKe: okt.periodeKe } }, data: { jurnalNo: null } });
        const h = await lepas.ajukanPelepasan(dasar);
        expect(h.ok).toBe(false);
        if (!h.ok) expect(h.galat).toContain("2026-10");
        expect(await db.pelepasan.count({ where: { asetKode: "AST-0001" } })).toBe(0);
        // Pengajuan yang sudah ada tetap dicek ulang saat disetujui.
        await db.jadwalPenyusutan.update({ where: { asetKode_periodeKe: { asetKode: "AST-0001", periodeKe: okt.periodeKe } }, data: { jurnalNo: okt.jurnalNo } });
        const ok = await lepas.ajukanPelepasan(dasar);
        expect(ok.ok).toBe(true);
        const no2 = ok.ok ? ok.data!.no : "";
        await db.jadwalPenyusutan.update({ where: { asetKode_periodeKe: { asetKode: "AST-0001", periodeKe: okt.periodeKe } }, data: { jurnalNo: null } });
        await masukSebagai("owner");
        const s = await lepas.setujuiPelepasan({ no: no2 });
        expect(s.ok).toBe(false);
        expect((await db.pelepasan.findUniqueOrThrow({ where: { no: no2 } })).status).toBe("DIAJUKAN");
        expect((await db.aset.findUniqueOrThrow({ where: { kode: "AST-0001" } })).status).toBe("AKTIF");
        await db.jadwalPenyusutan.update({ where: { asetKode_periodeKe: { asetKode: "AST-0001", periodeKe: okt.periodeKe } }, data: { jurnalNo: okt.jurnalNo } });
        await db.pelepasan.delete({ where: { no: no2 } });
      } finally {
        await db.jadwalPenyusutan.update({ where: { asetKode_periodeKe: { asetKode: "AST-0001", periodeKe: okt.periodeKe } }, data: { jurnalNo: okt.jurnalNo } });
      }
    });

    it("bulan sebelum pelepasan belum diproses (Desember) dan pelepasan mundur tanggal ditolak", async () => {
      await masukSebagai("admin");
      const jan = await lepas.ajukanPelepasan({ asetKode: "AST-0001", tanggal: "2027-01-10", alasan: "DIBUANG" });
      expect(jan.ok).toBe(false);
      if (!jan.ok) expect(jan.galat).toContain("2026-12");
      const mundur = await lepas.ajukanPelepasan({ asetKode: "AST-0001", tanggal: "2026-10-20", alasan: "DIBUANG" });
      expect(mundur.ok).toBe(false);
      if (!mundur.ok) expect(mundur.galat).toContain("2026-11");
    });

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
      expect(no).toBe("PLP-2026-0003"); // 0002 terpakai tes jadwal belum lengkap di atas
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
