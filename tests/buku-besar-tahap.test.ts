/*
 * Tahap siklus akuntansi: buku besar dan neraca saldo sebelum atau setelah penyesuaian, serta neraca lajur ringkas.
 * Data buatan dua periode supaya kasus "penyesuaian periode lalu masuk saldo awal" ikut teruji.
 */
import { describe, expect, it } from "vitest";
import { bukuBesar, bukuBesarTahap, neracaLajur, neracaSaldo, saldo, saringTahap, tahapDari, type JurnalBuku } from "@/lib/inti/buku-besar";
import { muatAppLama, koleksi } from "./app-lama";

const j = (no: string, tanggal: string, jenis: JurnalBuku["jenis"], baris: [string, number, number][], status = "DISETUJUI"): JurnalBuku => ({
  no,
  tanggal,
  periode: tanggal.slice(0, 7),
  status,
  jenis,
  keterangan: no,
  baris: baris.map(([akun, debit, kredit]) => ({ akun, debit, kredit })),
});

// Oktober: modal, beli alat, penyusutan (penyesuaian). November: pendapatan, pembalik, penyusutan, satu draf penyesuaian.
const JURNAL: JurnalBuku[] = [
  j("JU-1", "2026-10-01", "UMUM", [["1-110", 10_000, 0], ["3-110", 0, 10_000]]),
  j("JU-2", "2026-10-05", "UMUM", [["1-150", 6_000, 0], ["1-110", 0, 6_000]]),
  j("JP-1", "2026-10-31", "PENYESUAIAN", [["6-110", 100, 0], ["1-151", 0, 100]]),
  j("JU-3", "2026-11-03", "UMUM", [["1-110", 2_000, 0], ["4-110", 0, 2_000]]),
  j("JU-4", "2026-11-04", "UMUM", [["1-140", 500, 0], ["1-110", 0, 500]]),
  j("JB-1", "2026-11-06", "PEMBALIK", [["1-110", 500, 0], ["1-140", 0, 500]]),
  j("JP-2", "2026-11-30", "PENYESUAIAN", [["6-110", 100, 0], ["1-151", 0, 100]]),
  j("JP-3", "2026-11-30", "PENYESUAIAN", [["6-110", 999, 0], ["1-151", 0, 999]], "DIAJUKAN"),
];
const AKUN = ["1-110", "1-140", "1-150", "1-151", "3-110", "4-110", "6-110"];

describe("saringTahap", () => {
  it("sebelum = semua jurnal periode lalu + umum dan pembalik periode ini; setelah = semua sampai periode ini", () => {
    expect(saringTahap(JURNAL, "2026-11", "sebelum").map((x) => x.no)).toEqual(["JU-1", "JU-2", "JP-1", "JU-3", "JU-4", "JB-1"]);
    expect(saringTahap(JURNAL, "2026-11", "setelah").map((x) => x.no)).toEqual(["JU-1", "JU-2", "JP-1", "JU-3", "JU-4", "JB-1", "JP-2"]);
    expect(saringTahap(JURNAL, "2026-10", "sebelum").map((x) => x.no)).toEqual(["JU-1", "JU-2"]);
  });

  it("tahap dari URL: selain 'sebelum' selalu 'setelah'", () => {
    expect([tahapDari("sebelum"), tahapDari("setelah"), tahapDari(undefined), tahapDari("ngawur")]).toEqual(["sebelum", "setelah", "setelah", "setelah"]);
  });

  it("tahap setelah sama dengan saldo lengkap yang dipakai dashboard dan tutup periode", () => {
    const lengkap = neracaSaldo(JURNAL, AKUN, "2026-11");
    expect(neracaSaldo(saringTahap(JURNAL, "2026-11", "setelah"), AKUN, "2026-11")).toEqual(lengkap);
    expect(saldo(saringTahap(JURNAL, "2026-11", "setelah"), "1-151", "K")).toBe(saldo(JURNAL, "1-151", "K", "2026-11"));
  });
});

