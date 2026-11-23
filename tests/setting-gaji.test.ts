/*
 * Tes murni (tanpa database): pemilih versi setting gaji yang berlaku, pengaman bulan berlaku, log nilai lama dan baru,
 * parameter Bulan dan Tahun terpisah beserta pengalihan ?periode= lama, dan saldo kas terendah untuk pembelian tunai.
 */
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isiSama, keteranganLog, pengamanBerlaku, pilihVersiBerlaku, versiDigantikan, type IsiVersi, type SlipRingkas, type VersiRingkas } from "@/lib/inti/setting-gaji";
import { cariTanpaPeriodeLama, denganPeriode, labelBulanTahun, paramPeriode, periodeDariBulanTahun, periodeDariCari } from "@/lib/inti/tanggal";
import { saldoKasTerendah } from "@/lib/inti/modal";
import { proxy } from "@/proxy";

const v = (kode: string, berlakuMulai: string, status: VersiRingkas["status"] = "DISETUJUI", diputuskanPada: string | null = "2026-10-01T00:00:00Z", aktif = true): VersiRingkas => ({ kode, berlakuMulai, status, diputuskanPada, aktif });

describe("pilihVersiBerlaku", () => {
  const riwayat = [v("SET-01", "2026-10"), v("SET-06", "2026-12", "DISETUJUI", "2026-11-17T03:30:00Z"), v("SET-07", "2027-01", "DIAJUKAN", null), v("SET-08", "2026-11", "DITOLAK", "2026-11-20T00:00:00Z")];

  it("memilih versi disetujui dengan berlaku mulai <= periode yang paling akhir", () => {
    expect(pilihVersiBerlaku(riwayat, "2026-09")).toBeNull();
    expect(pilihVersiBerlaku(riwayat, "2026-10")?.kode).toBe("SET-01");
    expect(pilihVersiBerlaku(riwayat, "2026-11")?.kode).toBe("SET-01"); // yang ditolak tidak pernah berlaku
    expect(pilihVersiBerlaku(riwayat, "2026-12")?.kode).toBe("SET-06");
    expect(pilihVersiBerlaku(riwayat, "2027-03")?.kode).toBe("SET-06"); // yang masih diajukan belum berlaku
  });

  it("dua versi disetujui di bulan yang sama: yang diputuskan belakangan menggantikan", () => {
    const koreksi = [v("SET-02", "2026-12", "DISETUJUI", "2026-11-01T00:00:00Z"), v("SET-03", "2026-12", "DISETUJUI", "2026-11-05T00:00:00Z"), v("SET-01", "2026-10")];
    expect(pilihVersiBerlaku(koreksi, "2026-12")?.kode).toBe("SET-03");
    expect([...versiDigantikan(koreksi)]).toEqual(["SET-02"]);
  });

  it("versi lama yang dinonaktifkan sebelum ada riwayat tidak berlaku", () => {
    expect(pilihVersiBerlaku([v("SET-01", "2026-10", "DISETUJUI", null, false)], "2026-11")).toBeNull();
  });
});

describe("pengamanBerlaku", () => {
  const versi = [v("SET-01", "2026-10")];
  const slip: SlipRingkas[] = [
    { no: "SLP-2026-10-KRY-01", periode: "2026-10", status: "DISETUJUI" },
    { no: "SLP-2026-11-KRY-01", periode: "2026-11", status: "DRAFT" },
  ];

  it("bulan dengan slip diajukan atau dibayar (atau sebelumnya) ditolak, dan bulan paling awal disebut", () => {
    const p = pengamanBerlaku("2026-10", slip, versi);
    expect(p.galat).toMatch(/Gaji Oktober 2026 karyawan ini sudah dibayar \(SLP-2026-10-KRY-01\), jadi setting baru paling awal berlaku November 2026/);
    expect(p.palingAwal).toBe("2026-11");
    expect(pengamanBerlaku("2026-09", slip, versi).galat).toMatch(/sudah dibayar/);
    const diajukan = pengamanBerlaku("2026-11", [{ no: "SLP-2026-11-KRY-01", periode: "2026-11", status: "DIAJUKAN" }], versi);
    expect(diajukan.galat).toMatch(/sudah diajukan ke Owner/);
  });

  it("slip draf di bulan berlaku atau sesudahnya dilaporkan perlu dihitung ulang, bukan ditolak", () => {
    const p = pengamanBerlaku("2026-11", slip, versi);
    expect(p.galat).toBeNull();
    expect(p.drafTerdampak.map((s) => s.no)).toEqual(["SLP-2026-11-KRY-01"]);
    expect(pengamanBerlaku("2026-12", slip, versi).drafTerdampak).toEqual([]);
  });

  it("tanpa slip: semua bulan boleh, tanpa batas paling awal", () => {
    expect(pengamanBerlaku("2026-10", [], [])).toEqual({ galat: null, drafTerdampak: [], palingAwal: null });
  });
});

