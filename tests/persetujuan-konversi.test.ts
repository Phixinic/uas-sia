/*
 * Tes integrasi persetujuan jurnal penyusutan dan nilai sisa dari halamannya sendiri (UJI_DB=1).
 * Halaman Proses Penyusutan dan Nilai Sisa memakai server action Jurnal Penyesuaian yang sama (ajukan, setujui, tolak);
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

  let pertama = "";
  let jumlahAset = 0;

  it("Admin memproses: jurnal Draf, kartu dashboard dan angka disetujui belum menghitungnya", async () => {
    const admin = await masukSebagai("admin");
    jumlahAset = await jadwalTerbuka();
    expect(jumlahAset).toBeGreaterThan(0);
    const h = await susut.prosesPenyusutan({ periode: P });
    expect(h.ok).toBe(true);
    pertama = h.ok ? h.data!.jurnalNo : "";
    const d = await dataPenyusutan(P);
    expect(d.jurnalIni?.no).toBe(pertama);
    expect(d.jurnalIni?.status).toBe("DRAFT");
    expect(d.jurnalIni?.dibuatOleh).toBe(admin.nama);
    expect(d.totalDisetujui).toBe(0);
    expect(d.totalMenunggu).toBe(d.jurnalIni?.total);
    expect(d.jumlahAset[pertama]).toBe(jumlahAset);
    const dash = await dataDashboard(P);
    expect(dash.susut.disetujui).toBe(0);
    expect(dash.susut.menunggu).toBe(d.jurnalIni?.total);
  });

  it("Admin mengajukan lewat aksi Jurnal Penyesuaian; Admin dan HRD tidak bisa menyetujui", async () => {
    const admin = await masukSebagai("admin");
    expect((await jurnal.ajukanJurnalPenyesuaian({ no: pertama })).ok).toBe(true);
    const d = await dataPenyusutan(P);
    expect(d.jurnalIni?.status).toBe("DIAJUKAN");
    expect(d.jurnalIni?.diajukanOleh).toBe(admin.nama);
    expect(d.jurnalIni?.diajukanPada).toBeTruthy();
    expect(d.totalDisetujui).toBe(0);

    const hAdmin = await jurnal.setujuiJurnalPenyesuaian({ no: pertama });
    expect(hAdmin.ok).toBe(false);
    expect((await jurnal.tolakJurnalPenyesuaian({ no: pertama, alasan: "coba" })).ok).toBe(false);
    await masukSebagai("hrd");
    expect((await jurnal.setujuiJurnalPenyesuaian({ no: pertama })).ok).toBe(false);
    expect((await db.jurnal.findUniqueOrThrow({ where: { no: pertama } })).status).toBe("DIAJUKAN");
  });

  it("Owner menolak tanpa alasan gagal; dengan alasan jadwal periode itu dilepas", async () => {
    const owner = await masukSebagai("owner");
    expect((await jurnal.tolakJurnalPenyesuaian({ no: pertama, alasan: "  " })).ok).toBe(false);
    expect(await jadwalTerbuka()).toBe(0);
    expect((await jurnal.tolakJurnalPenyesuaian({ no: pertama, alasan: "Aset AST-0002 sudah rusak, cek dulu" })).ok).toBe(true);

    // Bug yang dicek: jurnal_no di jadwal harus kosong lagi supaya periode bisa diproses ulang.
    expect(await db.jadwalPenyusutan.count({ where: { jurnalNo: pertama } })).toBe(0);
    expect(await jadwalTerbuka()).toBe(jumlahAset);
    const d = await dataPenyusutan(P);
    expect(d.belumDiproses).toBe(jumlahAset);
    expect(d.jurnalIni?.status).toBe("DITOLAK");
    expect(d.jurnalIni?.alasanTolak).toBe("Aset AST-0002 sudah rusak, cek dulu");
    expect(d.jurnalIni?.diputuskanOleh).toBe(owner.nama);
    expect(d.jumlahAset[pertama]).toBeUndefined();
    expect(d.totalMenunggu).toBe(0);
    expect((await dataDashboard(P)).susut.menunggu).toBe(0);
  });

  let kedua = "";
  it("Admin memproses ulang periode yang ditolak: jurnal baru mengklaim jadwal yang sama", async () => {
    await masukSebagai("admin");
    const h = await susut.prosesPenyusutan({ periode: P });
    expect(h.ok).toBe(true);
    kedua = h.ok ? h.data!.jurnalNo : "";
    expect(kedua).not.toBe(pertama);
    expect(await db.jadwalPenyusutan.count({ where: { jurnalNo: kedua } })).toBe(jumlahAset);
    expect(await jadwalTerbuka()).toBe(0);
    const d = await dataPenyusutan(P);
    expect(d.jurnalIni?.no).toBe(kedua);
    expect(d.riwayat.filter((j) => j.periode === P).map((j) => j.status).sort()).toEqual(["DITOLAK", "DRAFT"]);
    expect((await jurnal.ajukanJurnalPenyesuaian({ no: kedua })).ok).toBe(true);
  });

  it("Owner tidak bisa menyetujui jurnal penyusutan buatannya sendiri", async () => {
    const owner = await masukSebagai("owner");
    const admin = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "admin" } });
    // Jurnal penyusutan hanya dibuat Admin; pembuatnya dialihkan ke Owner untuk menguji aturan pembuat.
    await db.jurnal.update({ where: { no: kedua }, data: { dibuatOlehId: owner.id } });
    const h = await jurnal.setujuiJurnalPenyesuaian({ no: kedua });
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.galat).toMatch(/sendiri/);
    expect((await db.jurnal.findUniqueOrThrow({ where: { no: kedua } })).status).toBe("DIAJUKAN");
    await db.jurnal.update({ where: { no: kedua }, data: { dibuatOlehId: admin.id } });
  });

  it("Owner menyetujui: angka disetujui di halaman dan dashboard sama dengan jurnalnya", async () => {
    const owner = await masukSebagai("owner");
    expect((await jurnal.setujuiJurnalPenyesuaian({ no: kedua })).ok).toBe(true);
    const d = await dataPenyusutan(P);
    expect(d.jurnalIni?.status).toBe("DISETUJUI");
    expect(d.jurnalIni?.diputuskanOleh).toBe(owner.nama);
    expect(d.totalDisetujui).toBe(d.jurnalIni?.total);
    expect(d.totalMenunggu).toBe(0);
    const dash = await dataDashboard(P);
    expect(dash.susut.disetujui).toBe(d.jurnalIni?.total);
    expect(dash.susut.menunggu).toBe(0);
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
    ({ no, periode, status, total: 1, alasanTolak: null, dibuatOlehId: 1, dibuatOleh: "A", dibuatPada: "", diajukanOleh: null, diajukanPada: null, diputuskanOleh: null, diputuskanPada: null });
  it("penolakan terbaru tidak tertutup persetujuan lama (kasus produksi: JP-0003 disetujui, JP-0006 ditolak)", () => {
    expect(jurnalPeriode([j("JP-2026-0006", "DITOLAK"), j("JP-2026-0003", "DISETUJUI")], "2026-11")?.no).toBe("JP-2026-0006");
  });
  it("jurnal yang masih menunggu didahulukan; periode lain diabaikan; kosong = null", () => {
    expect(jurnalPeriode([j("JP-2026-0007", "DITOLAK"), j("JP-2026-0005", "DIAJUKAN"), j("JP-2026-0003", "DISETUJUI")], "2026-11")?.no).toBe("JP-2026-0005");
    expect(jurnalPeriode([j("JP-2026-0001", "DISETUJUI", "2026-10")], "2026-11")).toBeNull();
  });
});