describe("bukuBesarTahap", () => {
  it("penyesuaian periode lalu masuk saldo awal, penyesuaian periode ini hanya di tahap setelah", () => {
    const sb = bukuBesarTahap(JURNAL, "1-151", "K", "2026-11", "sebelum");
    expect(sb.saldoAwal).toBe(100);
    expect(sb.baris).toEqual([]);
    expect(sb.saldoAkhir).toBe(100);

    const st = bukuBesarTahap(JURNAL, "1-151", "K", "2026-11", "setelah");
    expect(st.saldoAwal).toBe(100);
    expect(st.saldoSebelumPenyesuaian).toBe(100);
    expect(st.mutasiPenyesuaian).toBe(100);
    expect(st.baris.map((b) => [b.no, b.jenis, b.saldo])).toEqual([["JP-2", "PENYESUAIAN", 200]]);
    expect(st.saldoAkhir).toBe(200);
  });

  it("baris penyesuaian ditaruh sesudah mutasi umum dan pembalik, saldo akhir sama dengan buku besar lengkap", () => {
    const akhir = (akun: string, normal: "D" | "K") => bukuBesar(JURNAL, akun, normal, "2026-11").saldoAkhir;
    for (const [akun, normal] of [["1-110", "D"], ["6-110", "D"], ["1-151", "K"], ["1-140", "D"]] as const) {
      const st = bukuBesarTahap(JURNAL, akun, normal, "2026-11", "setelah");
      expect(st.saldoAkhir).toBe(akhir(akun, normal));
      expect(st.saldoSebelumPenyesuaian + st.mutasiPenyesuaian).toBe(st.saldoAkhir);
    }
    const kas = bukuBesarTahap(JURNAL, "1-110", "D", "2026-11", "sebelum");
    expect(kas.baris.map((b) => [b.no, b.jenis])).toEqual([["JU-3", "UMUM"], ["JU-4", "UMUM"], ["JB-1", "PEMBALIK"]]);
    expect(kas.saldoAkhir).toBe(4_000 + 2_000 - 500 + 500);
  });
});

describe("neracaLajur", () => {
  it("kolom neraca saldo, penyesuaian, dan setelah penyesuaian seimbang dan saling cocok per akun", () => {
    const nl = neracaLajur(JURNAL, AKUN, "2026-11");
    expect(nl.seimbang).toBe(true);
    expect(nl.total.penyesuaian).toEqual({ debit: 100, kredit: 100, seimbang: true });
    const beban = nl.baris.find((b) => b.kode === "6-110")!;
    expect(beban).toEqual({ kode: "6-110", neracaSaldo: { debit: 100, kredit: 0 }, penyesuaian: { debit: 100, kredit: 0 }, setelah: { debit: 200, kredit: 0 } });
    for (const b of nl.baris) {
      const net = (x: { debit: number; kredit: number }) => x.debit - x.kredit;
      expect(net(b.neracaSaldo) + net(b.penyesuaian)).toBe(net(b.setelah));
    }
    expect(nl.total.neracaSaldo.debit).toBe(neracaSaldo(saringTahap(JURNAL, "2026-11", "sebelum"), AKUN, "2026-11").debit);
    expect(nl.total.setelah.debit).toBe(neracaSaldo(JURNAL, AKUN, "2026-11").debit);
    // 1-140 nol sesudah pembalik dan tidak disesuaikan, jadi tidak tampil.
    expect(nl.baris.some((b) => b.kode === "1-140")).toBe(false);
  });

  it("data contoh Oktober 2026: neraca saldo setelah penyesuaian = Rp145.622.573 seperti app lama", () => {
    const { seed } = muatAppLama();
    const jurnal: JurnalBuku[] = koleksi<{ tanggal: string; periode: string; status: string; jenis: string; baris: { akun: string; debit: number; kredit: number }[] }>(seed, "jurnal").map((x) => ({
      no: x.id, tanggal: x.tanggal, periode: x.periode, status: x.status.toUpperCase(), jenis: x.jenis.toUpperCase() as JurnalBuku["jenis"], baris: x.baris,
    }));
    const nl = neracaLajur(jurnal, Object.keys(seed.akun), "2026-10");
    expect(nl.seimbang).toBe(true);
    expect(nl.total.setelah.debit).toBe(145_622_573);
    // Penyesuaian Oktober: penyusutan 1.492.915 + biaya perlengkapan 1.108.000.
    expect(nl.total.penyesuaian.debit).toBe(1_492_915 + 1_108_000);
    expect(nl.baris.find((b) => b.kode === "6-110")).toMatchObject({ neracaSaldo: { debit: 0, kredit: 0 }, setelah: { debit: 1_492_915, kredit: 0 } });
  });
});
