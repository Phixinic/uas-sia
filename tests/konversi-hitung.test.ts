import { describe, expect, it } from "vitest";
import { akumulasiDisetujui, cekJadwalPelepasan, jadwalMenunggu, saldoBukuPerlengkapan } from "@/lib/data/konversi/hitung";
import { skemaAjukanPelepasan, skemaNilaiSisa } from "@/lib/skema/konversi";

describe("saldo buku perlengkapan", () => {
  const beli = [
    { perlengkapanKode: "LKP-01", periode: "2026-10", nilai: 1_020_000 },
    { perlengkapanKode: "LKP-01", periode: "2026-11", nilai: 300_000 },
    { perlengkapanKode: "LKP-02", periode: "2026-10", nilai: 180_000 },
  ];
  const opname = [{ perlengkapanKode: "LKP-01", periode: "2026-10", beban: 510_000 }];

  it("pembelian sampai periode P dihitung, opname hanya dari periode sebelum P", () => {
    expect(saldoBukuPerlengkapan(beli, opname, "2026-10")).toEqual({ "LKP-01": 1_020_000, "LKP-02": 180_000 });
    expect(saldoBukuPerlengkapan(beli, opname, "2026-11")).toEqual({ "LKP-01": 810_000, "LKP-02": 180_000 });
  });

  it("pembelian sesudah P tidak ikut", () => {
    expect(saldoBukuPerlengkapan(beli, [], "2026-09")).toEqual({});
  });
});

describe("akumulasi aset", () => {
  const jadwal = [
    { periodeKe: 1, periode: "2026-10", beban: 100, jurnalNo: "JP-1", statusJurnal: "DISETUJUI" },
    { periodeKe: 2, periode: "2026-11", beban: 100, jurnalNo: "JP-2", statusJurnal: "DIAJUKAN" },
    { periodeKe: 3, periode: "2026-12", beban: 100, jurnalNo: null, statusJurnal: null },
  ];
  it("hanya jurnal DISETUJUI yang diakui", () => expect(akumulasiDisetujui(jadwal)).toBe(100));
  it("jurnal yang belum disetujui menahan pelepasan", () => expect(jadwalMenunggu(jadwal).map((r) => r.jurnalNo)).toEqual(["JP-2"]));
});

describe("skema konversi", () => {
  it("nilai sisa kosong atau negatif ditolak", () => {
    expect(skemaNilaiSisa.safeParse({ periode: "2026-11", nilai: [{ perlengkapanKode: "LKP-01", nilaiSisa: "" }] }).success).toBe(false);
    expect(skemaNilaiSisa.safeParse({ periode: "2026-11", nilai: [{ perlengkapanKode: "LKP-01", nilaiSisa: -1 }] }).success).toBe(false);
    expect(skemaNilaiSisa.safeParse({ periode: "2026-13", nilai: [] }).success).toBe(false);
  });
  it("harga jual wajib bila dijual, boleh kosong bila dibuang", () => {
    const dasar = { asetKode: "AST-0001", tanggal: "2026-11-20" };
    expect(skemaAjukanPelepasan.safeParse({ ...dasar, alasan: "DIJUAL", hargaJual: "" }).success).toBe(false);
    expect(skemaAjukanPelepasan.safeParse({ ...dasar, alasan: "DIJUAL", hargaJual: "0" }).success).toBe(true);
    expect(skemaAjukanPelepasan.safeParse({ ...dasar, alasan: "DIBUANG", hargaJual: "" }).success).toBe(true);
    expect(skemaAjukanPelepasan.safeParse({ ...dasar, alasan: "DIJUAL", hargaJual: -5 }).success).toBe(false);
  });
});

describe("cekJadwalPelepasan", () => {
  const ok = (periode: string) => ({ periodeKe: 1, periode, beban: 100, jurnalNo: "JU-1", statusJurnal: "DISETUJUI" });
  const draf = (periode: string) => ({ periodeKe: 1, periode, beban: 100, jurnalNo: "JU-2", statusJurnal: "DIAJUKAN" });
  const kosong = (periode: string) => ({ periodeKe: 1, periode, beban: 100, jurnalNo: null, statusJurnal: null });

  it("AST-0001 dilepas 16 November saat Oktober belum diproses ditolak", () => {
    expect(cekJadwalPelepasan([kosong("2026-10"), kosong("2026-11"), kosong("2026-12")], "2026-11-16")).toContain("2026-10");
  });
  it("Oktober disetujui, November belum dijurnal: boleh (November tidak disusutkan)", () => {
    expect(cekJadwalPelepasan([ok("2026-10"), kosong("2026-11")], "2026-11-16")).toBeNull();
  });
  it("bulan sebelumnya masih menunggu persetujuan ditolak", () => {
    expect(cekJadwalPelepasan([draf("2026-10"), kosong("2026-11")], "2026-11-16")).toContain("2026-10");
  });
  it("bulan pelepasan sudah dijurnal: harus disetujui dulu", () => {
    expect(cekJadwalPelepasan([ok("2026-10"), draf("2026-11")], "2026-11-16")).toContain("JU-2");
    expect(cekJadwalPelepasan([ok("2026-10"), ok("2026-11")], "2026-11-16")).toBeNull();
  });
  it("pelepasan mundur tanggal ditolak bila bulan sesudahnya sudah dijurnal", () => {
    expect(cekJadwalPelepasan([ok("2026-10"), ok("2026-11")], "2026-10-20")).toContain("2026-11");
    expect(cekJadwalPelepasan([ok("2026-10"), kosong("2026-11")], "2026-10-20")).toBeNull();
  });
});
