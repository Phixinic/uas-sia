/*
 * Tes integrasi jurnal penyusutan (otomatis disetujui) dan persetujuan nilai sisa dari halamannya sendiri (UJI_DB=1).
 * Halaman Nilai Sisa memakai server action Jurnal Penyesuaian yang sama (ajukan, setujui, kembalikan);
 * tes ini memanggil aksi itu lalu memeriksa data yang dibaca halaman (dataPenyusutan, dataNilaiSisa) dan dashboard.
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

describe.runIf(aktif)("persetujuan jurnal penyusutan dan nilai sisa di halamannya sendiri", async () => {
  const { db } = await import("@/lib/server/db");
  const susut = await import("@/lib/aksi/konversi/penyusutan");
  const opname = await import("@/lib/aksi/konversi/nilai-sisa");
  const jurnal = await import("@/lib/aksi/pelaporan/jurnal");
  const { dataPenyusutan } = await import("@/lib/data/konversi/penyusutan");
  const { dataNilaiSisa } = await import("@/lib/data/konversi/nilai-sisa");
  const { dataDashboard } = await import("@/lib/data/pelaporan/dashboard");

  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
    return p;
  };
  const jadwalTerbuka = () => db.jadwalPenyusutan.count({ where: { periodeId: P, jurnalNo: null, aset: { status: "AKTIF" } } });

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  it("Admin memproses: jurnal langsung Disetujui, angka halaman dan dashboard sama dengan jurnalnya, tanpa jejak ajukan", async () => {
    const admin = await masukSebagai("admin");
    const jumlahAset = await jadwalTerbuka();
    expect(jumlahAset).toBeGreaterThan(0);
    expect((await dataDashboard(P)).susut.disetujui).toBe(0);
    const h = await susut.prosesPenyusutan({ periode: P });
    expect(h.ok).toBe(true);
    const no = h.ok ? h.data!.jurnalNo : "";
    const d = await dataPenyusutan(P);
    expect(d.jurnalIni?.no).toBe(no);
    expect(d.jurnalIni?.status).toBe("DISETUJUI");
    expect(d.jurnalIni?.dibuatOleh).toBe(admin.nama);
    expect(d.jurnalIni?.diajukanOleh).toBeNull();
    expect(d.totalDisetujui).toBe(d.jurnalIni?.total);
    expect(d.totalMenunggu).toBe(0);
    expect(d.belumDiproses).toBe(0);
    expect(d.jumlahAset[no]).toBe(jumlahAset);
    const dash = await dataDashboard(P);
    expect(dash.susut.disetujui).toBe(d.jurnalIni?.total);
    expect(dash.susut.menunggu).toBe(0);
    expect(dash.tindakan.some((t) => t.judul.includes("Penyusutan November 2026"))).toBe(false);

    // Owner tidak punya tombol keputusan: aksi setujui dan tolak menolak jurnal penyusutan.
    await masukSebagai("owner");
    expect((await jurnal.tolakJurnalPenyesuaian({ no, alasan: "coba" })).ok).toBe(false);
    expect((await jurnal.setujuiJurnalPenyesuaian({ no })).ok).toBe(false);
    expect((await db.jurnal.findUniqueOrThrow({ where: { no } })).status).toBe("DISETUJUI");
  });

  it("peringatan laporan: bulan yang penyusutannya belum diproses terdaftar sampai periode laporan", async () => {
    const { bulanPenyusutanBelum } = await import("@/lib/data/konversi/penyusutan");
    expect(await bulanPenyusutanBelum(P)).toEqual([]);
    expect(await bulanPenyusutanBelum("2026-12")).toEqual(["2026-12"]);
  });

  it("nilai sisa: status, pemutus, dan alasan tolak terbaca di halaman Nilai Sisa; input ulang memakai OPN yang sama", async () => {
    await masukSebagai("admin");
    const bahan = await dataNilaiSisa(P);
    const nilai = bahan.baris.map((b) => ({ perlengkapanKode: b.kode, nilaiSisa: Math.floor(b.saldoBuku / 2) }));
    expect(nilai.length).toBeGreaterThan(0);
    expect((await opname.simpanNilaiSisa({ periode: P, nilai })).ok).toBe(true);
    let d = await dataNilaiSisa(P);
    const j1 = d.jurnalIni!;
    expect(j1.status).toBe("DRAFT");
    expect((await jurnal.ajukanJurnalPenyesuaian({ no: j1.no })).ok).toBe(true);
    await masukSebagai("owner");
    expect((await jurnal.tolakJurnalPenyesuaian({ no: j1.no, alasan: "Hitung ulang gudang" })).ok).toBe(true);
    d = await dataNilaiSisa(P);
    expect(d.jurnalIni?.no).toBe(j1.no);
    expect(d.jurnalIni?.status).toBe("DITOLAK");
    expect(d.jurnalIni?.alasanTolak).toBe("Hitung ulang gudang");
    expect(d.opname?.status).toBe("DITOLAK");

    await masukSebagai("admin");
    expect((await opname.simpanNilaiSisa({ periode: P, nilai })).ok).toBe(true);
    d = await dataNilaiSisa(P);
    expect(d.jurnalIni?.status).toBe("DRAFT");
    expect(d.jurnalIni?.no).not.toBe(j1.no);
    expect(d.riwayatJurnal.filter((j) => j.periode === P).map((j) => j.status).sort()).toEqual(["DITOLAK", "DRAFT"]);
  });
});

describe("jurnalPeriode: jurnal yang mewakili satu periode", async () => {
  const { jurnalPeriode } = await import("@/lib/data/konversi/persetujuan");
  const j = (no: string, status: "DRAFT" | "DIAJUKAN" | "DISETUJUI" | "DITOLAK", periode = "2026-11") =>
    ({ no, periode, status, total: 1, alasanTolak: null, dibuatOlehId: 1, dibuatOleh: "A", dibuatPada: "", diajukanOleh: null, diajukanPada: null, diputuskanOleh: null, diputuskanOlehId: null, diputuskanPada: null });
  it("penolakan terbaru tidak tertutup persetujuan lama (kasus produksi: JP-0003 disetujui, JP-0006 ditolak)", () => {
    expect(jurnalPeriode([j("JP-2026-0006", "DITOLAK"), j("JP-2026-0003", "DISETUJUI")], "2026-11")?.no).toBe("JP-2026-0006");
  });
  it("jurnal yang masih menunggu didahulukan; periode lain diabaikan; kosong = null", () => {
    expect(jurnalPeriode([j("JP-2026-0007", "DITOLAK"), j("JP-2026-0005", "DIAJUKAN"), j("JP-2026-0003", "DISETUJUI")], "2026-11")?.no).toBe("JP-2026-0005");
    expect(jurnalPeriode([j("JP-2026-0001", "DISETUJUI", "2026-10")], "2026-11")).toBeNull();
  });
});
