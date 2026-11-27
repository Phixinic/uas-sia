/* Urutan tampil daftar berstatus (src/lib/inti/urut.ts): yang belum selesai di atas, sisanya tetap menaik. */
import { describe, expect, it } from "vitest";
import { belumDiAtas, belumDiputuskan, jurnalDikembalikan } from "@/lib/inti/urut";

describe("belumDiAtas", () => {
  it("menaikkan baris belum selesai tanpa mengubah urutan di dalam kelompok, daftar asal utuh", () => {
    const daftar = [1, 2, 3, 4, 5, 6];
    expect(belumDiAtas(daftar, (x) => x === 5 || x === 2)).toEqual([2, 5, 1, 3, 4, 6]);
    expect(daftar).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("ringkasan penggajian: Desember belum diajukan di atas, bulan tanpa data tidak dinaikkan", () => {
    const bulan = [...Array(10).fill("DIBAYAR"), "KOSONG", "PRESENSI"].map((status, i) => ({ bulan: i + 1, status }));
    const urut = belumDiAtas(bulan, (r) => r.status !== "DIBAYAR" && r.status !== "KOSONG");
    expect(urut.map((r) => r.bulan)).toEqual([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("draf dan diajukan belum diputuskan; disetujui, ditolak, dan dibalik sudah", () => {
    expect(["DRAFT", "DIAJUKAN", "DISETUJUI", "DITOLAK", "DIBALIK"].map(belumDiputuskan)).toEqual([true, true, false, false, false]);
  });
});

describe("jurnalDikembalikan", () => {
  const j = (no: string, periode: string, status: string) => ({ no, periode, status });
  const jurnal = [
    j("JP-2026-0002", "2026-10", "DITOLAK"),
    j("JP-2026-0004", "2026-10", "DITOLAK"),
    j("JP-2026-0006", "2026-11", "DITOLAK"),
    j("JP-2026-0007", "2026-11", "DISETUJUI"),
  ];

  it("hanya penolakan terakhir di periode yang masih dikembalikan", () => {
    expect([...jurnalDikembalikan(jurnal, new Set(["2026-10"]))]).toEqual(["JP-2026-0004"]);
  });

  it("jurnal ditolak yang sudah diganti pengajuan baru tidak ikut", () => {
    expect([...jurnalDikembalikan(jurnal, new Set())]).toEqual([]);
  });
});
