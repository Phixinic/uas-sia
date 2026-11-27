/*
 * Tes integrasi tab Struktur gaji di Master SDM (UJI_DB=1). Tab ini hanya menggabungkan tampilan: tambah, ubah, dan
 * nonaktifkan tetap lewat simpanMaster dan ubahStatusMaster. Tambah dan ubah hanya HRD; Owner hanya memutuskan
 * pengajuan nominal serta mengaktifkan dan menonaktifkan.
 * Ringkasan pemakaian dihitung dari setting gaji yang berlaku bulan berjalan (sama dengan halaman Setting Gaji).
 * Nominal berversi: data baru mengajukan nominal awal (menunggu Owner), ubah data tidak pernah mengubah nominal.
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

describe.runIf(aktif)("tab Struktur gaji: izin aksi dan ringkasan pemakaian", async () => {
  const { db } = await import("@/lib/server/db");
  const master = await import("@/lib/aksi/master/master");
  const { dataStrukturGaji } = await import("@/lib/data/master/struktur-gaji");
  const { dataSettingGaji } = await import("@/lib/data/master/setting-gaji");
  const { IZIN } = await import("@/lib/peran");
  const { DEF_MASTER, JENIS_STRUKTUR } = await import("@/lib/skema/master");

  const masukSebagai = async (u: string) => {
    const p = await db.pengguna.findUniqueOrThrow({ where: { namaPengguna: u } });
    sesi.pengguna = { id: p.id, namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran };
  };
  const { muatPetaNominal } = await import("@/lib/server/nominal");
  const nominalDi = async (jenis: "GOLONGAN" | "TUNJANGAN" | "JABATAN" | "JABATAN_EVENT", kode: string, periode = "2026-11") => (await muatPetaNominal(db)).pada(jenis, kode, periode);
  const berlaku = { bulan: 12, tahun: 2026 };
  const contoh = {
    jabatan: { nama: "Jabatan Uji Struktur", tunjJabatan: 250000, tunjKeluarga: 100000, akunBebanKode: "6-210", ...berlaku },
    jabatanEvent: { nama: "Crew Uji Struktur", peranEvent: "CREW", satuanTarif: "JAM", tarif: 25000, akunBebanKode: "6-230", ...berlaku },
    golongan: { nama: "Golongan Uji Struktur", jumlah: 4200000, ...berlaku },
    tunjangan: { nama: "Tunjangan Uji Struktur", nominal: 150000, ...berlaku },
  } as const;

  beforeAll(() => seed(), 60_000);
  afterAll(async () => {
    await db.$disconnect();
    seed();
  }, 60_000);

  it("izin: keempat jenis ditambah dan diubah HRD saja; nonaktifkan tetap Owner", () => {
    expect(JENIS_STRUKTUR.map((j) => [j, IZIN[DEF_MASTER[j].izin]])).toEqual(JENIS_STRUKTUR.map((j) => [j, ["HRD"]]));
    expect(IZIN["master.nonaktifkan"]).toEqual(["OWNER"]);
  });

  it("Admin tidak bisa menambah, mengubah, atau menonaktifkan apa pun di Struktur gaji", async () => {
    await masukSebagai("admin");
    for (const jenis of JENIS_STRUKTUR) expect((await master.simpanMaster({ jenis, nilai: contoh[jenis] })).ok, jenis).toBe(false);
    expect((await master.simpanMaster({ jenis: "golongan", kode: "GP-01", nilai: { nama: "Golongan I", jumlah: 1 } })).ok).toBe(false);
    expect((await master.ubahStatusMaster({ jenis: "golongan", kode: "GP-01", aktif: false })).ok).toBe(false);
    expect((await nominalDi("GOLONGAN", "GP-01"))?.nominal).toBe(3_800_000);
  });

  it("Owner tidak bisa menambah atau mengubah data struktur gaji, jadi tidak ada pengajuan nominal awal dari Owner", async () => {
    await masukSebagai("owner");
    const hitung = async () => [await db.jabatan.count(), await db.golongan.count(), await db.tunjangan.count(), await db.versiNominal.count()];
    const sebelum = await hitung();
    const kodeContoh = { jabatan: "JBT-01", jabatanEvent: "JBT-06", golongan: "GP-01", tunjangan: "TNJ-01" } as const;
    for (const jenis of JENIS_STRUKTUR) {
      for (const kode of [undefined, kodeContoh[jenis]]) {
        const h = await master.simpanMaster({ jenis, kode, nilai: contoh[jenis] });
        expect(h.ok ? "" : h.galat, `${jenis} ${kode ?? "baru"}`).toMatch(/hanya untuk HRD\./);
      }
    }
    expect(await hitung()).toEqual(sebelum);
    expect((await db.golongan.findUniqueOrThrow({ where: { kode: "GP-01" } })).nama).toBe("Golongan I");
  });

  it("HRD menambah dan mengubah keempat jenis; nominal lewat pengajuan; nonaktifkan ditolak", async () => {
    await masukSebagai("hrd");
    for (const jenis of JENIS_STRUKTUR) expect((await master.simpanMaster({ jenis, nilai: contoh[jenis] })).ok, jenis).toBe(true);
    // Data baru: nominal awal menjadi pengajuan DIAJUKAN berlaku Desember, belum berlaku sebelum Owner menyetujui.
    const gpBaru = await db.golongan.findFirstOrThrow({ where: { nama: contoh.golongan.nama } });
    const vAwal = await db.versiNominal.findFirstOrThrow({ where: { golonganKode: gpBaru.kode } });
    expect([vAwal.status, vAwal.berlakuMulai, vAwal.nominal]).toEqual(["DIAJUKAN", "2026-12", 4_200_000]);
    expect(await nominalDi("GOLONGAN", gpBaru.kode, "2026-12")).toBeNull();
    const evBaru = await db.jabatan.findFirstOrThrow({ where: { nama: contoh.jabatanEvent.nama }, select: { kode: true, kelompok: true } });
    const vEvent = await db.versiNominal.findFirstOrThrow({ where: { jabatanKode: evBaru.kode }, include: { diajukanOleh: true } });
    expect([evBaru.kelompok, vEvent.jenis, vEvent.status, vEvent.nominal, vEvent.diajukanOleh?.namaPengguna]).toEqual(["EVENT", "JABATAN_EVENT", "DIAJUKAN", 25_000, "hrd"]);
    // Ubah data hanya mengubah nama; nominal kiriman diabaikan (nominal diubah lewat pengajuan).
    expect((await master.simpanMaster({ jenis: "golongan", kode: "GP-01", nilai: { nama: "Golongan I (ubah)", jumlah: 3_900_000 } })).ok).toBe(true);
    expect((await db.golongan.findUniqueOrThrow({ where: { kode: "GP-01" } })).nama).toBe("Golongan I (ubah)");
    expect((await nominalDi("GOLONGAN", "GP-01"))?.nominal).toBe(3_800_000);

    expect((await master.simpanMaster({ jenis: "jabatanEvent", kode: "JBT-06", nilai: { ...contoh.jabatanEvent, nama: "Crew Event", tarif: 22_000 } })).ok).toBe(true);
    // Ubah data jabatan event tidak mengubah tarif; tarif hanya lewat pengajuan nominal.
    expect((await nominalDi("JABATAN_EVENT", "JBT-06"))?.nominal).toBe(20_000);
    // Satuan tarif terkunci begitu jabatan dipakai penugasan (arti angka tarif di semua versi bergantung padanya).
    const satuan = await master.simpanMaster({ jenis: "jabatanEvent", kode: "JBT-06", nilai: { ...contoh.jabatanEvent, nama: "Crew Event", satuanTarif: "HARI" } });
    expect(satuan.ok).toBe(false);
    expect((await master.simpanMaster({ jenis: "jabatan", kode: "JBT-06", nilai: contoh.jabatan })).ok).toBe(false);
    expect((await master.ubahStatusMaster({ jenis: "tunjangan", kode: "TNJ-01", aktif: false })).ok).toBe(false);
  });

  it("Owner menonaktifkan dan mengaktifkan data struktur gaji", async () => {
    await masukSebagai("owner");
    const tunj = await db.tunjangan.findFirstOrThrow({ where: { nama: contoh.tunjangan.nama } });
    for (const aktifBaru of [false, true, false]) {
      expect((await master.ubahStatusMaster({ jenis: "tunjangan", kode: tunj.kode, aktif: aktifBaru })).ok).toBe(true);
      expect((await db.tunjangan.findUniqueOrThrow({ where: { kode: tunj.kode } })).aktif).toBe(aktifBaru);
    }
  });

  it("ringkasan: jumlah karyawan per jabatan dan golongan serta kisaran bruto dari setting yang berlaku", async () => {
    const P = "2026-11";
    const [d, s] = await Promise.all([dataStrukturGaji(P), dataSettingGaji(P)]);
    const berlaku = s.baris.filter((b) => b.aktif && b.aktifSekarang).map((b) => b.aktifSekarang!);
    expect(d.karyawanBersetting).toBe(berlaku.length);
    expect(d.karyawanAktif).toBe(s.baris.filter((b) => b.aktif).length);
    // Data contoh November: JBT-02 dipakai KRY-04 dan KRY-05 (promosi KRY-04 baru berlaku Desember), GP-01 dua karyawan.
    expect(d.pemakaian.jabatan["JBT-02"]).toBe(2);
    expect(d.pemakaian.golongan["GP-01"]).toBe(2);
    for (const j of d.ringkasJabatan) {
      const milik = berlaku.filter((v) => v.jabatanKode === j.kode).map((v) => v.estimasiBruto);
      expect(j.karyawan, j.kode).toBe(milik.length);
      expect(j.brutoMin, j.kode).toBe(milik.length ? Math.min(...milik) : null);
      expect(j.brutoMaks, j.kode).toBe(milik.length ? Math.max(...milik) : null);
    }
    // Ringkasan hanya jabatan inhouse; jabatan event tetap di daftarnya sendiri.
    expect(d.ringkasJabatan.some((j) => j.kode === "JBT-05")).toBe(false);
    // Dua jabatan event contoh ditambah satu yang dibuat HRD di tes sebelumnya.
    expect(d.daftar.jabatanEvent.baris.map((b) => b.kode)).toEqual(["JBT-05", "JBT-06", expect.any(String)]);
    // Desember: promosi KRY-04 ke JBT-03 berlaku.
    const des = await dataStrukturGaji("2026-12");
    expect(des.pemakaian.jabatan["JBT-02"]).toBe(1);
  });
});
