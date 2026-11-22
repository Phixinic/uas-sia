/*
 * Tes integrasi server action pembelian terhadap database sungguhan (UJI_DB=1).
 * PERHATIAN: tes ini mengisi ulang database DATABASE_URL dengan data contoh (seed) sebelum dan sesudah berjalan.
 * Sesi dan revalidatePath ditiru dengan vi.mock supaya aksi bisa dipanggil di luar Next.js.
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

describe.runIf(aktif)("alur pembelian lewat server action", async () => {
  const { db } = await import("@/lib/server/db");
  const aksi = await import("@/lib/aksi/konversi/pembelian");
  const { muatJurnalBuku, saldoAkun } = await import("@/lib/server/jurnal");
  const { neracaSaldo } = await import("@/lib/inti/buku-besar");
  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
  };
  const neraca = async () => neracaSaldo(await muatJurnalBuku(db), (await db.akun.findMany()).map((a) => a.kode), null);

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  const inputHT = { jenis: "PERALATAN", tanggal: "2026-11-05", caraBayar: "TUNAI", supplierKode: "SUP-03", baris: [{ barangKode: "ALT-05", qty: 2, harga: 950_000, residu: 0, garansiBulan: 24, masaManfaatBulan: 24, dasarN: "GARANSI" }] };

  it("supplier nonaktif ditolak untuk draf baru", async () => {
    await masukSebagai("admin");
    await db.supplier.update({ where: { kode: "SUP-03" }, data: { aktif: false } });
    try {
      const h = await aksi.simpanPembelian(inputHT);
      expect(h.ok).toBe(false);
      if (!h.ok) expect(h.galat).toContain("dinonaktifkan");
    } finally {
      await db.supplier.update({ where: { kode: "SUP-03" }, data: { aktif: true } });
    }
  });

  it("HRD tidak boleh membuat pembelian", async () => {
    await masukSebagai("hrd");
    const h = await aksi.simpanPembelian(inputHT);
    expect(h.ok).toBe(false);
  });

  it("validasi: kredit tanpa jatuh tempo ditolak dengan galat per isian", async () => {
    await masukSebagai("admin");
    const h = await aksi.simpanPembelian({ ...inputHT, caraBayar: "KREDIT" });
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.galatIsian?.jatuhTempo).toBeTruthy();
  });

  let no = "";
  it("Admin menyimpan draf lalu memposting: jurnal, 2 kartu aset, 24 baris jadwal per aset", async () => {
    await masukSebagai("admin");
    const kasAwal = await saldoAkun(db, "1-110");
    const h = await aksi.simpanPembelian(inputHT);
    expect(h.ok).toBe(true);
    no = h.ok ? h.data!.no : "";
    expect(no).toBe("BP-2026-0008");

    const p = await aksi.postingPembelian({ no });
    expect(p.ok).toBe(true);
    const b = await db.pembelian.findUniqueOrThrow({ where: { no }, include: { jurnal: { include: { detail: true } }, detail: { include: { aset: { include: { jadwal: true } } } } } });
    expect(b.status).toBe("DISETUJUI");
    expect(b.jurnal?.no).toBe("JU-2026-0012");
    expect(b.jurnal?.detail.map((d) => [d.akunKode, d.debit, d.kredit])).toEqual([["1-150", 1_900_000, 0], ["1-110", 0, 1_900_000]]);
    const aset = b.detail[0].aset;
    expect(aset.map((a) => a.kode)).toEqual(["AST-0010", "AST-0011"]);
    for (const a of aset) {
      expect([a.n, a.d, a.terakhir, a.jadwal.length]).toEqual([24, 39_583, 39_591, 24]);
      expect(a.garansiSampai?.toISOString().slice(0, 10)).toBe("2028-11-05");
    }
    expect(await saldoAkun(db, "1-110")).toBe(kasAwal - 1_900_000);
    expect((await neraca()).seimbang).toBe(true);

    const lagi = await aksi.postingPembelian({ no });
    expect(lagi.ok).toBe(false);
  });

  it("hanya Owner yang bisa membalik; aset batal, jadwal hilang, neraca tetap seimbang", async () => {
    await masukSebagai("admin");
    expect((await aksi.balikPembelian({ no, alasan: "salah input" })).ok).toBe(false);
    await masukSebagai("owner");
    expect((await aksi.balikPembelian({ no, alasan: "" })).ok).toBe(false);
    const h = await aksi.balikPembelian({ no, alasan: "Salah input supplier" });
    expect(h.ok).toBe(true);
    const b = await db.pembelian.findUniqueOrThrow({ where: { no }, include: { jurnalPembalik: { include: { detail: true } } } });
    expect(b.status).toBe("DIBALIK");
    expect(b.jurnalPembalik?.pembalikDariNo).toBe("JU-2026-0012");
    expect(b.jurnalPembalik?.detail.map((d) => [d.akunKode, d.debit, d.kredit])).toEqual([["1-150", 0, 1_900_000], ["1-110", 1_900_000, 0]]);
    const aset = await db.aset.findMany({ where: { pembelianNo: no }, include: { _count: { select: { jadwal: true } } } });
    expect(aset.every((a) => a.status === "BATAL" && a._count.jadwal === 0)).toBe(true);
    expect((await neraca()).seimbang).toBe(true);
  });

  it("pembelian peralatan yang asetnya sudah disusutkan tidak bisa dibalik", async () => {
    await masukSebagai("owner");
    const h = await aksi.balikPembelian({ no: "BP-2026-0001", alasan: "uji" });
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.galat).toContain("AST-0001");
  });

  it("Admin mengubah dan menghapus draf; posting ditolak bila periode terkunci", async () => {
    await masukSebagai("admin");
    const ubah = await aksi.simpanPembelian({ ...inputHT, no: "BP-2026-0007", tanggal: "2026-11-02", baris: [{ ...inputHT.baris[0], qty: 3 }] });
    expect(ubah.ok).toBe(true);
    expect((await db.pembelian.findUniqueOrThrow({ where: { no: "BP-2026-0007" } })).total).toBe(2_850_000);

    await db.periode.update({ where: { id: "2026-11" }, data: { status: "TERKUNCI" } });
    const post = await aksi.postingPembelian({ no: "BP-2026-0007" });
    expect(post.ok).toBe(false);
    if (!post.ok) expect(post.galat).toContain("dikunci");
    expect((await db.pembelian.findUniqueOrThrow({ where: { no: "BP-2026-0007" } })).status).toBe("DRAFT");
    await db.periode.update({ where: { id: "2026-11" }, data: { status: "TERBUKA" } });

    expect((await aksi.hapusPembelian({ no: "BP-2026-0007" })).ok).toBe(true);
    expect(await db.pembelian.findUnique({ where: { no: "BP-2026-0007" } })).toBeNull();
    expect((await aksi.hapusPembelian({ no: "BP-2026-0001" })).ok).toBe(false);
  });
});

it.skipIf(aktif)("tes aksi pembelian dilewati (set UJI_DB=1 untuk menjalankan)", () => {});
