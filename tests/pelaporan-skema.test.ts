/*
 * Tes skema master dan pengguna (tanpa database): aturan validasi sama dengan MDEF di app lama.
 */
import { describe, expect, it } from "vitest";
import { DAFTAR_KELOMPOK, DEF_MASTER, JENIS_MASTER, JENIS_STRUKTUR, skemaIsiMaster } from "@/lib/skema/master";
import { IZIN } from "@/lib/peran";

const galat = (jenis: Parameters<typeof skemaIsiMaster>[0], nilai: Record<string, unknown>) => {
  const h = skemaIsiMaster(jenis).safeParse(nilai);
  return h.success ? {} : Object.fromEntries(h.error.issues.map((i) => [i.path.join("."), i.message]));
};

describe("definisi master", () => {
  it("urusan gaji: HRD mengajukan, Owner hanya memutuskan", () => {
    for (const k of ["struktur-gaji.ubah", "setting-gaji.ajukan", "nominal.ajukan", "gaji.hitung", "penggajian.ajukan"] as const) expect(IZIN[k], k).toEqual(["HRD"]);
    for (const k of ["setting-gaji.putuskan", "nominal.putuskan", "penggajian.putuskan"] as const) expect(IZIN[k], k).toEqual(["OWNER"]);
  });
  it("semua jenis terbagi ke dua kelompok dan punya izin yang ada di IZIN", () => {
    expect(DAFTAR_KELOMPOK.konversi.length + DAFTAR_KELOMPOK.sdm.length).toBe(JENIS_MASTER.length);
    for (const j of JENIS_MASTER) expect(IZIN[DEF_MASTER[j].izin]).toBeTruthy();
  });
  it("kategori dan akun hanya untuk Owner, karyawan dan jadwal HRD dan Owner, struktur gaji hanya HRD", () => {
    expect(IZIN[DEF_MASTER.kategori.izin]).toEqual(["OWNER"]);
    expect(IZIN[DEF_MASTER.akun.izin]).toEqual(["OWNER"]);
    expect(IZIN[DEF_MASTER.karyawan.izin]).toEqual(["HRD", "OWNER"]);
    expect(IZIN[DEF_MASTER.jadwal.izin]).toEqual(["HRD", "OWNER"]);
    for (const j of JENIS_STRUKTUR) expect(IZIN[DEF_MASTER[j].izin], j).toEqual(["HRD"]);
    expect(IZIN[DEF_MASTER.supplier.izin]).toEqual(["ADMIN", "OWNER"]);
  });
});

describe("validasi isian master", () => {
  it("supplier: nama wajib, email harus valid, NPWP boleh kosong", () => {
    expect(galat("supplier", { nama: "" }).nama).toBeTruthy();
    expect(galat("supplier", { nama: "CV Maju", email: "bukan-email" }).email).toBeTruthy();
    expect(galat("supplier", { nama: "CV Maju", email: "a@b.co" })).toEqual({});
  });
  it("kategori: residu 0 sampai 99, masa manfaat wajib lebih dari 0", () => {
    const dasar = { nama: "Kamera", masaManfaatBulan: "48", persenResidu: "10", akunAsetKode: "1-150", akunAkumulasiKode: "1-151", akunBebanKode: "6-110" };
    expect(galat("kategori", dasar)).toEqual({});
    expect(galat("kategori", { ...dasar, persenResidu: "100" }).persenResidu).toBeTruthy();
    expect(galat("kategori", { ...dasar, masaManfaatBulan: "0" }).masaManfaatBulan).toBeTruthy();
    expect(galat("kategori", { ...dasar, akunAsetKode: "" }).akunAsetKode).toBeTruthy();
  });
  it("akun: kode hanya huruf, angka, titik, minus; tipe dan saldo normal harus valid", () => {
    const dasar = { kode: "1-199", nama: "Kas kecil", tipe: "ASET", saldoNormal: "D" };
    expect(galat("akun", dasar)).toEqual({});
    expect(galat("akun", { ...dasar, kode: "1 199" }).kode).toBeTruthy();
    expect(galat("akun", { ...dasar, tipe: "LAIN" }).tipe).toBeTruthy();
  });
  it("jadwal kerja: jam keluar harus setelah jam masuk", () => {
    const dasar = { jabatanKode: "JBT-01", jamMasuk: "08:00", jamKeluar: "17:00", hariKerja: "22" };
    expect(galat("jadwal", dasar)).toEqual({});
    expect(galat("jadwal", { ...dasar, jamKeluar: "07:30" }).jamKeluar).toBeTruthy();
    expect(galat("jadwal", { ...dasar, jamMasuk: "8" }).jamMasuk).toBeTruthy();
    expect(galat("jadwal", { ...dasar, hariKerja: "40" }).hariKerja).toBeTruthy();
  });
  it("karyawan: status PTKP dan bank dibatasi pilihan", () => {
    const dasar = { nama: "Sari", statusPtkp: "K1", bank: "BCA", noRek: "123" };
    expect(galat("karyawan", dasar)).toEqual({});
    expect(galat("karyawan", { ...dasar, statusPtkp: "X9" }).statusPtkp).toBeTruthy();
    expect(galat("karyawan", { ...dasar, bank: "" }).bank).toBeTruthy();
  });
  it("golongan: gaji pokok wajib, tidak boleh negatif atau pecahan", () => {
    expect(galat("golongan", { nama: "I", jumlah: "0" }).jumlah).toBeTruthy();
    expect(galat("golongan", { nama: "I", jumlah: "-5" }).jumlah).toBeTruthy();
    expect(galat("golongan", { nama: "I", jumlah: "1.5" }).jumlah).toBeTruthy();
    expect(galat("golongan", { nama: "I", jumlah: "4500000", bulan: "12", tahun: "2026" })).toEqual({});
  });
  it("golongan baru: nominal awal wajib punya bulan dan tahun berlaku", () => {
    const g = galat("golongan", { nama: "I", jumlah: "4500000" });
    expect(g.bulan).toBeTruthy();
    expect(g.tahun).toBeTruthy();
  });
});
