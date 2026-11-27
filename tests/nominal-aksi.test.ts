/*
 * Tes integrasi riwayat nominal master lewat server action (UJI_DB=1): ajukan, setujui, tolak, pengaman slip dan laporan
 * fee terkunci, slip bulan lama tetap memakai nominal lama walau dihitung ulang, slip draf yang memakai versi usang
 * ditandai dan ditahan di Distribusi, tarif fee mengikuti bulan tanggal selesai event, dan akses terlarang.
 * Data contoh: versi awal NOM-0001 sampai NOM-0014 berlaku Oktober 2026 (GP-01 Rp3.800.000 = NOM-0001, TNJ-02
 * Rp400.000 = NOM-0006, JBT-06 Crew Event Rp20.000/jam = NOM-0014). Slip Oktober sudah dibayar.
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

describe.runIf(aktif)("riwayat nominal master: alur, pengaman, dan pemakaian di slip dan fee", async () => {
  const { db } = await import("@/lib/server/db");
  const nominal = await import("@/lib/aksi/master/nominal");
  const master = await import("@/lib/aksi/master/master");
  const sg = await import("@/lib/aksi/master/setting-gaji");
  const presensi = await import("@/lib/aksi/sdm/presensi");
  const gajiBulanan = await import("@/lib/aksi/sdm/gaji-bulanan");
  const { simpanSlip } = await import("@/lib/server/gaji");
  /** Slip draf satu karyawan (dulu tombol Hitung Gaji); pengajuan Gaji Bulanan menghitung ulang slip sendiri. */
  const gaji = {
    hitungSlipSatu: async ({ periode, karyawanKode }: { periode: string; karyawanKode: string }) => {
      const hrd = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "hrd" } });
      try {
        await db.$transaction(async (tx) => {
          const [b] = await (await import("@/lib/data/sdm/gaji")).muatBahanGaji(tx, periode, karyawanKode);
          if (!b || !(await simpanSlip(tx, b, periode, hrd.id))) throw new Error("slip tidak bisa dihitung");
        });
        return { ok: true as const };
      } catch (e) {
        return { ok: false as const, galat: (e as Error).message };
      }
    },
  };
  const distribusi = { ajukanPenggajian: gajiBulanan.ajukanGajiBulanan, setujuiPenggajian: gajiBulanan.setujuiPenggajian, tolakPenggajian: gajiBulanan.tolakPenggajian };
  const ev = await import("@/lib/aksi/fee-event/event");
  const putus = await import("@/lib/aksi/fee-event/keputusan");
  const { barisHitungGaji, ambilSlip } = await import("@/lib/data/sdm/gaji");
  const { muatBahanEvent } = await import("@/lib/data/fee-event/bahan");
  const { slipFeeLaporan } = await import("@/lib/data/fee-event/daftar");
  const { dataStrukturGaji } = await import("@/lib/data/master/struktur-gaji");
  const { dataDashboard } = await import("@/lib/data/pelaporan/dashboard");
  const { muatPetaNominal, ajukanNominalDalam } = await import("@/lib/server/nominal");

  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
  };
  const galat = (h: { ok: boolean; galat?: string }) => (h.ok ? "" : h.galat ?? "");
  const kode = (h: { ok: boolean; data?: { kode: string } }) => (h.ok ? h.data!.kode : "");
  const ajukan = (x: Record<string, unknown>) => nominal.ajukanNominal({ alasan: "uji riwayat nominal", ...x });
  const hadir = (karyawanKode: string, tanggal: string) => presensi.simpanPresensi({ karyawanKode, tanggal, absensi: "HADIR", jamMasuk: "08:00", jamKeluar: "17:00" });
  const slip = (periode: string, k: string) => db.slipGaji.findUniqueOrThrow({ where: { periodeId_karyawanKode: { periodeId: periode, karyawanKode: k } }, include: { tunjangan: true } });

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  it("data contoh: slip lama menyimpan versi awal dan tampil sumbernya", async () => {
    const s = await slip("2026-10", "KRY-04");
    expect([s.versiGajiPokokKode, s.versiJabatanKode]).toEqual(["NOM-0001", "NOM-0010"]);
    expect(s.tunjangan.map((t) => [t.tunjanganKode, t.versiKode])).toEqual([["TNJ-02", "NOM-0006"]]);
    const tampil = (await ambilSlip(s.no))!;
    expect(tampil.sumberGajiPokok).toBe("Gaji pokok Golongan I, berlaku mulai Oktober 2026 (NOM-0001)");
    expect(tampil.tunjLain[0].sumber).toBe("Tunjangan Makan, berlaku mulai Oktober 2026 (NOM-0006)");
  });

  it("akses terlarang: hanya HRD yang mengajukan (Owner, Admin, Kapten ditolak), hanya Owner yang memutuskan", async () => {
    const dasar = { jenis: "GOLONGAN", itemKode: "GP-01", nominal: 4_000_000, bulan: 12, tahun: 2026 };
    // Satu contoh per jenis nominal, termasuk tarif jabatan event.
    const semuaJenis = [
      dasar,
      { jenis: "TUNJANGAN", itemKode: "TNJ-01", nominal: 360_000, bulan: 1, tahun: 2027 },
      { jenis: "JABATAN", itemKode: "JBT-01", tunjJabatan: 1_750_000, tunjKeluarga: 0, bulan: 1, tahun: 2027 },
      { jenis: "JABATAN_EVENT", itemKode: "JBT-06", nominal: 25_000, bulan: 1, tahun: 2027 },
    ];
    const sebelum = await db.versiNominal.count();
    for (const u of ["owner", "admin", "kapten"]) {
      await masukSebagai(u);
      for (const x of semuaJenis) expect(galat(await ajukan(x)), `${u} ${x.jenis}`).toMatch(/hanya untuk HRD\./);
    }
    expect(await db.versiNominal.count()).toBe(sebelum);
    // HRD juga mengajukan tarif jabatan event; Owner menolaknya supaya hanya satu pengajuan yang tersisa menunggu.
    await masukSebagai("hrd");
    const tarif = await ajukan(semuaJenis[3]);
    expect(tarif.ok, galat(tarif)).toBe(true);
    await masukSebagai("owner");
    expect((await nominal.tolakNominal({ kode: kode(tarif), alasan: "Tarif belum disepakati" })).ok).toBe(true);
    await masukSebagai("hrd");
    const h = await ajukan(dasar);
    expect(h.ok, galat(h)).toBe(true);
    for (const u of ["hrd", "admin", "kapten"]) {
      await masukSebagai(u);
      expect(galat(await nominal.setujuiNominal({ kode: kode(h) }))).toMatch(/hanya untuk OWNER/);
      expect(galat(await nominal.tolakNominal({ kode: kode(h), alasan: "tidak boleh" }))).toMatch(/hanya untuk OWNER/);
    }
    expect((await db.versiNominal.findUniqueOrThrow({ where: { kode: kode(h) } })).status).toBe("DIAJUKAN");
    // Dashboard Owner menampilkan pengajuan nominal di Perlu tindakan.
    expect((await dataDashboard("2026-11")).tindakan.find((t) => t.href === "/master/sdm?tab=struktur")?.judul).toMatch(/1 pengajuan nominal gaji atau tarif menunggu keputusan/);
  });

  it("pengaman pengajuan: slip dibayar, nominal sama, pengajuan kembar, alasan kosong, periode tertutup", async () => {
    await masukSebagai("hrd");
    // GP-01 dipakai slip Oktober yang sudah dibayar.
    expect(galat(await ajukan({ jenis: "GOLONGAN", itemKode: "GP-01", nominal: 4_100_000, bulan: 10, tahun: 2026 }))).toBe(
      "Slip gaji Oktober 2026 yang memakai nominal ini sudah dibayar (SLP-2026-10-KRY-04), jadi perubahan nominal paling awal berlaku November 2026.",
    );
    expect(galat(await ajukan({ jenis: "GOLONGAN", itemKode: "GP-01", nominal: 3_800_000, bulan: 11, tahun: 2026 }))).toMatch(/Nominal sama dengan versi NOM-0001 .* Tidak ada yang berubah/);
    expect(galat(await ajukan({ jenis: "GOLONGAN", itemKode: "GP-01", nominal: 4_100_000, bulan: 12, tahun: 2026 }))).toMatch(/Sudah ada pengajuan gaji pokok Golongan I berlaku Desember 2026 yang menunggu Owner/);
    expect((await ajukan({ jenis: "GOLONGAN", itemKode: "GP-01", nominal: 4_100_000, bulan: 1, tahun: 2027, alasan: "" })).ok).toBe(false);
    expect((await ajukan({ jenis: "TUNJANGAN", itemKode: "TNJ-01", nominal: 0, bulan: 1, tahun: 2027 })).ok).toBe(false);
    expect(galat(await ajukan({ jenis: "JABATAN", itemKode: "JBT-06", tunjJabatan: 1, bulan: 1, tahun: 2027 }))).toMatch(/jabatan event/);
    // Periode tertutup.
    await db.periode.update({ where: { id: "2026-10" }, data: { status: "TERKUNCI" } });
    expect(galat(await ajukan({ jenis: "JABATAN_EVENT", itemKode: "JBT-05", nominal: 210_000, bulan: 10, tahun: 2026 }))).toMatch(/dikunci|tertutup/);
    await db.periode.update({ where: { id: "2026-10" }, data: { status: "TERBUKA" } });
  });

  it("kenaikan gaji pokok berlaku bulan depan: slip bulan ini tetap lama walau dihitung ulang, slip bulan depan memakai yang baru, log nilai lama dan baru", async () => {
    const v = await db.versiNominal.findFirstOrThrow({ where: { golonganKode: "GP-01", status: "DIAJUKAN", berlakuMulai: "2026-12" } });
    await masukSebagai("owner");
    const s = await nominal.setujuiNominal({ kode: v.kode });
    expect(s.ok, galat(s)).toBe(true);
    const log = await db.logAktivitas.findFirstOrThrow({ where: { entitas: "nominal", entitasId: v.kode, aksi: "nominal.setujui" } });
    expect(log.keterangan).toBe(`Gaji pokok. Lama: GP-01 Golongan I: Rp3.800.000, berlaku Oktober 2026 (NOM-0001). Baru: GP-01 Golongan I: Rp4.000.000, berlaku Desember 2026 (${v.kode}). Tidak ada slip draf yang terdampak.`);
    expect((await db.logAktivitas.findFirstOrThrow({ where: { entitas: "nominal", entitasId: v.kode, aksi: "nominal.ajukan" } })).keterangan).toMatch(/Lama: GP-01 Golongan I: Rp3\.800\.000.*Baru: GP-01 Golongan I: Rp4\.000\.000.*Alasan: uji riwayat nominal/);

    await masukSebagai("hrd");
    for (const t of ["2026-11-02", "2026-12-01"]) expect((await hadir("KRY-05", t)).ok).toBe(true);
    expect((await gaji.hitungSlipSatu({ periode: "2026-11", karyawanKode: "KRY-05" })).ok).toBe(true);
    expect((await gaji.hitungSlipSatu({ periode: "2026-12", karyawanKode: "KRY-05" })).ok).toBe(true);
    const nov = await slip("2026-11", "KRY-05");
    const des = await slip("2026-12", "KRY-05");
    expect([nov.gajiPokok, nov.versiGajiPokokKode]).toEqual([3_800_000, "NOM-0001"]);
    expect([des.gajiPokok, des.versiGajiPokokKode]).toEqual([4_000_000, v.kode]);
    // Dihitung ulang: November tetap nominal lama.
    expect((await gaji.hitungSlipSatu({ periode: "2026-11", karyawanKode: "KRY-05" })).ok).toBe(true);
    expect((await slip("2026-11", "KRY-05")).gajiPokok).toBe(3_800_000);
    expect((await ambilSlip(des.no))!.sumberGajiPokok).toBe(`Gaji pokok Golongan I, berlaku mulai Desember 2026 (${v.kode})`);
    // Struktur gaji: November masih Rp3.800.000 dengan versi berikutnya Desember.
    const st = await dataStrukturGaji("2026-11");
    expect(st.nominal.golongan["GP-01"].berlaku?.nominal).toBe(3_800_000);
    expect(st.nominal.golongan["GP-01"].berikutnya?.kode).toBe(v.kode);
    expect(st.riwayat.golongan["GP-01"].map((x) => x.kode)).toEqual(["NOM-0001", v.kode]);
  });

  it("slip draf yang memakai versi usang ditandai perlu dihitung ulang; pengajuan Gaji Bulanan menghitung ulang dengan versi berlaku", async () => {
    await masukSebagai("hrd");
    const a = await ajukan({ jenis: "TUNJANGAN", itemKode: "TNJ-02", nominal: 450_000, bulan: 11, tahun: 2026, alasan: "Kenaikan uang makan November" });
    expect(a.ok, galat(a)).toBe(true);
    // Versi November juga berlaku Desember (belum ada versi Desember), jadi draf Desember ikut terdampak.
    if (a.ok) expect(a.pesan).toMatch(/slip draf SLP-2026-11-KRY-05, SLP-2026-12-KRY-05 perlu dihitung ulang/);
    await masukSebagai("owner");
    const s = await nominal.setujuiNominal({ kode: kode(a) });
    expect(s.ok, galat(s)).toBe(true);
    if (s.ok) expect(s.pesan).toMatch(/Slip draf SLP-2026-11-KRY-05, SLP-2026-12-KRY-05 ditandai perlu dihitung ulang/);

    const b = (await barisHitungGaji("2026-11")).find((x) => x.karyawanKode === "KRY-05")!;
    expect([b.nominalBerubah, b.perluHitungUlang, b.settingBerubah]).toEqual([true, true, false]);
    expect(b.tampil.tunjLain.find((t) => t.nama === "Makan")?.nominal).toBe(450_000);
    // Satu pengajuan lain untuk November menunggu, dipakai tes berikutnya.
    await masukSebagai("hrd");
    expect((await ajukan({ jenis: "TUNJANGAN", itemKode: "TNJ-01", nominal: 350_000, bulan: 11, tahun: 2026 })).ok).toBe(true);
    expect((await gaji.hitungSlipSatu({ periode: "2026-11", karyawanKode: "KRY-05" })).ok).toBe(true);
    const baru = await slip("2026-11", "KRY-05");
    expect(baru.tunjangan.find((t) => t.tunjanganKode === "TNJ-02")).toMatchObject({ nominal: 450_000, versiKode: kode(a) });
    const aj = await distribusi.ajukanPenggajian({ periode: "2026-11" });
    expect(aj.ok, galat(aj)).toBe(true);
  });

  it("persetujuan memeriksa ulang pengaman: slip sudah diajukan menghalangi; penolakan wajib alasan dan dicatat", async () => {
    const v = await db.versiNominal.findFirstOrThrow({ where: { tunjanganKode: "TNJ-01", status: "DIAJUKAN" } });
    await masukSebagai("owner");
    expect(galat(await nominal.setujuiNominal({ kode: v.kode }))).toMatch(/Slip gaji November 2026 yang memakai nominal ini sudah diajukan ke Owner \(SLP-2026-11-KRY-05\).*Tolak pengajuan ini/);
    expect((await dataStrukturGaji("2026-11")).pengajuan.find((p) => p.kode === v.kode)?.pengaman.galat).toMatch(/sudah diajukan/);
    expect((await nominal.tolakNominal({ kode: v.kode, alasan: "" })).ok).toBe(false);
    const t = await nominal.tolakNominal({ kode: v.kode, alasan: "Slip November sudah diajukan, ajukan mulai Desember" });
    expect(t.ok, galat(t)).toBe(true);
    expect(await db.versiNominal.findUniqueOrThrow({ where: { kode: v.kode } })).toMatchObject({ status: "DITOLAK", alasanTolak: "Slip November sudah diajukan, ajukan mulai Desember" });
    expect(galat(await nominal.tolakNominal({ kode: v.kode, alasan: "dua kali" }))).toMatch(/sudah diputuskan/);
    expect((await db.logAktivitas.findFirstOrThrow({ where: { entitasId: v.kode, aksi: "nominal.tolak" } })).keterangan).toMatch(/Lama: TNJ-01 Transport: Rp300\.000.*Baru: TNJ-01 Transport: Rp350\.000.*Alasan tolak: Slip November/);
    // Ditolak tidak pernah berlaku.
    expect((await muatPetaNominal(db)).pada("TUNJANGAN", "TNJ-01", "2026-11")?.kode).toBe("NOM-0005");
  });

  it("tarif fee per tanggal: event memakai tarif yang berlaku di bulan tanggal selesai; laporan diajukan mengunci tarif bulannya", async () => {
    await masukSebagai("hrd");
    // FEE-2026-0001 (EVT-2026-0001 selesai 14 November) diajukan dan memakai JBT-06.
    expect(galat(await ajukan({ jenis: "JABATAN_EVENT", itemKode: "JBT-06", nominal: 25_000, bulan: 11, tahun: 2026 }))).toMatch(/Laporan fee November 2026 yang memakai nominal ini sudah diajukan ke Owner \(FEE-2026-0001\)/);
    const a = await ajukan({ jenis: "JABATAN_EVENT", itemKode: "JBT-06", nominal: 25_000, bulan: 12, tahun: 2026, alasan: "Tarif crew musim akhir tahun" });
    expect(a.ok, galat(a)).toBe(true);
    await masukSebagai("owner");
    expect((await nominal.setujuiNominal({ kode: kode(a) })).ok).toBe(true);

    // Event November tetap Rp20.000/jam; event yang selesai Desember memakai Rp25.000/jam.
    const nov = (await muatBahanEvent(db, "EVT-2026-0002"))!;
    expect(nov.orang.filter((o) => o.jabatanKode === "JBT-06").map((o) => [o.tarif, o.versiTarif?.kode])).toEqual(nov.orang.filter((o) => o.jabatanKode === "JBT-06").map(() => [20_000, "NOM-0014"]));
    const e = await ev.simpanEvent({ nama: "Uji Tarif Desember", klien: "", tanggalMulai: "2026-11-30", tanggalSelesai: "2026-12-01" });
    expect(e.ok, galat(e)).toBe(true);
    expect((await ev.simpanPenugasan({ eventKode: kode(e), karyawanKode: "KRY-08", jabatanKode: "JBT-06" })).ok).toBe(true);
    const des = (await muatBahanEvent(db, kode(e)))!;
    expect([des.periodeTarif, des.orang[0].tarif, des.orang[0].versiTarif?.kode]).toEqual(["2026-12", 25_000, kode(a)]);
    // Event yang belum dikirim kapten ikut versi yang berlaku: tanggal dimundurkan ke November, tarifnya kembali lama.
    expect((await ev.simpanEvent({ kode: kode(e), nama: "Uji Tarif Desember", klien: "", tanggalMulai: "2026-11-30", tanggalSelesai: "2026-11-30" })).ok).toBe(true);
    expect((await muatBahanEvent(db, kode(e)))!.orang[0].tarif).toBe(20_000);

    // Slip fee menyimpan versi tarif yang dipakai.
    const b = (await muatBahanEvent(db, "EVT-2026-0001"))!;
    const h = await putus.setujuiFee({ no: "FEE-2026-0001", fee: b.orang.map((o) => ({ karyawanKode: o.karyawanKode, feeAkhir: o.usulan.fee })) });
    expect(h.ok, galat(h)).toBe(true);
    const sf = await db.slipFee.findMany({ where: { laporanNo: "FEE-2026-0001" }, select: { jabatanKode: true, versiTarifKode: true } });
    expect(sf.every((x) => x.versiTarifKode === (x.jabatanKode === "JBT-05" ? "NOM-0013" : "NOM-0014"))).toBe(true);
    expect((await slipFeeLaporan("FEE-2026-0001"))[0].sumberTarif).toMatch(/^Tarif event .*, berlaku mulai Oktober 2026 \(NOM-001[34]\)$/);
  });

  it("master baru: nominal awal menunggu Owner; setting gaji yang memakainya ditolak sampai disetujui", async () => {
    await masukSebagai("hrd");
    const g = await master.simpanMaster({ jenis: "golongan", nilai: { nama: "Golongan Uji Baru", jumlah: 5_000_000, bulan: 12, tahun: 2026 } });
    expect(g.ok, galat(g)).toBe(true);
    if (g.ok) expect(g.pesan).toMatch(/Nominal awal NOM-\d{4} \(berlaku Desember 2026\) menunggu persetujuan Owner/);
    const awal = await db.versiNominal.findFirstOrThrow({ where: { golonganKode: kode(g) } });
    const set = { karyawanKode: "KRY-02", jenisPerubahan: "PROMOSI", jabatanKode: "JBT-04", golonganKode: kode(g), tunjanganKodes: ["TNJ-01"], bulan: 12, tahun: 2026, alasan: "uji golongan baru" };
    expect(galat(await sg.ajukanSettingGaji(set))).toMatch(/Gaji pokok Golongan Uji Baru belum punya nominal yang disetujui dan berlaku di Desember 2026/);
    await masukSebagai("owner");
    expect((await nominal.setujuiNominal({ kode: awal.kode })).ok).toBe(true);
    await masukSebagai("hrd");
    expect((await sg.ajukanSettingGaji(set)).ok).toBe(true);
  });

  it("pengajuan lama buatan Owner yang masih menunggu tetap bisa diputuskan Owner", async () => {
    // Meniru data sebelum aturan HRD saja: versi DIAJUKAN dengan pengaju Owner, dibuat lewat layanan server.
    const owner = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "owner" } });
    const buat = (itemKode: string, nilai: number) =>
      db.$transaction((tx) => ajukanNominalDalam(tx, owner.id, { jenis: "JABATAN_EVENT", itemKode, nominal: nilai, tunjJabatan: 0, tunjKeluarga: 0, berlaku: "2027-02", alasan: "Pengajuan lama Owner" }));
    const [setuju, tolak] = [await buat("JBT-05", 230_000), await buat("JBT-06", 28_000)];
    await masukSebagai("owner");
    const s = await nominal.setujuiNominal({ kode: setuju.kode });
    expect(s.ok, galat(s)).toBe(true);
    const t = await nominal.tolakNominal({ kode: tolak.kode, alasan: "Diajukan ulang oleh HRD" });
    expect(t.ok, galat(t)).toBe(true);
    expect(await db.versiNominal.findUniqueOrThrow({ where: { kode: setuju.kode } })).toMatchObject({ status: "DISETUJUI", diajukanOlehId: owner.id, diputuskanOlehId: owner.id });
    expect((await db.versiNominal.findUniqueOrThrow({ where: { kode: tolak.kode } })).status).toBe("DITOLAK");
  });
});

it.skipIf(aktif)("tes database riwayat nominal dilewati (set UJI_DB=1 untuk menjalankan)", () => {});
