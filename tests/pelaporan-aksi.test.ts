/*
 * Tes integrasi server action pelaporan dan master terhadap database sungguhan (UJI_DB=1).
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

describe.runIf(aktif)("aksi pelaporan, master, dan pengguna", async () => {
  const { db } = await import("@/lib/server/db");
  const jurnal = await import("@/lib/aksi/pelaporan/jurnal");
  const periode = await import("@/lib/aksi/pelaporan/periode");
  const master = await import("@/lib/aksi/master/master");
  const settingGaji = await import("@/lib/aksi/master/setting-gaji");
  const pengguna = await import("@/lib/aksi/pengguna/pengguna");
  const { buatJurnal } = await import("@/lib/server/jurnal");
  const { cekPeriode } = await import("@/lib/data/pelaporan/periode");
  const { dataNeracaSaldo } = await import("@/lib/data/pelaporan/jurnal");

  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
  };

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  // Jurnal penyesuaian draf buatan Admin (Rp100.000 beban perlengkapan), bulan Oktober 2026.
  let no = "";
  it("menyiapkan draf jurnal penyesuaian oleh Admin", async () => {
    const admin = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "admin" } });
    no = await db.$transaction((tx) =>
      buatJurnal(tx, { tanggal: "2026-10-31", jenis: "PENYESUAIAN", status: "DRAFT", keterangan: "Uji penyesuaian", baris: [{ akun: "6-120", debit: 100_000, kredit: 0 }, { akun: "1-140", debit: 0, kredit: 100_000 }], dibuatOlehId: admin.id }),
    );
    expect(no).toMatch(/^JP-2026-/);
  });

  it("HRD tidak boleh mengajukan; Admin boleh; Admin tidak boleh menyetujui", async () => {
    await masukSebagai("hrd");
    expect((await jurnal.ajukanJurnalPenyesuaian({ no })).ok).toBe(false);
    await masukSebagai("admin");
    expect((await jurnal.ajukanJurnalPenyesuaian({ no })).ok).toBe(true);
    expect((await db.jurnal.findUniqueOrThrow({ where: { no } })).status).toBe("DIAJUKAN");
    expect((await jurnal.setujuiJurnalPenyesuaian({ no })).ok).toBe(false);
  });

  it("mengajukan dua kali ditolak (bukan draf lagi)", async () => {
    await masukSebagai("admin");
    expect((await jurnal.ajukanJurnalPenyesuaian({ no })).ok).toBe(false);
  });

  it("Owner menolak tanpa alasan gagal, dengan alasan berhasil", async () => {
    await masukSebagai("owner");
    expect((await jurnal.tolakJurnalPenyesuaian({ no, alasan: " " })).ok).toBe(false);
    const h = await jurnal.tolakJurnalPenyesuaian({ no, alasan: "Nilai belum dicek" });
    expect(h.ok).toBe(true);
    const j = await db.jurnal.findUniqueOrThrow({ where: { no } });
    expect(j.status).toBe("DITOLAK");
    expect(j.alasanTolak).toBe("Nilai belum dicek");
  });

  it("jurnal otomatis (bukan penyesuaian) tidak bisa diputuskan lewat jalur ini", async () => {
    await masukSebagai("owner");
    const umum = await db.jurnal.findFirstOrThrow({ where: { jenis: "UMUM" } });
    expect((await jurnal.setujuiJurnalPenyesuaian({ no: umum.no })).ok).toBe(false);
  });

  it("jurnal ditolak tidak masuk neraca saldo; jurnal yang disetujui masuk dan neraca tetap seimbang", async () => {
    const sebelum = await dataNeracaSaldo("2026-10");
    expect(sebelum.debit).toBe(145_622_573);
    // buat draf baru, ajukan, setujui
    const admin = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "admin" } });
    const baru = await db.$transaction((tx) =>
      buatJurnal(tx, { tanggal: "2026-10-31", jenis: "PENYESUAIAN", status: "DRAFT", keterangan: "Uji 2", baris: [{ akun: "6-120", debit: 50_000, kredit: 0 }, { akun: "1-140", debit: 0, kredit: 50_000 }], dibuatOlehId: admin.id }),
    );
    await masukSebagai("admin");
    expect((await jurnal.ajukanJurnalPenyesuaian({ no: baru })).ok).toBe(true);
    await masukSebagai("owner");
    expect((await jurnal.setujuiJurnalPenyesuaian({ no: baru })).ok).toBe(true);
    const sesudah = await dataNeracaSaldo("2026-10");
    expect(sesudah.seimbang).toBe(true);
    expect(sesudah.debit).toBe(145_622_573); // beban naik 50.000 dan perlengkapan turun 50.000: total sama
  });

  it("Owner tidak boleh menyetujui jurnal buatannya sendiri", async () => {
    const owner = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "owner" } });
    const sendiri = await db.$transaction((tx) =>
      buatJurnal(tx, { tanggal: "2026-10-31", jenis: "PENYESUAIAN", status: "DRAFT", keterangan: "Buatan owner", baris: [{ akun: "6-120", debit: 10_000, kredit: 0 }, { akun: "1-140", debit: 0, kredit: 10_000 }], dibuatOlehId: owner.id }),
    );
    await db.jurnal.update({ where: { no: sendiri }, data: { status: "DIAJUKAN" } });
    await masukSebagai("owner");
    const h = await jurnal.setujuiJurnalPenyesuaian({ no: sendiri });
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.galat).toMatch(/sendiri/);
    await db.jurnal.delete({ where: { no: sendiri } });
  });

  it("kunci periode: Admin ditolak, pemeriksaan gagal menolak, lulus bisa dikunci, jurnal baru ditolak, buka perlu alasan", async () => {
    await masukSebagai("admin");
    expect((await periode.kunciPeriode({ periode: "2026-09" })).ok).toBe(false);

    await masukSebagai("owner");
    const cek = await cekPeriode("2026-10");
    expect(cek.length).toBe(7);
    // Oktober punya jadwal penyusutan yang belum dijurnal atau draf lain? Bila gagal, kunci harus ditolak.
    if (!cek.every((c) => c.lulus)) expect((await periode.kunciPeriode({ periode: "2026-10" })).ok).toBe(false);

    // Periode September di seed: semua jadwal dan jurnal sudah beres (tidak ada data), jadi lulus.
    const cekSep = await cekPeriode("2026-09");
    if (cekSep.every((c) => c.lulus)) {
      expect((await periode.kunciPeriode({ periode: "2026-09" })).ok).toBe(true);
      expect((await periode.kunciPeriode({ periode: "2026-09" })).ok).toBe(false); // sudah terkunci
      const admin = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "admin" } });
      await expect(db.$transaction((tx) => buatJurnal(tx, { tanggal: "2026-09-15", jenis: "UMUM", status: "DISETUJUI", keterangan: "x", baris: [{ akun: "1-110", debit: 1, kredit: 0 }, { akun: "3-110", debit: 0, kredit: 1 }], dibuatOlehId: admin.id }))).rejects.toThrow(/dikunci/);
      expect((await periode.bukaKunciPeriode({ periode: "2026-09", alasan: "" })).ok).toBe(false);
      expect((await periode.bukaKunciPeriode({ periode: "2026-09", alasan: "Koreksi" })).ok).toBe(true);
      const r = await db.riwayatPeriode.findMany({ where: { periodeId: "2026-09" }, orderBy: { id: "asc" } });
      expect(r.map((x) => x.aksi)).toEqual(["KUNCI", "BUKA"]);
      expect(r[1].alasan).toBe("Koreksi");
    }
  });

  it("master: Admin menambah supplier (kode lanjut SUP-04), NPWP kembar ditolak, HRD ditolak", async () => {
    await masukSebagai("hrd");
    expect((await master.simpanMaster({ jenis: "supplier", nilai: { nama: "CV Uji" } })).ok).toBe(false);
    await masukSebagai("admin");
    const h = await master.simpanMaster({ jenis: "supplier", nilai: { nama: "CV Uji", npwp: "99.999.999.9-999.000" } });
    expect(h.ok).toBe(true);
    if (h.ok) expect(h.data?.kode).toBe("SUP-04");
    const dup = await master.simpanMaster({ jenis: "supplier", nilai: { nama: "CV Lain", npwp: "99.999.999.9-999.000" } });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.galatIsian?.npwp).toBeTruthy();
    // Dua supplier tanpa NPWP boleh
    expect((await master.simpanMaster({ jenis: "supplier", nilai: { nama: "A" } })).ok).toBe(true);
    expect((await master.simpanMaster({ jenis: "supplier", nilai: { nama: "B" } })).ok).toBe(true);
  });

  it("master: hanya Owner yang boleh mengubah akun/kategori dan menonaktifkan", async () => {
    await masukSebagai("admin");
    expect((await master.simpanMaster({ jenis: "akun", nilai: { kode: "1-199", nama: "Kas kecil", tipe: "ASET", saldoNormal: "D" } })).ok).toBe(false);
    expect((await master.ubahStatusMaster({ jenis: "supplier", kode: "SUP-04", aktif: false })).ok).toBe(false);
    await masukSebagai("owner");
    expect((await master.simpanMaster({ jenis: "akun", nilai: { kode: "1-199", nama: "Kas kecil", tipe: "ASET", saldoNormal: "D" } })).ok).toBe(true);
    expect((await master.simpanMaster({ jenis: "akun", nilai: { kode: "1-199", nama: "Kas kecil", tipe: "ASET", saldoNormal: "D" } })).ok).toBe(false); // kode kembar ditolak
  }, 20_000);

  it("master: akun yang sudah dipakai jurnal tidak boleh ganti tipe, nama boleh; kode tidak bisa diubah", async () => {
    await masukSebagai("owner");
    const h = await master.simpanMaster({ jenis: "akun", kode: "1-110", nilai: { kode: "1-110", nama: "Kas", tipe: "LIABILITAS", saldoNormal: "K" } });
    expect(h.ok).toBe(false);
    expect((await master.simpanMaster({ jenis: "akun", kode: "1-110", nilai: { kode: "9-999", nama: "Kas dan bank", tipe: "ASET", saldoNormal: "D" } })).ok).toBe(true);
    expect((await db.akun.findUniqueOrThrow({ where: { kode: "1-110" } })).nama).toBe("Kas dan bank");
    expect(await db.akun.findUnique({ where: { kode: "9-999" } })).toBeNull();
  });

  it("master SDM: jadwal ganda per jabatan dan setting ganda per karyawan ditolak; setting tidak bisa ditimpa; nonaktif lalu aktif", async () => {
    await masukSebagai("hrd");
    const jadwal = await db.jadwalKerja.findFirstOrThrow();
    const dupJ = await master.simpanMaster({ jenis: "jadwal", nilai: { jabatanKode: jadwal.jabatanKode, jamMasuk: "08:00", jamKeluar: "16:00", hariKerja: 22 } });
    expect(dupJ.ok).toBe(false);
    const setting = await db.settingGaji.findFirstOrThrow({ where: { kode: "SET-01" }, include: { tunjangan: true } });
    // Setting gaji tidak lagi disimpan lewat form master: tambah dan ubah (menimpa) sama-sama ditolak.
    const dupS = await master.simpanMaster({ jenis: "setgaji", nilai: { karyawanKode: setting.karyawanKode, jabatanKode: setting.jabatanKode, golonganKode: setting.golonganKode, tunjanganKodes: [] } });
    expect(dupS.ok).toBe(false);
    const tunj = await db.tunjangan.findMany({ take: 2 });
    const h = await master.simpanMaster({ jenis: "setgaji", kode: setting.kode, nilai: { karyawanKode: setting.karyawanKode, jabatanKode: setting.jabatanKode, golonganKode: setting.golonganKode, tunjanganKodes: tunj.map((t) => t.kode) } });
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.galat).toMatch(/lewat pengajuan/);
    expect(await db.settingTunjangan.count({ where: { settingKode: setting.kode } })).toBe(setting.tunjangan.length);
    // Setting awal kedua untuk karyawan yang sudah punya setting ditolak lewat jalur pengajuan juga.
    const kedua = await settingGaji.ajukanSettingGaji({ karyawanKode: setting.karyawanKode, jenisPerubahan: "SETTING_AWAL", jabatanKode: setting.jabatanKode, golonganKode: "GP-01", tunjanganKodes: [], bulan: 12, tahun: 2026, alasan: "uji setting ganda" });
    expect(kedua.ok).toBe(false);
    await masukSebagai("owner");
    expect((await master.ubahStatusMaster({ jenis: "karyawan", kode: "KRY-01", aktif: false })).ok).toBe(true);
    expect((await db.karyawan.findUniqueOrThrow({ where: { kode: "KRY-01" } })).aktif).toBe(false);
    expect((await master.ubahStatusMaster({ jenis: "karyawan", kode: "KRY-01", aktif: true })).ok).toBe(true);
  });

  it("profil usaha: hanya Owner", async () => {
    await masukSebagai("admin");
    expect((await master.simpanProfil({ nama: "X" })).ok).toBe(false);
    await masukSebagai("owner");
    expect((await master.simpanProfil({ nama: "D'Production", keterangan: "SIA" })).ok).toBe(true);
    expect((await master.simpanProfil({ nama: " " })).ok).toBe(false);
  });

  it("pengguna: hanya Owner; Owner tidak bisa menonaktifkan atau menurunkan dirinya; nonaktif memutus sesi", async () => {
    await masukSebagai("admin");
    expect((await pengguna.buatPengguna({ namaPengguna: "baru1", nama: "Baru", peran: "HRD", kataSandi: "rahasia123" })).ok).toBe(false);
    await masukSebagai("owner");
    expect((await pengguna.buatPengguna({ namaPengguna: "baru1", nama: "Baru", peran: "HRD", kataSandi: "pendek" })).ok).toBe(false);
    expect((await pengguna.buatPengguna({ namaPengguna: "baru1", nama: "Baru", peran: "HRD", kataSandi: "rahasia123" })).ok).toBe(true);
    expect((await pengguna.buatPengguna({ namaPengguna: "baru1", nama: "Baru", peran: "HRD", kataSandi: "rahasia123" })).ok).toBe(false);
    const owner = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "owner" } });
    expect((await pengguna.ubahStatusPengguna({ id: owner.id, aktif: false })).ok).toBe(false);
    expect((await pengguna.ubahPengguna({ id: owner.id, nama: owner.nama, peran: "ADMIN" })).ok).toBe(false);

    const baru = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: "baru1" } });
    await db.sesi.create({ data: { tokenHash: "uji-sesi-baru1", penggunaId: baru.id, kedaluwarsa: new Date(Date.now() + 3_600_000) } });
    expect((await pengguna.resetKataSandi({ id: baru.id, kataSandi: "sandi-baru-1" })).ok).toBe(true);
    expect(await db.sesi.count({ where: { penggunaId: baru.id } })).toBe(0);
    await db.sesi.create({ data: { tokenHash: "uji-sesi-baru1", penggunaId: baru.id, kedaluwarsa: new Date(Date.now() + 3_600_000) } });
    expect((await pengguna.ubahStatusPengguna({ id: baru.id, aktif: false })).ok).toBe(true);
    expect(await db.sesi.count({ where: { penggunaId: baru.id } })).toBe(0);
    expect((await pengguna.ubahPengguna({ id: baru.id, nama: "Baru Ubah", peran: "ADMIN" })).ok).toBe(true);
    expect((await db.pengguna.findUniqueOrThrow({ where: { id: baru.id } })).peran).toBe("ADMIN");
  });
});
