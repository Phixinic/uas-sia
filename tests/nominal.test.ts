/*
 * Tes logika murni riwayat nominal master (src/lib/inti/nominal.ts): pemilih versi per bulan, pengaman dokumen
 * terkunci, sidik versi slip, dan teks sumber komponen.
 */
import { describe, expect, it } from "vitest";
import {
  buatPetaNominal, keteranganLogNominal, labelSumberVersi, nominalSama, pengamanNominal, sidikVersiSlip, teksNominal, type VersiNominalRingkas,
} from "@/lib/inti/nominal";

const v = (x: Partial<VersiNominalRingkas> & Pick<VersiNominalRingkas, "kode" | "berlakuMulai">): VersiNominalRingkas => ({
  jenis: "GOLONGAN", itemKode: "GP-02", nominal: 4_500_000, tunjJabatan: 0, tunjKeluarga: 0, status: "DISETUJUI", diputuskanPada: "2026-10-01T00:00:00Z", ...x,
});

describe("pemilih versi nominal per bulan", () => {
  const versi = [
    v({ kode: "NOM-0002", berlakuMulai: "2026-10" }),
    v({ kode: "NOM-0021", berlakuMulai: "2026-12", nominal: 4_800_000, diputuskanPada: "2026-11-20T00:00:00Z" }),
    v({ kode: "NOM-0022", berlakuMulai: "2027-01", nominal: 5_000_000, status: "DIAJUKAN", diputuskanPada: null }),
    v({ kode: "NOM-0023", berlakuMulai: "2027-02", nominal: 5_100_000, status: "DITOLAK" }),
    // Item lain dan jenis lain dengan kode sama tidak ikut terpilih.
    v({ kode: "NOM-0030", itemKode: "GP-03", berlakuMulai: "2026-11", nominal: 9_000_000 }),
    v({ kode: "NOM-0031", jenis: "JABATAN", itemKode: "GP-02", berlakuMulai: "2026-10", nominal: 0, tunjJabatan: 1 }),
  ];
  const peta = buatPetaNominal(versi);

  it("bulan sebelum versi baru tetap memakai nominal lama, bulan berlaku dan sesudahnya memakai yang baru", () => {
    expect(peta.pada("GOLONGAN", "GP-02", "2026-09")).toBeNull();
    expect(peta.pada("GOLONGAN", "GP-02", "2026-10")?.nominal).toBe(4_500_000);
    expect(peta.pada("GOLONGAN", "GP-02", "2026-11")?.kode).toBe("NOM-0002");
    expect(peta.pada("GOLONGAN", "GP-02", "2026-12")?.nominal).toBe(4_800_000);
    expect(peta.pada("GOLONGAN", "GP-02", "2027-03")?.kode).toBe("NOM-0021");
  });

  it("pengajuan menunggu dan yang ditolak tidak pernah berlaku; jenis dan item dipisah", () => {
    expect(peta.pada("GOLONGAN", "GP-02", "2027-01")?.kode).toBe("NOM-0021");
    expect(peta.pada("GOLONGAN", "GP-03", "2026-11")?.kode).toBe("NOM-0030");
    expect(peta.pada("JABATAN", "GP-02", "2026-12")?.kode).toBe("NOM-0031");
    expect(peta.riwayat("GOLONGAN", "GP-02").map((x) => x.kode)).toEqual(["NOM-0002", "NOM-0021", "NOM-0022", "NOM-0023"]);
  });

  it("dua versi disetujui di bulan yang sama: yang diputuskan belakangan menang (koreksi)", () => {
    const p = buatPetaNominal([...versi, v({ kode: "NOM-0040", berlakuMulai: "2026-12", nominal: 4_750_000, diputuskanPada: "2026-11-25T00:00:00Z" })]);
    expect(p.pada("GOLONGAN", "GP-02", "2026-12")?.kode).toBe("NOM-0040");
  });
});

