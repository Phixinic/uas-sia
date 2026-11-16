/*
 * Tes integrasi siklus SDM lewat server action terhadap database sungguhan (UJI_DB=1).
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

describe.runIf(aktif)("siklus SDM lewat server action", async () => {
  const { db } = await import("@/lib/server/db");
  const presensi = await import("@/lib/aksi/sdm/presensi");
  const gaji = await import("@/lib/aksi/sdm/gaji");
  const distribusi = await import("@/lib/aksi/sdm/distribusi");
  const { muatBahanGaji } = await import("@/lib/data/sdm/gaji");
  const { hitungGaji } = await import("@/lib/inti/penggajian");
  const { saldoAkun, muatJurnalBuku } = await import("@/lib/server/jurnal");
  const { neracaSaldo } = await import("@/lib/inti/buku-besar");
  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
  };

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  it("hitung ulang Oktober dari database sama dengan slip contoh: bruto 31.500.001, PPh 21 299.658, THP 31.200.343", async () => {
    const bahan = await muatBahanGaji(db, "2026-10");
    const hasil = bahan.map((b) => hitungGaji(b.input));
    expect(hasil.reduce((s, h) => s + h.bruto, 0)).toBe(31_500_001);
    expect(hasil.reduce((s, h) => s + h.pph21, 0)).toBe(299_658);
    expect(hasil.reduce((s, h) => s + h.thp, 0)).toBe(31_200_343);
    const slip = await db.slipGaji.findMany({ where: { periodeId: "2026-10" } });
    for (const s of slip) expect(hasil.find((h, i) => bahan[i].karyawanKode === s.karyawanKode)?.thp).toBe(s.thp);
  });

  it("Admin dan Owner tidak boleh menginput presensi", async () => {
    for (const u of ["admin", "owner"]) {
      await masukSebagai(u);
      const h = await presensi.simpanPresensi({ karyawanKode: "KRY-01", tanggal: "2026-11-03", absensi: "ALPA" });
      expect(h.ok).toBe(false);
    }
  });

  it("validasi: Hadir wajib jam masuk dan keluar, jam keluar harus sesudah masuk", async () => {
    await masukSebagai("hrd");
    const a = await presensi.simpanPresensi({ karyawanKode: "KRY-01", tanggal: "2026-11-03", absensi: "HADIR" });
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.galatIsian?.jamMasuk).toBeTruthy();
    const b = await presensi.simpanPresensi({ karyawanKode: "KRY-01", tanggal: "2026-11-03", absensi: "HADIR", jamMasuk: "09:00", jamKeluar: "08:00" });
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.galatIsian?.jamKeluar).toBeTruthy();
  });

  it("HRD menyimpan presensi: terlambat dihitung dari jadwal (KRY-01 masuk 08:00), tanggal ganda ditolak", async () => {
    const h = await presensi.simpanPresensi({ karyawanKode: "KRY-01", tanggal: "2026-11-03", absensi: "HADIR", jamMasuk: "08:25", jamKeluar: "17:00" });
    expect(h.ok).toBe(true);
    const p = await db.presensi.findFirstOrThrow({ where: { karyawanKode: "KRY-01" }, orderBy: { id: "desc" } });
    expect(p.terlambat).toBe(25);
    const dobel = await presensi.simpanPresensi({ karyawanKode: "KRY-01", tanggal: "2026-11-03", absensi: "IZIN" });
    expect(dobel.ok).toBe(false);
    if (!dobel.ok) expect(dobel.galatIsian?.tanggal).toBeTruthy();
  });

  it("presensi Oktober terkunci karena slipnya sudah dibayar; Admin tidak boleh hitung gaji", async () => {
    const ok = await presensi.simpanPresensi({ karyawanKode: "KRY-01", tanggal: "2026-10-31", absensi: "ALPA" });
    expect(ok.ok).toBe(false);
    const lama = await db.presensi.findFirstOrThrow({ where: { karyawanKode: "KRY-01", tanggal: new Date("2026-10-05T00:00:00Z") } });
    expect((await presensi.hapusPresensi({ id: lama.id })).ok).toBe(false);
    await masukSebagai("admin");
    expect((await gaji.hitungSlipSemua({ periode: "2026-11" })).ok).toBe(false);
    await masukSebagai("hrd");
  });

  it("hitung semua: hanya karyawan berpresensi; hitung ulang tidak menduplikasi; periode Oktober tidak bisa ditimpa", async () => {
    await masukSebagai("hrd");
    for (const k of ["KRY-02", "KRY-03", "KRY-04", "KRY-05"]) {
      const h = await presensi.simpanPresensi({ karyawanKode: k, tanggal: "2026-11-03", absensi: k === "KRY-02" ? "ALPA" : "HADIR", jamMasuk: "07:00", jamKeluar: "16:00" });
      expect(h.ok).toBe(true);
    }
    const h = await gaji.hitungSlipSemua({ periode: "2026-11" });
    expect(h.ok).toBe(true);
    expect(await db.slipGaji.count({ where: { periodeId: "2026-11" } })).toBe(5);
    expect((await gaji.hitungSlipSemua({ periode: "2026-11" })).ok).toBe(true);
    expect(await db.slipGaji.count({ where: { periodeId: "2026-11" } })).toBe(5);
    const alpa = await db.slipGaji.findUniqueOrThrow({ where: { no: "SLP-2026-11-KRY-02" } });
    expect(alpa.alpa).toBe(1);
    expect(alpa.potonganAbsen).toBeGreaterThan(0);
    expect(alpa.thp).toBe(alpa.bruto - alpa.pph21);
    const okt = await gaji.hitungSlipSatu({ periode: "2026-10", karyawanKode: "KRY-01" });
    expect(okt.ok).toBe(false);
  });

  it("hapus slip draf lalu hitung ulang satu karyawan", async () => {
    expect((await gaji.hapusSlip({ no: "SLP-2026-11-KRY-05" })).ok).toBe(true);
    expect(await db.slipGaji.count({ where: { periodeId: "2026-11" } })).toBe(4);
    expect((await gaji.hitungSlipSatu({ periode: "2026-11", karyawanKode: "KRY-05" })).ok).toBe(true);
    expect(await db.slipGaji.count({ where: { periodeId: "2026-11" } })).toBe(5);
  });

  let noPay = "";
  it("hanya HRD mengajukan; pengajuan mengunci slip dan presensi", async () => {
    await masukSebagai("owner");
    expect((await distribusi.ajukanPenggajian({ periode: "2026-11" })).ok).toBe(false);
    await masukSebagai("hrd");
    const h = await distribusi.ajukanPenggajian({ periode: "2026-11" });
    expect(h.ok).toBe(true);
    noPay = h.ok ? (h.data?.no ?? "") : "";
    expect(noPay).toMatch(/^PAY-2026-\d{4}$/);
    const slip = await db.slipGaji.findMany({ where: { periodeId: "2026-11" } });
    expect(slip.every((s) => s.status === "DIAJUKAN" && s.penggajianNo === noPay)).toBe(true);
    expect((await presensi.simpanPresensi({ karyawanKode: "KRY-01", tanggal: "2026-11-04", absensi: "CUTI" })).ok).toBe(false);
    expect((await gaji.hapusSlip({ no: "SLP-2026-11-KRY-01" })).ok).toBe(false);
    expect((await distribusi.ajukanPenggajian({ periode: "2026-11" })).ok).toBe(false);
  });

  it("HRD tidak boleh memutuskan; Owner menolak wajib dengan alasan, slip kembali draf", async () => {
    expect((await distribusi.setujuiPenggajian({ no: noPay })).ok).toBe(false);
    await masukSebagai("owner");
    expect((await distribusi.tolakPenggajian({ no: noPay, alasan: "" })).ok).toBe(false);
    expect((await distribusi.tolakPenggajian({ no: noPay, alasan: "Cek ulang presensi" })).ok).toBe(true);
    const slip = await db.slipGaji.findMany({ where: { periodeId: "2026-11" } });
    expect(slip.every((s) => s.status === "DRAFT" && s.penggajianNo === null && s.alasanTolak === "Cek ulang presensi")).toBe(true);
    expect((await distribusi.tolakPenggajian({ no: noPay, alasan: "lagi" })).ok).toBe(false);
  });

  it("ajukan ulang lalu Owner menyetujui: jurnal seimbang, kas berkurang sebesar THP, slip Dibayar", async () => {
    await masukSebagai("hrd");
    const aj = await distribusi.ajukanPenggajian({ periode: "2026-11" });
    expect(aj.ok).toBe(true);
    const no = aj.ok ? (aj.data?.no ?? "") : "";
    const kasSebelum = await saldoAkun(db, "1-110");
    const pph0 = await saldoAkun(db, "2-120");
    await masukSebagai("owner");
    const h = await distribusi.setujuiPenggajian({ no });
    expect(h.ok).toBe(true);
    const g = await db.penggajian.findUniqueOrThrow({ where: { no }, include: { slip: true } });
    expect(g.status).toBe("DISETUJUI");
    expect(g.slip).toHaveLength(5);
    expect(g.slip.every((s) => s.status === "DISETUJUI")).toBe(true);
    expect(await saldoAkun(db, "1-110")).toBe(kasSebelum - g.totalThp);
    expect(await saldoAkun(db, "2-120")).toBe(pph0 + g.totalPph);
    const j = await db.jurnal.findUniqueOrThrow({ where: { no: g.jurnalNo! }, include: { detail: true } });
    expect(j.status).toBe("DISETUJUI");
    expect(j.detail.reduce((s, d) => s + d.debit, 0)).toBe(g.totalBruto);
    expect(j.detail.reduce((s, d) => s + d.kredit, 0)).toBe(g.totalBruto);
    const neraca = neracaSaldo(await muatJurnalBuku(db), (await db.akun.findMany()).map((a) => a.kode), null);
    expect(neraca.seimbang).toBe(true);
    expect((await distribusi.setujuiPenggajian({ no })).ok).toBe(false);
  });
});
