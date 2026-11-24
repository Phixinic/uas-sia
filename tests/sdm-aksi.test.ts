/*
 * Tes integrasi siklus SDM lewat server action terhadap database sungguhan (UJI_DB=1).
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

describe.runIf(aktif)("siklus SDM lewat server action", async () => {
  const { db } = await import("@/lib/server/db");
  const presensi = await import("@/lib/aksi/sdm/presensi");
  const gajiBulanan = await import("@/lib/aksi/sdm/gaji-bulanan");
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

  it("presensi Oktober terkunci karena slipnya sudah dibayar; Admin tidak boleh mengajukan gaji atau mengisi bonus", async () => {
    const ok = await presensi.simpanPresensi({ karyawanKode: "KRY-01", tanggal: "2026-10-31", absensi: "ALPA" });
    expect(ok.ok).toBe(false);
    const lama = await db.presensi.findFirstOrThrow({ where: { karyawanKode: "KRY-01", tanggal: new Date("2026-10-05T00:00:00Z") } });
    expect((await presensi.hapusPresensi({ id: lama.id })).ok).toBe(false);
    await masukSebagai("admin");
    expect((await gajiBulanan.ajukanGajiBulanan({ periode: "2026-11" })).ok).toBe(false);
    expect((await gajiBulanan.simpanPenyesuaianGaji({ periode: "2026-11", karyawanKode: "KRY-03", jenis: "BONUS", nominal: 1, keterangan: "x" })).ok).toBe(false);
    await masukSebagai("hrd");
  });

  it("potongan dan bonus manual: keterangan dan nominal wajib, beberapa baris boleh, Oktober yang sudah dibayar terkunci", async () => {
    await masukSebagai("hrd");
    for (const k of ["KRY-02", "KRY-03", "KRY-04", "KRY-05"]) {
      const h = await presensi.simpanPresensi({ karyawanKode: k, tanggal: "2026-11-03", absensi: k === "KRY-02" ? "ALPA" : "HADIR", jamMasuk: "07:00", jamKeluar: "16:00" });
      expect(h.ok).toBe(true);
    }
    const isi = (jenis: "POTONGAN" | "BONUS", nominal: number, keterangan: string, karyawanKode = "KRY-03", periode = "2026-11") => gajiBulanan.simpanPenyesuaianGaji({ periode, karyawanKode, jenis, nominal, keterangan });
    expect((await isi("POTONGAN", 150_000, "")).ok).toBe(false);
    expect((await isi("BONUS", 0, "Bonus event")).ok).toBe(false);
    expect((await isi("BONUS", 500_000, "Bonus Oktober", "KRY-03", "2026-10")).ok).toBe(false);
    expect((await isi("BONUS", 80_000, "Karyawan event", "KRY-08")).ok).toBe(false);
    expect((await isi("POTONGAN", 150_000, "Denda merusak kabel XLR")).ok).toBe(true);
    expect((await isi("BONUS", 1_000_000, "Bonus target penjualan")).ok).toBe(true);
    expect((await isi("BONUS", 250_000, "Bonus lembur pameran")).ok).toBe(true);
    expect(await db.penyesuaianGaji.count({ where: { periodeId: "2026-11", karyawanKode: "KRY-03" } })).toBe(3);
  });

  const upahKry01 = 150_000;
  it("upah event karyawan inhouse yang dibayar lewat gaji November ikut bahan gaji per event", async () => {
    // Baris upah event seperti hasil keputusan Owner (lihat tes fee event): KRY-01 ikut EVT-2026-0001 sebagai crew.
    await db.slipFee.create({
      data: {
        no: "SFE-EVT-2026-0001-KRY-01", laporanNo: "FEE-2026-0001", eventKode: "EVT-2026-0001", karyawanKode: "KRY-01", jabatanKode: "JBT-06", akunBebanKode: "6-230",
        peranEvent: "CREW", satuanTarif: "JAM", tarif: 20_000, jumlahSesi: 1, menitTercatat: 450, menitDiakui: 450, jumlahHari: 1, feeUsulan: upahKry01, feeAkhir: upahKry01,
        dpp: 0, pph21: 0, dibayar: upahKry01, periodeGajiId: "2026-11",
      },
    });
    const [b] = await muatBahanGaji(db, "2026-11", "KRY-01");
    expect(b.upahEvent.map((u) => [u.eventKode, u.fee])).toEqual([["EVT-2026-0001", upahKry01]]);
    const h = hitungGaji(b.input);
    expect(h.totalUpahEvent).toBe(upahKry01);
    expect(h.bruto).toBe(h.gajiTetap + upahKry01);
  });

  let noPay = "";
  it("HRD mengajukan satu paket: slip dihitung dari bahan terbaru, PPh 21 dihitung ulang dengan bonus dan upah event, presensi dan bonus terkunci", async () => {
    await masukSebagai("owner");
    expect((await gajiBulanan.ajukanGajiBulanan({ periode: "2026-11" })).ok).toBe(false);
    await masukSebagai("hrd");
    const h = await gajiBulanan.ajukanGajiBulanan({ periode: "2026-11" });
    expect(h.ok).toBe(true);
    noPay = h.ok ? (h.data?.no ?? "") : "";
    expect(noPay).toMatch(/^PAY-2026-\d{4}$/);
    const slip = await db.slipGaji.findMany({ where: { periodeId: "2026-11" } });
    expect(slip).toHaveLength(5);
    expect(slip.every((s) => s.status === "DIAJUKAN" && s.penggajianNo === noPay)).toBe(true);
    const s3 = slip.find((s) => s.karyawanKode === "KRY-03")!;
    expect([s3.bonus, s3.potonganLain, s3.upahEvent]).toEqual([1_250_000, 150_000, 0]);
    expect(s3.bruto).toBe(s3.gajiTetap + 1_250_000);
    const { hitungPph21TidakTeratur } = await import("@/lib/inti/penggajian");
    const ptkp = s3.statusPtkp as Parameters<typeof hitungPph21TidakTeratur>[2];
    expect(s3.pph21).toBe(hitungPph21TidakTeratur(s3.gajiTetap, 1_250_000, ptkp).pph21);
    expect(s3.pph21).toBeGreaterThan(hitungPph21TidakTeratur(s3.gajiTetap, 0, ptkp).pph21);
    expect(s3.thp).toBe(s3.bruto - s3.pph21 - 150_000);
    const s1 = slip.find((s) => s.karyawanKode === "KRY-01")!;
    expect([s1.upahEvent, s1.bruto - s1.gajiTetap]).toEqual([upahKry01, upahKry01]);
    const alpa = slip.find((s) => s.karyawanKode === "KRY-02")!;
    expect(alpa.potonganAbsen).toBeGreaterThan(0);
    expect((await presensi.simpanPresensi({ karyawanKode: "KRY-01", tanggal: "2026-11-04", absensi: "CUTI" })).ok).toBe(false);
    expect((await gajiBulanan.simpanPenyesuaianGaji({ periode: "2026-11", karyawanKode: "KRY-03", jenis: "BONUS", nominal: 1, keterangan: "telat" })).ok).toBe(false);
    expect((await gajiBulanan.ajukanGajiBulanan({ periode: "2026-11" })).ok).toBe(false);
  });

  it("HRD tidak boleh memutuskan; Owner menolak wajib dengan alasan, slip kembali draf dan bonus bisa diubah lagi", async () => {
    expect((await gajiBulanan.setujuiPenggajian({ no: noPay })).ok).toBe(false);
    await masukSebagai("owner");
    expect((await gajiBulanan.tolakPenggajian({ no: noPay, alasan: "" })).ok).toBe(false);
    expect((await gajiBulanan.tolakPenggajian({ no: noPay, alasan: "Bonus lembur belum disetujui" })).ok).toBe(true);
    const slip = await db.slipGaji.findMany({ where: { periodeId: "2026-11" } });
    expect(slip.every((s) => s.status === "DRAFT" && s.penggajianNo === null && s.alasanTolak === "Bonus lembur belum disetujui")).toBe(true);
    expect((await gajiBulanan.tolakPenggajian({ no: noPay, alasan: "lagi" })).ok).toBe(false);
    await masukSebagai("hrd");
    const lembur = await db.penyesuaianGaji.findFirstOrThrow({ where: { keterangan: "Bonus lembur pameran" } });
    expect((await gajiBulanan.hapusPenyesuaianGaji({ id: lembur.id })).ok).toBe(true);
  });

  it("ajukan ulang lalu Owner menyetujui: jurnal memuat gaji tetap, upah event 6-240, bonus 6-250, denda 7-120; kas berkurang sebesar THP", async () => {
    await masukSebagai("hrd");
    const aj = await gajiBulanan.ajukanGajiBulanan({ periode: "2026-11" });
    expect(aj.ok).toBe(true);
    const no = aj.ok ? (aj.data?.no ?? "") : "";
    const s3 = await db.slipGaji.findUniqueOrThrow({ where: { no: "SLP-2026-11-KRY-03" } });
    expect([s3.bonus, s3.potonganLain]).toEqual([1_000_000, 150_000]);
    const kasSebelum = await saldoAkun(db, "1-110");
    const pph0 = await saldoAkun(db, "2-120");
    await masukSebagai("owner");
    const h = await gajiBulanan.setujuiPenggajian({ no });
    expect(h.ok).toBe(true);
    const g = await db.penggajian.findUniqueOrThrow({ where: { no }, include: { slip: true } });
    expect(g.status).toBe("DISETUJUI");
    expect(g.slip).toHaveLength(5);
    expect(g.slip.every((s) => s.status === "DISETUJUI")).toBe(true);
    expect(await saldoAkun(db, "1-110")).toBe(kasSebelum - g.totalThp);
    expect(await saldoAkun(db, "2-120")).toBe(pph0 + g.totalPph);
    const j = await db.jurnal.findUniqueOrThrow({ where: { no: g.jurnalNo! }, include: { detail: true } });
    const akun = (k: string) => j.detail.filter((d) => d.akunKode === k).reduce((t, d) => t + d.debit - d.kredit, 0);
    expect(akun("6-240")).toBe(upahKry01);
    expect(akun("6-250")).toBe(1_000_000);
    expect(akun("7-120")).toBe(-150_000);
    expect(akun("1-110")).toBe(-g.totalThp);
    expect(akun("2-120")).toBe(-g.totalPph);
    const tetap = g.slip.reduce((t, s) => t + s.gajiTetap, 0);
    expect(akun("6-210") + akun("6-220")).toBe(tetap);
    expect(j.detail.reduce((s, d) => s + d.debit, 0)).toBe(g.totalBruto);
    expect(j.detail.reduce((s, d) => s + d.kredit, 0)).toBe(g.totalBruto);
    const neraca = neracaSaldo(await muatJurnalBuku(db), (await db.akun.findMany()).map((a) => a.kode), null);
    expect(neraca.seimbang).toBe(true);
    expect((await gajiBulanan.setujuiPenggajian({ no })).ok).toBe(false);
  });
});