describe("isi dan log versi", () => {
  const lama: IsiVersi = { jabatanKode: "JBT-02", jabatan: "Crew Produksi", golonganKode: "GP-01", golongan: "Golongan I", gajiPokok: 3_800_000, tunjJabatan: 250_000, tunjangan: [{ kode: "TNJ-02", nama: "Makan", nominal: 400_000 }], berlakuMulai: "2026-10" };
  const baru: IsiVersi = { ...lama, jabatanKode: "JBT-03", jabatan: "Operator Sound & Lighting", golonganKode: "GP-02", golongan: "Golongan II", gajiPokok: 4_500_000, tunjJabatan: 500_000, berlakuMulai: "2026-12" };

  it("isiSama membandingkan jabatan, golongan, dan tunjangan tanpa memedulikan urutan", () => {
    expect(isiSama(lama, { ...lama })).toBe(true);
    expect(isiSama(lama, baru)).toBe(false);
    expect(isiSama({ ...lama, tunjangan: [{ kode: "A", nama: "", nominal: 0 }, { kode: "B", nama: "", nominal: 0 }] }, { ...lama, tunjangan: [{ kode: "B", nama: "", nominal: 0 }, { kode: "A", nama: "", nominal: 0 }] })).toBe(true);
  });

  it("keterangan log memuat nilai lama dan baru: jabatan, gaji pokok, tunjangan, berlaku mulai", () => {
    const t = keteranganLog("PROMOSI", lama, baru, "Alasan: lulus evaluasi.");
    expect(t).toMatch(/^Promosi\. Lama: JBT-02 Crew Produksi, GP-01 Golongan I Rp3\.800\.000, tunj\. jabatan Rp250\.000, tunjangan \[Makan Rp400\.000\], berlaku Oktober 2026\./);
    expect(t).toMatch(/Baru: JBT-03 Operator Sound & Lighting, GP-02 Golongan II Rp4\.500\.000, .* berlaku Desember 2026\. Alasan: lulus evaluasi\.$/);
    expect(keteranganLog("SETTING_AWAL", null, baru)).toMatch(/Lama: \(belum ada\)/);
  });
});

describe("Bulan dan Tahun terpisah", () => {
  it("periode dari parameter bulan dan tahun, parameter lama tetap terbaca, nilai salah diabaikan", () => {
    expect(periodeDariCari({ bulan: "11", tahun: "2026" })).toBe("2026-11");
    expect(periodeDariCari({ bulan: "3", tahun: "2027" })).toBe("2027-03");
    expect(periodeDariCari({ periode: "2026-10" })).toBe("2026-10");
    expect(periodeDariCari({ tahun: "semua" })).toBe("semua");
    expect(periodeDariCari({ periode: "semua" })).toBe("semua");
    expect(periodeDariCari({ bulan: "13", tahun: "2026" })).toBeNull();
    expect(periodeDariCari({ bulan: "x", tahun: "2026" })).toBeNull();
    expect(periodeDariCari({ periode: "2026-13" })).toBeNull();
    expect(periodeDariCari({})).toBeNull();
    expect(periodeDariBulanTahun(12, 2026)).toBe("2026-12");
  });

  it("parameter dan label baru", () => {
    expect(paramPeriode("2026-11")).toBe("bulan=11&tahun=2026");
    expect(paramPeriode("semua")).toBe("tahun=semua");
    expect(denganPeriode("/sdm/presensi", "2026-10")).toBe("/sdm/presensi?bulan=10&tahun=2026");
    expect(denganPeriode("/pelaporan/buku-besar?akun=1-110", "2026-11")).toBe("/pelaporan/buku-besar?akun=1-110&bulan=11&tahun=2026");
    expect(labelBulanTahun("2026-11")).toBe("Bulan: November · Tahun: 2026");
  });

  it("pengalihan ?periode= lama: parameter lain dipertahankan, yang tidak perlu dialihkan mengembalikan null", () => {
    expect(cariTanpaPeriodeLama("?akun=1-110&periode=2026-11&tahap=sebelum")).toBe("akun=1-110&tahap=sebelum&bulan=11&tahun=2026");
    expect(cariTanpaPeriodeLama("?periode=semua")).toBe("tahun=semua");
    expect(cariTanpaPeriodeLama("?bulan=11&tahun=2026")).toBeNull();
    expect(cariTanpaPeriodeLama("?periode=ngawur")).toBeNull();
    expect(cariTanpaPeriodeLama("")).toBeNull();
  });

  it("proxy mengalihkan tautan lama dengan 307, permintaan lain diteruskan", () => {
    const minta = (url: string, method = "GET") => new NextRequest(new URL(url, "http://127.0.0.1:3217"), { method, headers: { cookie: "sia_sesi=abc" } });
    const r = proxy(minta("/pelaporan/neraca-saldo?periode=2026-10&tahap=sebelum"));
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location")!).search).toBe("?tahap=sebelum&bulan=10&tahun=2026");
    expect(proxy(minta("/pelaporan/neraca-saldo?bulan=10&tahun=2026")).headers.get("location")).toBeNull();
    // Server action (POST) tidak dialihkan.
    expect(proxy(minta("/sdm/hitung-gaji?periode=2026-11", "POST")).headers.get("location")).toBeNull();
  });
});

describe("saldoKasTerendah", () => {
  const mutasi = [
    { periode: "2026-10", net: 1_000 },
    { periode: "2026-11", net: -700 },
    { periode: "2026-12", net: 500 },
  ];
  it("saldo akhir periode sejak tanggal pembelian dan periode sesudahnya, ambil yang terendah", () => {
    expect(saldoKasTerendah(mutasi, "2026-09")).toEqual({ saldo: 0, periode: "2026-09" });
    expect(saldoKasTerendah(mutasi, "2026-10")).toEqual({ saldo: 300, periode: "2026-11" });
    expect(saldoKasTerendah(mutasi, "2026-11")).toEqual({ saldo: 300, periode: "2026-11" });
    expect(saldoKasTerendah(mutasi, "2026-12")).toEqual({ saldo: 800, periode: "2026-12" });
    expect(saldoKasTerendah(mutasi, "2027-02")).toEqual({ saldo: 800, periode: "2027-02" });
  });
});
