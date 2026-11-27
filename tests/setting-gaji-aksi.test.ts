/*
 * Tes integrasi riwayat setting gaji dan cek kas pembelian tunai lewat server action (UJI_DB=1).
 * Data contoh: SET-01 sampai SET-05 setting awal berlaku Oktober 2026 (slip Oktober sudah dibayar), SET-06 promosi
 * KRY-04 disetujui berlaku Desember 2026, SET-07 penyesuaian KRY-05 berlaku Januari 2027 menunggu Owner.
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

describe.runIf(aktif)("riwayat setting gaji dan cek kas pembelian tunai", async () => {
  const { db } = await import("@/lib/server/db");
  const sg = await import("@/lib/aksi/master/setting-gaji");
  const master = await import("@/lib/aksi/master/master");
  const presensi = await import("@/lib/aksi/sdm/presensi");
  const gajiBulanan = await import("@/lib/aksi/sdm/gaji-bulanan");
  const { simpanSlip } = await import("@/lib/server/gaji");
  const { ajukanSettingDalam } = await import("@/lib/server/setting-gaji");
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
  const beli = await import("@/lib/aksi/konversi/pembelian");
  const { muatBahanGaji, barisHitungGaji, kesiapanGaji, ringkasanTahunGaji } = await import("@/lib/data/sdm/gaji");
  const { dataSettingGaji } = await import("@/lib/data/master/setting-gaji");
  const { dataDashboard } = await import("@/lib/data/pelaporan/dashboard");

  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
  };
  const galat = (h: { ok: boolean; galat?: string }) => (h.ok ? "" : h.galat ?? "");
  const hadir = (karyawanKode: string, tanggal: string) => presensi.simpanPresensi({ karyawanKode, tanggal, absensi: "HADIR", jamMasuk: "08:00", jamKeluar: "17:00" });
  const slip = (periode: string, k: string) => db.slipGaji.findUniqueOrThrow({ where: { periodeId_karyawanKode: { periodeId: periode, karyawanKode: k } }, include: { tunjangan: true } });
  const ajukan = (x: Record<string, unknown>) => sg.ajukanSettingGaji({ tunjanganKodes: [], alasan: "uji riwayat setting gaji", ...x });

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  it("data contoh: versi dipilih per bulan, promosi KRY-04 baru berlaku Desember", async () => {
    const nov = (await muatBahanGaji(db, "2026-11")).find((b) => b.karyawanKode === "KRY-04")!;
    const des = (await muatBahanGaji(db, "2026-12")).find((b) => b.karyawanKode === "KRY-04")!;
    expect([nov.settingKode, nov.input.golongan.kode, nov.input.jabatan.kode]).toEqual(["SET-04", "GP-01", "JBT-02"]);
    expect([des.settingKode, des.input.golongan.kode, des.input.jabatan.kode]).toEqual(["SET-06", "GP-02", "JBT-03"]);
    expect((await muatBahanGaji(db, "2026-10")).map((b) => b.settingKode)).toEqual(["SET-01", "SET-02", "SET-03", "SET-04", "SET-05"]);
    // Slip contoh Oktober menyimpan versi yang dipakai.
    expect((await slip("2026-10", "KRY-04")).settingKode).toBe("SET-04");
    const d = await dataSettingGaji("2026-11");
    expect(d.pengajuan.map((p) => p.kode)).toEqual(["SET-07"]);
    expect(d.baris.find((b) => b.kode === "KRY-04")?.berikutnya?.kode).toBe("SET-06");
    // Bulan berlaku sama milik karyawan lain tidak saling menggantikan.
    expect(d.riwayat.filter((v) => v.digantikan)).toEqual([]);
  });

  it("akses terlarang: Owner dan Admin tidak boleh mengajukan, HRD tidak boleh memutuskan", async () => {
    const sebelum = await db.settingGaji.count();
    for (const u of ["owner", "admin"]) {
      await masukSebagai(u);
      expect(galat(await ajukan({ karyawanKode: "KRY-01", jenisPerubahan: "PROMOSI", jabatanKode: "JBT-01", golonganKode: "GP-03", bulan: 12, tahun: 2026 })), u).toMatch(/hanya untuk HRD\./);
    }
    expect(await db.settingGaji.count()).toBe(sebelum);
    await masukSebagai("hrd");
    expect(galat(await sg.setujuiSettingGaji({ kode: "SET-07" }))).toMatch(/hanya untuk OWNER/);
    expect(galat(await sg.tolakSettingGaji({ kode: "SET-07", alasan: "tidak boleh" }))).toMatch(/hanya untuk OWNER/);
    await masukSebagai("admin");
    expect(galat(await sg.setujuiSettingGaji({ kode: "SET-07" }))).toMatch(/hanya untuk OWNER/);
    expect((await db.settingGaji.findUniqueOrThrow({ where: { kode: "SET-07" } })).status).toBe("DIAJUKAN");
    // Jalur lama (form master) dan nonaktif versi juga tertutup.
    await masukSebagai("owner");
    expect(galat(await master.ubahStatusMaster({ jenis: "setgaji", kode: "SET-01", aktif: false }))).toMatch(/tidak dinonaktifkan/);
  });

  it("pengaman pengajuan: slip dibayar, isi sama, jenis salah, alasan kosong, bulan kembar, periode tertutup", async () => {
    await masukSebagai("hrd");
    const dasar = { karyawanKode: "KRY-01", jenisPerubahan: "PROMOSI", jabatanKode: "JBT-01", golonganKode: "GP-03", tunjanganKodes: ["TNJ-01"] };
    const okt = await ajukan({ ...dasar, bulan: 10, tahun: 2026 });
    expect(galat(okt)).toMatch(/Gaji Oktober 2026 karyawan ini sudah dibayar \(SLP-2026-10-KRY-01\), jadi setting baru paling awal berlaku November 2026/);
    if (!okt.ok) expect(okt.galatIsian?.bulan).toBeTruthy();
    expect(galat(await ajukan({ ...dasar, bulan: 9, tahun: 2026 }))).toMatch(/sudah dibayar/);
    expect(galat(await ajukan({ karyawanKode: "KRY-01", jenisPerubahan: "PENYESUAIAN", jabatanKode: "JBT-01", golonganKode: "GP-04", tunjanganKodes: ["TNJ-04", "TNJ-03", "TNJ-02", "TNJ-01"], bulan: 12, tahun: 2026 }))).toMatch(/Tidak ada yang berubah/);
    expect(galat(await ajukan({ ...dasar, jenisPerubahan: "SETTING_AWAL", bulan: 12, tahun: 2026 }))).toMatch(/sudah punya setting gaji/);
    const alasan = await ajukan({ ...dasar, bulan: 12, tahun: 2026, alasan: "x" });
    expect(alasan.ok).toBe(false);
    if (!alasan.ok) expect(alasan.galatIsian?.alasan).toMatch(/alasan/i);
    expect(galat(await ajukan({ karyawanKode: "KRY-05", jenisPerubahan: "PROMOSI", jabatanKode: "JBT-03", golonganKode: "GP-02", bulan: 1, tahun: 2027 }))).toMatch(/menunggu Owner/);
    await db.periode.update({ where: { id: "2026-12" }, data: { status: "TERKUNCI" } });
    expect(galat(await ajukan({ ...dasar, bulan: 11, tahun: 2026 }))).toMatch(/tertutup karena periode sesudahnya \(Desember 2026\) sudah dikunci/);
    await db.periode.update({ where: { id: "2026-12" }, data: { status: "TERBUKA" } });
    expect(await db.settingGaji.count({ where: { karyawanKode: "KRY-01" } })).toBe(1);
  });

  it("promosi berlaku bulan depan: slip bulan berjalan tetap gaji lama walau dihitung ulang, slip bulan berlaku memakai gaji baru, log nilai lama dan baru", async () => {
    await masukSebagai("hrd");
    expect((await hadir("KRY-03", "2026-11-02")).ok).toBe(true);
    expect((await gaji.hitungSlipSatu({ periode: "2026-11", karyawanKode: "KRY-03" })).ok).toBe(true);
    const novLama = await slip("2026-11", "KRY-03");
    expect([novLama.gajiPokok, novLama.jabatanKode, novLama.settingKode]).toEqual([4_500_000, "JBT-03", "SET-03"]);

    const a = await ajukan({ karyawanKode: "KRY-03", jenisPerubahan: "PROMOSI", jabatanKode: "JBT-01", golonganKode: "GP-03", tunjanganKodes: ["TNJ-01", "TNJ-02"], bulan: 12, tahun: 2026, alasan: "Promosi menjadi Event Manager" });
    expect(a.ok, galat(a)).toBe(true);
    const kode = a.ok ? a.data!.kode : "";
    expect(kode).toBe("SET-08");
    // Belum disetujui: Desember masih memakai setting lama.
    expect((await muatBahanGaji(db, "2026-12", "KRY-03"))[0].settingKode).toBe("SET-03");

    await masukSebagai("owner");
    const s = await sg.setujuiSettingGaji({ kode });
    expect(s.ok, galat(s)).toBe(true);
    if (s.ok) expect(s.pesan).toMatch(/berlaku mulai Desember 2026/);
    const v = await db.settingGaji.findUniqueOrThrow({ where: { kode } });
    expect([v.status, v.berlakuMulai, v.jenisPerubahan, v.diputuskanOlehId]).toEqual(["DISETUJUI", "2026-12", "PROMOSI", sesi.pengguna!.id]);
    // Versi lama tidak ditimpa.
    expect((await db.settingGaji.findUniqueOrThrow({ where: { kode: "SET-03" } })).golonganKode).toBe("GP-02");

    // Slip draf November dihitung ulang sesudah promosi disetujui: tetap gaji lama.
    await masukSebagai("hrd");
    expect((await gaji.hitungSlipSatu({ periode: "2026-11", karyawanKode: "KRY-03" })).ok).toBe(true);
    const novUlang = await slip("2026-11", "KRY-03");
    expect([novUlang.gajiPokok, novUlang.tunjJabatan, novUlang.bruto, novUlang.settingKode]).toEqual([novLama.gajiPokok, novLama.tunjJabatan, novLama.bruto, "SET-03"]);
    const bNov = (await barisHitungGaji("2026-11")).find((b) => b.karyawanKode === "KRY-03")!;
    expect(bNov.perluHitungUlang).toBe(false);
    // Hitung Gaji menampilkan versi yang dipakai dan versi lebih baru yang belum berlaku di bulan itu.
    expect(bNov.versi).toEqual({ kode: "SET-03", jabatan: "Operator Sound & Lighting", golongan: "Golongan II", berlakuMulai: "2026-10" });
    expect(bNov.catatanVersi).toBe(`Versi lebih baru ${kode} (promosi: Event Manager, Golongan III) baru berlaku Desember 2026`);
    // Slip Oktober yang sudah dibayar memakai versi yang tersimpan di slip.
    const bOkt = (await barisHitungGaji("2026-10")).find((b) => b.karyawanKode === "KRY-03")!;
    expect([bOkt.slipStatus, bOkt.versi.kode]).toEqual(["DISETUJUI", "SET-03"]);

    // Desember memakai gaji baru, termasuk jadwal kerja jabatan baru.
    expect((await hadir("KRY-03", "2026-12-01")).ok).toBe(true);
    expect((await gaji.hitungSlipSatu({ periode: "2026-12", karyawanKode: "KRY-03" })).ok).toBe(true);
    const des = await slip("2026-12", "KRY-03");
    expect([des.gajiPokok, des.jabatanKode, des.tunjJabatan, des.settingKode]).toEqual([5_800_000, "JBT-01", 1_500_000, kode]);
    expect(des.tunjangan.map((t) => t.tunjanganKode).sort()).toEqual(["TNJ-01", "TNJ-02"]);

    const log = await db.logAktivitas.findMany({ where: { entitas: "setgaji", entitasId: kode }, orderBy: { id: "asc" } });
    expect(log.map((l) => l.aksi)).toEqual(["setting-gaji.ajukan", "setting-gaji.setujui"]);
    for (const l of log) {
      expect(l.keterangan).toMatch(/Lama: JBT-03 Operator Sound & Lighting, GP-02 Golongan II Rp4\.500\.000, tunj\. jabatan Rp500\.000, tunjangan \[Transport Rp300\.000, Makan Rp400\.000\], berlaku Oktober 2026/);
      expect(l.keterangan).toMatch(/Baru: JBT-01 Event Manager, GP-03 Golongan III Rp5\.800\.000, tunj\. jabatan Rp1\.500\.000, tunjangan \[Transport Rp300\.000, Makan Rp400\.000\], berlaku Desember 2026/);
    }
    expect(log[1].penggunaId).toBe((await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "owner" } })).id);
  });

  it("slip draf di bulan berlaku ditandai perlu dihitung ulang; pengajuan Gaji Bulanan memakai setting yang berlaku", async () => {
    await masukSebagai("hrd");
    expect((await hadir("KRY-02", "2026-11-02")).ok).toBe(true);
    expect((await gaji.hitungSlipSatu({ periode: "2026-11", karyawanKode: "KRY-02" })).ok).toBe(true);
    const a = await ajukan({ karyawanKode: "KRY-02", jenisPerubahan: "PENYESUAIAN", jabatanKode: "JBT-04", golonganKode: "GP-02", tunjanganKodes: ["TNJ-01", "TNJ-02", "TNJ-03", "TNJ-04"], bulan: 11, tahun: 2026 });
    expect(a.ok, galat(a)).toBe(true);
    if (a.ok) expect(a.pesan).toMatch(/slip draf SLP-2026-11-KRY-02 perlu dihitung ulang/);
    const kode = a.ok ? a.data!.kode : "";
    await masukSebagai("owner");
    const s = await sg.setujuiSettingGaji({ kode });
    expect(s.ok, galat(s)).toBe(true);
    if (s.ok) expect(s.pesan).toMatch(/SLP-2026-11-KRY-02 ditandai perlu dihitung ulang/);
    const b = (await barisHitungGaji("2026-11")).find((x) => x.karyawanKode === "KRY-02")!;
    expect([b.settingBerubah, b.perluHitungUlang]).toEqual([true, true]);
    // Slip draf tidak dihapus, tetapi tidak bisa diajukan sebelum dihitung ulang.
    expect((await slip("2026-11", "KRY-02")).settingKode).toBe("SET-02");

    await masukSebagai("hrd");
    expect((await gaji.hitungSlipSatu({ periode: "2026-11", karyawanKode: "KRY-02" })).ok).toBe(true);
    const baru = await slip("2026-11", "KRY-02");
    expect(baru.settingKode).toBe(kode);
    expect(baru.tunjangan.map((t) => t.tunjanganKode)).toContain("TNJ-03");

    // Pengajuan KRY-03 berlaku November dibuat selagi slipnya masih draf, lalu gaji November diajukan ke Owner.
    const tunda = await ajukan({ karyawanKode: "KRY-03", jenisPerubahan: "PENYESUAIAN", jabatanKode: "JBT-03", golonganKode: "GP-02", tunjanganKodes: ["TNJ-01"], bulan: 11, tahun: 2026 });
    expect(tunda.ok, galat(tunda)).toBe(true);
    expect((await distribusi.ajukanPenggajian({ periode: "2026-11" })).ok).toBe(true);
    expect((await slip("2026-11", "KRY-03")).status).toBe("DIAJUKAN");

    // Ringkasan per tahun: Oktober dibayar (5 slip contoh), November diajukan, Desember slip draf.
    const r = await ringkasanTahunGaji(2026);
    expect(r).toHaveLength(12);
    const bulan = (p: string) => r.find((x) => x.periode === p)!;
    expect([bulan("2026-10").status, bulan("2026-10").dibayar, bulan("2026-10").thp]).toEqual(["DIBAYAR", 5, 31_200_343]);
    expect([bulan("2026-11").status, bulan("2026-11").diajukan]).toEqual(["DIAJUKAN", 2]);
    expect([bulan("2026-12").status, bulan("2026-12").draf]).toEqual(["DRAF", 1]);
    expect(bulan("2026-01").status).toBe("KOSONG");
  });

  it("persetujuan memeriksa ulang pengaman: slip sudah diajukan menghalangi; Owner menolak dengan alasan wajib dan log", async () => {
    const v = await db.settingGaji.findFirstOrThrow({ where: { karyawanKode: "KRY-03", status: "DIAJUKAN", berlakuMulai: "2026-11" } });
    await masukSebagai("owner");
    expect(galat(await sg.setujuiSettingGaji({ kode: v.kode }))).toMatch(/Gaji November 2026 karyawan ini sudah diajukan ke Owner \(SLP-2026-11-KRY-03\)/);
    expect((await dataSettingGaji("2026-11")).pengajuan.find((p) => p.kode === v.kode)?.pengaman.galat).toMatch(/sudah diajukan/);
    expect((await sg.tolakSettingGaji({ kode: v.kode, alasan: "" })).ok).toBe(false);
    const t = await sg.tolakSettingGaji({ kode: v.kode, alasan: "Gaji November sudah diajukan, ajukan ulang mulai Desember" });
    expect(t.ok, galat(t)).toBe(true);
    const sesudah = await db.settingGaji.findUniqueOrThrow({ where: { kode: v.kode } });
    expect([sesudah.status, sesudah.alasanTolak]).toEqual(["DITOLAK", "Gaji November sudah diajukan, ajukan ulang mulai Desember"]);
    expect(galat(await sg.tolakSettingGaji({ kode: v.kode, alasan: "dua kali" }))).toMatch(/sudah diputuskan/);
    const log = await db.logAktivitas.findFirstOrThrow({ where: { entitas: "setgaji", entitasId: v.kode, aksi: "setting-gaji.tolak" } });
    expect(log.keterangan).toMatch(/Lama: JBT-03 .* berlaku Oktober 2026\. Baru: JBT-03 .* berlaku November 2026\. Alasan tolak: Gaji November sudah diajukan/);
    // Ditolak tidak pernah berlaku.
    expect((await muatBahanGaji(db, "2026-11", "KRY-03"))[0].settingKode).toBe("SET-03");
  });

  it("karyawan baru: setting awal menunggu Owner, presensi ditolak, kesiapan 'belum ada setting gaji berlaku'", async () => {
    await masukSebagai("hrd");
    const k = await master.simpanMaster({ jenis: "karyawan", nilai: { nama: "Karyawan Baru Uji", statusPtkp: "TK0", bank: "BCA", noRek: "123", jenis: "INHOUSE" } });
    expect(k.ok).toBe(true);
    const kode = k.ok ? k.data!.kode : "";
    const a = await ajukan({ karyawanKode: kode, jenisPerubahan: "SETTING_AWAL", jabatanKode: "JBT-02", golonganKode: "GP-01", tunjanganKodes: ["TNJ-02"], bulan: 12, tahun: 2026 });
    expect(a.ok, galat(a)).toBe(true);
    expect(galat(await hadir(kode, "2026-12-02"))).toMatch(/belum punya setting gaji yang disetujui dan berlaku di Desember 2026/);
    const ks = (await kesiapanGaji("2026-12", await barisHitungGaji("2026-12"))).find((x) => x.karyawanKode === kode)!;
    expect([ks.adaSetting, ks.catatanSetting]).toEqual([false, "Pengajuan berlaku Desember 2026 menunggu Owner"]);
    expect((await dataDashboard("2026-11")).tindakan.find((t) => t.href === "/sdm/setting-gaji")?.judul).toMatch(/2 pengajuan setting gaji menunggu keputusan/);

    await masukSebagai("owner");
    expect((await sg.setujuiSettingGaji({ kode: a.ok ? a.data!.kode : "" })).ok).toBe(true);
    await masukSebagai("hrd");
    expect((await hadir(kode, "2026-12-02")).ok).toBe(true);
    expect((await kesiapanGaji("2026-11", await barisHitungGaji("2026-11"))).find((x) => x.karyawanKode === kode)?.catatanSetting).toBe("Setting disetujui, baru berlaku Desember 2026");
  });

  it("pengajuan lama buatan Owner yang masih menunggu tetap bisa diputuskan Owner", async () => {
    // Meniru data sebelum aturan HRD saja: versi DIAJUKAN dengan pengaju Owner, dibuat lewat layanan server.
    const owner = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "owner" } });
    const a = await db.$transaction((tx) =>
      ajukanSettingDalam(tx, owner.id, { karyawanKode: "KRY-01", jenisPerubahan: "DEMOSI", jabatanKode: "JBT-03", golonganKode: "GP-03", tunjanganKodes: ["TNJ-01"], alasan: "Pengajuan lama Owner" }, "2027-01"),
    );
    await masukSebagai("owner");
    const s = await sg.setujuiSettingGaji({ kode: a.kode });
    expect(s.ok, galat(s)).toBe(true);
    expect(await db.settingGaji.findUniqueOrThrow({ where: { kode: a.kode } })).toMatchObject({ status: "DISETUJUI", diajukanOlehId: owner.id, diputuskanOlehId: owner.id });
  });

  it("posting pembelian tunai menolak bila saldo kas tidak cukup, termasuk tanggal mundur; kredit tidak memakai kas", async () => {
    await masukSebagai("admin");
    const besar = await beli.simpanPembelian({ jenis: "PERLENGKAPAN", tanggal: "2026-11-05", caraBayar: "TUNAI", supplierKode: "SUP-01", baris: [{ barangKode: "LKP-01", qty: 10, harga: 100_000_000 }], posting: true });
    expect(galat(besar)).toMatch(/Saldo kas Rp[\d.]+ tidak cukup untuk membayar pembelian tunai BL-2026-\d{4} Rp1\.000\.000\.000\. Kurang Rp[\d.]+\. Catat setoran modal di menu Investasi Kas/);
    const mundur = await beli.simpanPembelian({ jenis: "PERLENGKAPAN", tanggal: "2026-09-25", caraBayar: "TUNAI", supplierKode: "SUP-01", baris: [{ barangKode: "LKP-01", qty: 1, harga: 50_000 }], posting: true });
    expect(galat(mundur)).toMatch(/Saldo kas Rp0 tidak cukup .* Saldo yang dipakai: akhir September 2026/);
    // Draf tunai yang sudah ada juga dicek saat diposting.
    const draf = await beli.simpanPembelian({ jenis: "PERLENGKAPAN", tanggal: "2026-11-05", caraBayar: "TUNAI", supplierKode: "SUP-01", baris: [{ barangKode: "LKP-01", qty: 10, harga: 100_000_000 }] });
    expect(draf.ok, galat(draf)).toBe(true);
    const no = (await db.pembelian.findFirstOrThrow({ where: { status: "DRAFT", tanggal: new Date("2026-11-05T00:00:00Z") }, orderBy: { no: "desc" } })).no;
    expect(galat(await beli.postingPembelian({ no }))).toMatch(/tidak cukup untuk membayar pembelian tunai/);
    expect((await db.pembelian.findUniqueOrThrow({ where: { no } })).status).toBe("DRAFT");
    const kredit = await beli.simpanPembelian({ jenis: "PERLENGKAPAN", tanggal: "2026-09-25", caraBayar: "KREDIT", jatuhTempo: "2026-10-25", supplierKode: "SUP-01", baris: [{ barangKode: "LKP-01", qty: 1, harga: 50_000 }], posting: true });
    expect(kredit.ok, galat(kredit)).toBe(true);
    const cukup = await beli.simpanPembelian({ jenis: "PERLENGKAPAN", tanggal: "2026-11-05", caraBayar: "TUNAI", supplierKode: "SUP-01", baris: [{ barangKode: "LKP-01", qty: 1, harga: 50_000 }], posting: true });
    expect(cukup.ok, galat(cukup)).toBe(true);
  });
});

it.skipIf(aktif)("tes riwayat setting gaji dilewati (set UJI_DB=1 untuk menjalankan)", () => {});