describe("pengaman perubahan nominal", () => {
  it("menolak bulan yang punya slip diajukan atau dibayar yang memakai item itu, dan menyebut bulan paling awal yang boleh", () => {
    const beku = [
      { no: "SLP-2026-10-KRY-04", periode: "2026-10", status: "DISETUJUI" as const, jenisDokumen: "SLIP" as const },
      { no: "SLP-2026-11-KRY-04", periode: "2026-11", status: "DIAJUKAN" as const, jenisDokumen: "SLIP" as const },
    ];
    expect(pengamanNominal("2026-10", beku).galat).toBe("Slip gaji Oktober 2026 yang memakai nominal ini sudah dibayar (SLP-2026-10-KRY-04), jadi perubahan nominal paling awal berlaku Desember 2026.");
    expect(pengamanNominal("2026-11", beku).galat).toMatch(/Slip gaji November 2026 yang memakai nominal ini sudah diajukan ke Owner \(SLP-2026-11-KRY-04\)/);
    expect(pengamanNominal("2026-12", beku)).toEqual({ galat: null, palingAwal: "2026-12" });
    expect(pengamanNominal("2026-10", [])).toEqual({ galat: null, palingAwal: null });
  });

  it("tarif event: laporan fee yang diajukan atau disetujui mengunci bulannya", () => {
    const beku = [{ no: "FEE-2026-0001", periode: "2026-11", status: "DIAJUKAN" as const, jenisDokumen: "LAPORAN_FEE" as const }];
    expect(pengamanNominal("2026-11", beku).galat).toMatch(/^Laporan fee November 2026 yang memakai nominal ini sudah diajukan ke Owner \(FEE-2026-0001\)/);
    expect(pengamanNominal("2026-12", beku).galat).toBeNull();
  });
});

describe("pembanding, sidik, dan teks", () => {
  it("nominal sama dibandingkan sesuai jenis", () => {
    expect(nominalSama("GOLONGAN", { nominal: 1, tunjJabatan: 5, tunjKeluarga: 5 }, { nominal: 1, tunjJabatan: 0, tunjKeluarga: 0 })).toBe(true);
    expect(nominalSama("JABATAN", { nominal: 0, tunjJabatan: 500, tunjKeluarga: 250 }, { nominal: 0, tunjJabatan: 500, tunjKeluarga: 300 })).toBe(false);
  });

  it("sidik versi slip berubah bila salah satu versi komponen berubah, tidak bergantung urutan tunjangan", () => {
    const dasar = { settingKode: "SET-01", versiGajiPokokKode: "NOM-0001", versiJabatanKode: "NOM-0011", tunjangan: [{ kode: "TNJ-02", versiKode: "NOM-0007" }, { kode: "TNJ-01", versiKode: "NOM-0006" }] };
    expect(sidikVersiSlip(dasar)).toBe(sidikVersiSlip({ ...dasar, tunjangan: [...dasar.tunjangan].reverse() }));
    expect(sidikVersiSlip(dasar)).not.toBe(sidikVersiSlip({ ...dasar, versiGajiPokokKode: "NOM-0021" }));
    expect(sidikVersiSlip(dasar)).not.toBe(sidikVersiSlip({ ...dasar, tunjangan: [{ kode: "TNJ-01", versiKode: "NOM-0006" }, { kode: "TNJ-02", versiKode: "NOM-0025" }] }));
    expect(sidikVersiSlip(dasar)).not.toBe(sidikVersiSlip({ ...dasar, settingKode: "SET-06" }));
  });

  it("teks sumber komponen untuk slip dan log", () => {
    expect(labelSumberVersi("GOLONGAN", "Golongan II", { kode: "NOM-0021", berlakuMulai: "2026-12" })).toBe("Gaji pokok Golongan II, berlaku mulai Desember 2026 (NOM-0021)");
    expect(labelSumberVersi("TUNJANGAN", "Makan", null)).toBe("Tunjangan Makan, nominal sebelum riwayat (tanpa versi)");
    expect(teksNominal("JABATAN_EVENT", { nominal: 20_000, tunjJabatan: 0, tunjKeluarga: 0 }, "JAM")).toBe("Rp20.000/jam");
    expect(teksNominal("JABATAN", { nominal: 0, tunjJabatan: 500_000, tunjKeluarga: 250_000 })).toBe("tunjangan jabatan Rp500.000, istri/anak Rp250.000");
    expect(keteranganLogNominal("GOLONGAN", "GP-02", "Golongan II", { nominal: 4_500_000, tunjJabatan: 0, tunjKeluarga: 0, kode: "NOM-0002", berlakuMulai: "2026-10" }, { nominal: 4_800_000, tunjJabatan: 0, tunjKeluarga: 0, kode: "NOM-0021", berlakuMulai: "2026-12" }, "Alasan: UMK."))
      .toBe("Gaji pokok. Lama: GP-02 Golongan II: Rp4.500.000, berlaku Oktober 2026 (NOM-0002). Baru: GP-02 Golongan II: Rp4.800.000, berlaku Desember 2026 (NOM-0021). Alasan: UMK.");
  });
});
