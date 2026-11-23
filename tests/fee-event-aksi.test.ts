/*
 * Tes integrasi fee event lewat server action terhadap database sungguhan (UJI_DB=1).
 * Memeriksa hak akses (peran dan kepemilikan kapten), alur penilaian, laporan, keputusan Owner, jurnal, dan
 * pemisahan karyawan inhouse dan event.
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

describe.runIf(aktif)("fee event lewat server action", async () => {
  const { db } = await import("@/lib/server/db");
  const ev = await import("@/lib/aksi/fee-event/event");
  const nilai = await import("@/lib/aksi/fee-event/penilaian");
  const putus = await import("@/lib/aksi/fee-event/keputusan");
  const presensi = await import("@/lib/aksi/sdm/presensi");
  const master = await import("@/lib/aksi/master/master");
  const settingGaji = await import("@/lib/aksi/master/setting-gaji");
  const { muatBahanGaji } = await import("@/lib/data/sdm/gaji");
  const { muatBahanEvent } = await import("@/lib/data/fee-event/bahan");
  const { saldoAkun, muatJurnalBuku } = await import("@/lib/server/jurnal");
  const { neracaSaldo } = await import("@/lib/inti/buku-besar");
  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
  };
  const kehadiran = (eventKode: string, karyawanKode: string, namaSesi: string) =>
    db.kehadiranEvent.findFirstOrThrow({ where: { karyawanKode, sesi: { eventKode, nama: namaSesi } } });

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  it("karyawan event tidak ikut presensi, hitung gaji, dan setting gaji inhouse", async () => {
    expect((await muatBahanGaji(db, "2026-10")).map((b) => b.karyawanKode)).toEqual(["KRY-01", "KRY-02", "KRY-03", "KRY-04", "KRY-05"]);
    await masukSebagai("hrd");
    const p = await presensi.simpanPresensi({ karyawanKode: "KRY-08", tanggal: "2026-11-03", absensi: "ALPA" });
    expect(p.ok).toBe(false);
    const s = await master.simpanMaster({ jenis: "setgaji", nilai: { karyawanKode: "KRY-08", jabatanKode: "JBT-02", golonganKode: "GP-01" } });
    expect(s.ok).toBe(false);
    const a = await settingGaji.ajukanSettingGaji({ karyawanKode: "KRY-08", jenisPerubahan: "SETTING_AWAL", jabatanKode: "JBT-02", golonganKode: "GP-01", bulan: 12, tahun: 2026, alasan: "uji karyawan event" });
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.galat).toMatch(/Karyawan event tidak memakai setting gaji/);
  });

  it("tarif jabatan event hanya diubah Owner; HRD tidak bisa menyentuh jabatan event lewat tab Jabatan", async () => {
    await masukSebagai("hrd");
    expect((await master.simpanMaster({ jenis: "jabatanEvent", kode: "JBT-06", nilai: { nama: "Crew Event", peranEvent: "CREW", satuanTarif: "JAM", tarif: 50_000, akunBebanKode: "6-230" } })).ok).toBe(false);
    expect((await master.simpanMaster({ jenis: "jabatan", kode: "JBT-06", nilai: { nama: "Crew Event", akunBebanKode: "6-230" } })).ok).toBe(false);
    await masukSebagai("owner");
    expect((await master.simpanMaster({ jenis: "jabatanEvent", kode: "JBT-06", nilai: { nama: "Crew Event", peranEvent: "CREW", satuanTarif: "JAM", tarif: 20_000, akunBebanKode: "6-230" } })).ok).toBe(true);
    // Peran jabatan yang sudah dipakai penugasan tidak bisa diubah.
    expect((await master.simpanMaster({ jenis: "jabatanEvent", kode: "JBT-06", nilai: { nama: "Crew Event", peranEvent: "KAPTEN", satuanTarif: "JAM", tarif: 20_000, akunBebanKode: "6-230" } })).ok).toBe(false);
  });

  it("kapten hanya menilai crew di event miliknya; tidak menilai diri sendiri; KURANG wajib catatan dan jam <= tercatat", async () => {
    await masukSebagai("kapten"); // KRY-06, kapten EVT-2026-0001, bukan EVT-2026-0002
    const lain = await kehadiran("EVT-2026-0002", "KRY-09", "Hari H");
    const h1 = await nilai.nilaiKehadiran({ id: lain.id, penilaian: "SESUAI" });
    expect(h1.ok).toBe(false);
    if (!h1.ok) expect(h1.galat).toMatch(/bukan event yang kamu pegang/);
    expect((await nilai.kirimLaporan({ eventKode: "EVT-2026-0002" })).ok).toBe(false);

    await masukSebagai("kapten2"); // KRY-07, kapten EVT-2026-0002
    const diri = await kehadiran("EVT-2026-0002", "KRY-07", "Hari H");
    const h2 = await nilai.nilaiKehadiran({ id: diri.id, penilaian: "SESUAI" });
    expect(h2.ok).toBe(false);
    if (!h2.ok) expect(h2.galat).toMatch(/sendiri/);

    const fajar = await kehadiran("EVT-2026-0002", "KRY-12", "Hari H"); // 08:10-15:00 di jadwal 08:00-17:00 = 6 jam 50 menit
    const tanpaCatatan = await nilai.nilaiKehadiran({ id: fajar.id, penilaian: "KURANG", jamDiakui: "5:00" });
    expect(tanpaCatatan.ok).toBe(false);
    if (!tanpaCatatan.ok) expect(tanpaCatatan.galatIsian?.catatan).toBeTruthy();
    const lebih = await nilai.nilaiKehadiran({ id: fajar.id, penilaian: "KURANG", jamDiakui: "7:00", catatan: "Pulang lebih awal" });
    expect(lebih.ok).toBe(false);
    if (!lebih.ok) expect(lebih.galatIsian?.jamDiakui).toMatch(/6 jam 50 menit/);
    expect((await nilai.nilaiKehadiran({ id: fajar.id, penilaian: "KURANG", jamDiakui: "5:00", catatan: "Pulang lebih awal tanpa izin" })).ok).toBe(true);

    // Belum semua crew dinilai: laporan ditolak sistem.
    const belum = await nilai.kirimLaporan({ eventKode: "EVT-2026-0002" });
    expect(belum.ok).toBe(false);
  });

  it("Owner tidak menilai crew, tetapi menilai kapten; HRD tidak boleh menilai", async () => {
    const crew = await kehadiran("EVT-2026-0002", "KRY-09", "Hari H");
    const kapten = await kehadiran("EVT-2026-0002", "KRY-07", "Hari H");
    await masukSebagai("hrd");
    expect((await nilai.nilaiKehadiran({ id: crew.id, penilaian: "SESUAI" })).ok).toBe(false);
    await masukSebagai("owner");
    expect((await nilai.nilaiKehadiran({ id: crew.id, penilaian: "SESUAI" })).ok).toBe(false);
    expect((await nilai.nilaiKehadiran({ id: kapten.id, penilaian: "SESUAI" })).ok).toBe(true);
  });

  it("kapten mengirim laporan sesudah semua crew dinilai; data event terkunci untuk HRD", async () => {
    await masukSebagai("kapten2");
    const sisa = await db.kehadiranEvent.findMany({ where: { penilaian: null, sesi: { eventKode: "EVT-2026-0002" }, karyawanKode: { not: "KRY-07" } } });
    for (const k of sisa) expect((await nilai.nilaiKehadiran({ id: k.id, penilaian: "SESUAI" })).ok).toBe(true);
    const h = await nilai.kirimLaporan({ eventKode: "EVT-2026-0002", catatan: "Lancar" });
    expect(h.ok).toBe(true);
    if (h.ok) expect(h.data?.no).toBe("FEE-2026-0002");
    expect((await db.event.findUniqueOrThrow({ where: { kode: "EVT-2026-0002" } })).status).toBe("DIAJUKAN");

    await masukSebagai("hrd");
    const k = await kehadiran("EVT-2026-0002", "KRY-09", "Hari H");
    const ubah = await ev.simpanKehadiran({ id: k.id, sesiId: k.sesiId, karyawanKode: k.karyawanKode, jamMasuk: "08:00", jamPulang: "16:00" });
    expect(ubah.ok).toBe(false);
    if (!ubah.ok) expect(ubah.galat).toMatch(/menunggu keputusan Owner/);
  });

  it("Owner menolak laporan: event kembali ke kapten, kapten menilai ulang dan mengirim laporan baru", async () => {
    await masukSebagai("owner");
    expect((await putus.tolakFee({ no: "FEE-2026-0002", alasan: "" })).ok).toBe(false);
    expect((await putus.tolakFee({ no: "FEE-2026-0002", alasan: "Cek lagi jam Dewi di loading out" })).ok).toBe(true);
    const e = await db.event.findUniqueOrThrow({ where: { kode: "EVT-2026-0002" } });
    expect([e.status, e.alasanTolak]).toEqual(["PENILAIAN", "Cek lagi jam Dewi di loading out"]);

    await masukSebagai("kapten2");
    const dewi = await kehadiran("EVT-2026-0002", "KRY-10", "Loading out");
    expect((await nilai.nilaiKehadiran({ id: dewi.id, penilaian: "KURANG", jamDiakui: "3:00", catatan: "Istirahat panjang 1 jam" })).ok).toBe(true);
    const lagi = await nilai.kirimLaporan({ eventKode: "EVT-2026-0002" });
    expect(lagi.ok && lagi.data?.no).toBe("FEE-2026-0003");
    expect((await db.laporanFee.findUniqueOrThrow({ where: { no: "FEE-2026-0002" } })).status).toBe("DITOLAK");
  });

  it("hanya Owner yang memutuskan fee; fee berbeda dari usulan wajib alasan", async () => {
    const b = (await muatBahanEvent(db, "EVT-2026-0001"))!;
    const fee = b.orang.map((o) => ({ karyawanKode: o.karyawanKode, feeAkhir: o.usulan.fee, alasan: "" }));
    for (const u of ["hrd", "kapten", "admin"]) {
      await masukSebagai(u);
      expect((await putus.setujuiFee({ no: "FEE-2026-0001", fee })).ok).toBe(false);
      expect((await putus.tolakFee({ no: "FEE-2026-0001", alasan: "x" })).ok).toBe(false);
    }
    await masukSebagai("owner");
    const ubah = fee.map((f) => (f.karyawanKode === "KRY-09" ? { ...f, feeAkhir: 450_000 } : f));
    const tanpaAlasan = await putus.setujuiFee({ no: "FEE-2026-0001", fee: ubah });
    expect(tanpaAlasan.ok).toBe(false);
    const i = ubah.findIndex((f) => f.karyawanKode === "KRY-09");
    if (!tanpaAlasan.ok) expect(tanpaAlasan.galatIsian?.[`fee.${i}.alasan`]).toBeTruthy();
    // Orang yang hilang dari kiriman ditolak.
    expect((await putus.setujuiFee({ no: "FEE-2026-0001", fee: ubah.slice(1) })).ok).toBe(false);
  });

  it("Owner menyetujui: jurnal Dr 6-230, Kr Utang PPh 21 dan Kas; slip fee per orang; event SELESAI; neraca tetap seimbang", async () => {
    await masukSebagai("owner");
    const kasAwal = await saldoAkun(db, "1-110");
    const b = (await muatBahanEvent(db, "EVT-2026-0001"))!;
    expect(b.totalUsulan).toBe(2_255_000);
    const fee = b.orang.map((o) => (o.karyawanKode === "KRY-09" ? { karyawanKode: o.karyawanKode, feeAkhir: 450_000, alasan: "Tetap bantu packing sampai truk berangkat" } : { karyawanKode: o.karyawanKode, feeAkhir: o.usulan.fee, alasan: "" }));
    const h = await putus.setujuiFee({ no: "FEE-2026-0001", fee });
    expect(h.ok).toBe(true);
    const total = 2_255_000 - 410_000 + 450_000;
    const pph = await db.slipFee.aggregate({ where: { laporanNo: "FEE-2026-0001" }, _sum: { pph21: true, dibayar: true, feeAkhir: true }, _count: true });
    expect(pph._count).toBe(5);
    expect(pph._sum.feeAkhir).toBe(total);
    const lap = await db.laporanFee.findUniqueOrThrow({ where: { no: "FEE-2026-0001" }, include: { jurnal: { include: { detail: true } } } });
    expect(lap.status).toBe("DISETUJUI");
    expect(lap.jurnal?.no).toBe("JU-2026-0012");
    expect(lap.jurnal?.sumberTipe).toBe("FEE_EVENT");
    expect(lap.jurnal?.detail.map((d) => [d.akunKode, d.debit, d.kredit])).toEqual([["6-230", total, 0], ["2-120", 0, pph._sum.pph21], ["1-110", 0, pph._sum.dibayar]]);
    expect(await saldoAkun(db, "1-110")).toBe(kasAwal - pph._sum.dibayar!);
    expect((await db.slipFee.findFirstOrThrow({ where: { karyawanKode: "KRY-09", eventKode: "EVT-2026-0001" } })).alasanUbah).toMatch(/packing/);
    expect((await db.event.findUniqueOrThrow({ where: { kode: "EVT-2026-0001" } })).status).toBe("SELESAI");
    const akun = (await db.akun.findMany({ select: { kode: true } })).map((a) => a.kode);
    const ns = neracaSaldo(await muatJurnalBuku(db, "2026-11"), akun, "2026-11");
    expect(ns.seimbang).toBe(true);
    // Disetujui dua kali ditolak.
    expect((await putus.setujuiFee({ no: "FEE-2026-0001", fee })).ok).toBe(false);
  });

  it("persetujuan ditolak bila periode tanggal selesai event sudah dikunci", async () => {
    await masukSebagai("owner");
    await db.periode.upsert({ where: { id: "2026-11" }, create: { id: "2026-11", status: "TERKUNCI" }, update: { status: "TERKUNCI" } });
    const b = (await muatBahanEvent(db, "EVT-2026-0002"))!;
    const h = await putus.setujuiFee({ no: "FEE-2026-0003", fee: b.orang.map((o) => ({ karyawanKode: o.karyawanKode, feeAkhir: o.usulan.fee })) });
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.galat).toMatch(/dikunci/);
    expect((await db.laporanFee.findUniqueOrThrow({ where: { no: "FEE-2026-0003" } })).status).toBe("DIAJUKAN");
    await db.periode.update({ where: { id: "2026-11" }, data: { status: "TERBUKA" } });
  });

  it("HRD mencatat event baru: penugasan hanya karyawan event, sesi di dalam tanggal event, kehadiran hanya orang yang ditugaskan", async () => {
    await masukSebagai("hrd");
    const e = await ev.simpanEvent({ nama: "Uji Event", klien: "", tanggalMulai: "2026-11-25", tanggalSelesai: "2026-11-25" });
    expect(e.ok).toBe(true);
    const kode = e.ok ? e.data!.kode : "";
    expect(kode).toBe("EVT-2026-0003");
    expect((await ev.simpanSesi({ eventKode: kode, nama: "Hari H", tanggal: "2026-11-26", jamMulai: "08:00", jamSelesai: "16:00" })).ok).toBe(false);
    expect((await ev.simpanSesi({ eventKode: kode, nama: "Hari H", tanggal: "2026-11-25", jamMulai: "08:00", jamSelesai: "16:00" })).ok).toBe(true);
    expect((await ev.simpanPenugasan({ eventKode: kode, karyawanKode: "KRY-01", jabatanKode: "JBT-06" })).ok).toBe(false); // inhouse
    expect((await ev.simpanPenugasan({ eventKode: kode, karyawanKode: "KRY-08", jabatanKode: "JBT-02" })).ok).toBe(false); // jabatan inhouse
    expect((await ev.simpanPenugasan({ eventKode: kode, karyawanKode: "KRY-08", jabatanKode: "JBT-06" })).ok).toBe(true);
    const s = await db.sesiEvent.findFirstOrThrow({ where: { eventKode: kode } });
    expect((await ev.simpanKehadiran({ sesiId: s.id, karyawanKode: "KRY-09", jamMasuk: "08:00", jamPulang: "16:00" })).ok).toBe(false);
    expect((await ev.simpanKehadiran({ sesiId: s.id, karyawanKode: "KRY-08", jamMasuk: "08:00", jamPulang: "16:00" })).ok).toBe(true);
    // Tanpa kapten, kapten mana pun tidak bisa melihat atau melapor.
    await masukSebagai("kapten");
    expect((await nilai.kirimLaporan({ eventKode: kode })).ok).toBe(false);
    await masukSebagai("admin");
    expect((await ev.simpanEvent({ nama: "Admin", tanggalMulai: "2026-11-25", tanggalSelesai: "2026-11-25" })).ok).toBe(false);
  });
});

it.skipIf(aktif)("tes database fee event dilewati (set UJI_DB=1 untuk menjalankan)", () => {});
