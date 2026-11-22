/*
 * Tes integrasi kunci periode berurutan (UJI_DB=1). Regresi audit: November bisa dikunci saat Oktober masih terbuka,
 * lalu pembelian bertanggal 30 Oktober tetap bisa diposting dan saldo Perlengkapan November ikut berubah.
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

describe.runIf(aktif)("kunci periode berurutan", async () => {
  const { db } = await import("@/lib/server/db");
  const periode = await import("@/lib/aksi/pelaporan/periode");
  const beli = await import("@/lib/aksi/konversi/pembelian");
  const opname = await import("@/lib/aksi/konversi/nilai-sisa");
  const susut = await import("@/lib/aksi/konversi/penyusutan");
  const lepas = await import("@/lib/aksi/konversi/pelepasan");
  const gaji = await import("@/lib/aksi/sdm/gaji");
  const { buatJurnal, saldoAkun, setujuiJurnal, tolakJurnal } = await import("@/lib/server/jurnal");
  const { dataTutupPeriode } = await import("@/lib/data/pelaporan/periode");

  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
  };
  const status = async (id: string) => (await db.periode.findUnique({ where: { id } }))?.status ?? null;
  const setStatus = (id: string, s: "TERBUKA" | "TERKUNCI") => db.periode.update({ where: { id }, data: { status: s } });
  const galat = (h: { ok: boolean; galat?: string }) => (h.ok ? "" : h.galat ?? "");
  const perlengkapan = (tanggal: string) => ({
    jenis: "PERLENGKAPAN", tanggal, caraBayar: "TUNAI", supplierKode: "SUP-01", keterangan: "uji kunci berurutan",
    baris: [{ barangKode: "LKP-01", qty: 2, harga: 50_000 }], posting: true,
  });

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  it("November tidak bisa dikunci selama Oktober masih terbuka; halaman menunjukkan periode yang harus dikunci dulu", async () => {
    await masukSebagai("owner");
    const h = await periode.kunciPeriode({ periode: "2026-11" });
    expect(h.ok).toBe(false);
    expect(galat(h)).toMatch(/Oktober 2026 belum dikunci/);
    expect(await status("2026-11")).toBe("TERBUKA");
    const nov = (await dataTutupPeriode()).find((p) => p.id === "2026-11")!;
    expect([nov.urutanBoleh, nov.tahanUrutan]).toEqual([false, "Kunci Oktober 2026 dulu"]);
  });

  it("Oktober (periode paling lama) bisa dikunci; dokumen bertanggal sebelum Oktober ikut tertutup", async () => {
    await masukSebagai("owner");
    expect((await periode.kunciPeriode({ periode: "2026-10" })).ok).toBe(true);
    await masukSebagai("admin");
    const sep = await beli.simpanPembelian(perlengkapan("2026-09-30"));
    expect(sep.ok).toBe(false);
    expect(galat(sep)).toMatch(/September 2026 sudah tertutup karena periode sesudahnya \(Oktober 2026\) sudah dikunci/);
    expect(await db.pembelian.count({ where: { keterangan: "uji kunci berurutan" } })).toBe(0);
  });

  it("buka kunci harus dari periode terakhir: Oktober tidak bisa dibuka selama November terkunci", async () => {
    await setStatus("2026-11", "TERKUNCI"); // keadaan November sudah dikunci (lewat aksi butuh semua pekerjaan November selesai)
    await masukSebagai("owner");
    const h = await periode.bukaKunciPeriode({ periode: "2026-10", alasan: "uji urutan" });
    expect(h.ok).toBe(false);
    expect(galat(h)).toMatch(/November 2026 masih terkunci/);
    expect(await status("2026-10")).toBe("TERKUNCI");
    const okt = (await dataTutupPeriode()).find((p) => p.id === "2026-10")!;
    expect(okt.tahanUrutan).toBe("Buka kunci November 2026 dulu");
    expect((await periode.bukaKunciPeriode({ periode: "2026-11", alasan: "uji urutan" })).ok).toBe(true);
    expect((await periode.bukaKunciPeriode({ periode: "2026-10", alasan: "uji urutan" })).ok).toBe(true);
    expect([await status("2026-10"), await status("2026-11")]).toEqual(["TERBUKA", "TERBUKA"]);
  });

  it("data lama tidak berurutan (November terkunci, Oktober terbuka): pembelian 30 Oktober ditolak dan saldo Perlengkapan November tetap", async () => {
    await setStatus("2026-11", "TERKUNCI");
    const sebelum = await saldoAkun(db, "1-140", "2026-11");
    await masukSebagai("admin");
    const h = await beli.simpanPembelian(perlengkapan("2026-10-30"));
    expect(h.ok).toBe(false);
    expect(galat(h)).toMatch(/Oktober 2026 sudah tertutup karena periode sesudahnya \(November 2026\) sudah dikunci/);
    expect(await saldoAkun(db, "1-140", "2026-11")).toBe(sebelum);
    expect(await db.pembelian.count({ where: { keterangan: "uji kunci berurutan" } })).toBe(0);
  });

  it("semua jalur posting dan persetujuan di Oktober memakai cek yang sama selama November terkunci", async () => {
    // Jurnal penyesuaian Oktober yang sudah diajukan sebelum November dikunci.
    const admin = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "admin" } });
    await setStatus("2026-11", "TERBUKA");
    const no = await db.$transaction((tx) => buatJurnal(tx, { tanggal: "2026-10-31", jenis: "PENYESUAIAN", status: "DRAFT", keterangan: "uji urutan", baris: [{ akun: "6-120", debit: 1_000, kredit: 0 }, { akun: "1-140", debit: 0, kredit: 1_000 }], dibuatOlehId: admin.id }));
    await db.jurnal.update({ where: { no }, data: { status: "DIAJUKAN" } });
    await setStatus("2026-11", "TERKUNCI");
    const tertutup = /Oktober 2026 sudah tertutup/;

    await masukSebagai("admin");
    expect(galat(await opname.simpanNilaiSisa({ periode: "2026-10", nilai: [] }))).toMatch(tertutup);
    expect(galat(await susut.prosesPenyusutan({ periode: "2026-10" }))).toMatch(tertutup);
    expect(galat(await lepas.ajukanPelepasan({ asetKode: "AST-0005", tanggal: "2026-10-31", alasan: "DIBUANG" }))).toMatch(tertutup);
    await masukSebagai("hrd");
    expect(galat(await gaji.hitungSlipSemua({ periode: "2026-10" }))).toMatch(tertutup);
    const owner = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "owner" } });
    await expect(db.$transaction((tx) => setujuiJurnal(tx, no, owner.id))).rejects.toThrow(tertutup);
    await expect(db.$transaction((tx) => tolakJurnal(tx, no, owner.id, "uji"))).rejects.toThrow(tertutup);
    expect((await db.jurnal.findUniqueOrThrow({ where: { no } })).status).toBe("DIAJUKAN");
    await setStatus("2026-11", "TERBUKA");
  });
});

it.skipIf(aktif)("tes kunci periode berurutan dilewati (set UJI_DB=1 untuk menjalankan)", () => {});
