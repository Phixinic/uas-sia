/*
 * Tes inti Gaji Bulanan (tanpa database): bruto = gaji tetap + upah event + bonus, PPh 21 penghasilan tidak teratur,
 * THP dikurangi potongan manual, dan jurnal gaji memisahkan akun upah event, bonus, dan denda.
 */
import { describe, expect, it } from "vitest";
import { hitungGaji, hitungPph21, hitungPph21TidakTeratur, type InputGaji } from "@/lib/inti/penggajian";
import { barisGaji, validasiBaris } from "@/lib/inti/jurnal";

const dasar: InputGaji = {
  statusPtkp: "TK0",
  jabatan: { kode: "JBT-03", tunjJabatan: 500_000, tunjKeluarga: 0, akunBebanKode: "6-210" },
  golongan: { kode: "GP-02", jumlah: 6_000_000 },
  jadwal: { kode: "JBT-03", hariKerja: 22 },
  tunjangan: [{ kode: "TNJ-01", nama: "Transport", nominal: 300_000 }],
  presensi: [{ absensi: "HADIR", jamMasuk: "08:00", jamKeluar: "17:00" }],
};

describe("hitung gaji bulanan", () => {
  it("tanpa upah event, bonus, dan potongan hasilnya sama dengan rumus lama", () => {
    const h = hitungGaji(dasar);
    expect(h.gajiTetap).toBe(6_800_000);
    expect(h.bruto).toBe(6_800_000);
    expect(h.pph21).toBe(hitungPph21(6_800_000, "TK0").pph21);
    expect(h.thp).toBe(h.bruto - h.pph21);
  });

  it("upah event dan bonus menambah bruto; PPh 21 = PPh gaji tetap + selisih PPh setahun; potongan mengurangi THP", () => {
    const h = hitungGaji({
      ...dasar,
      upahEvent: [{ kode: "EVT-2026-0005", nama: "Pameran", fee: 400_000 }],
      bonus: [{ keterangan: "Bonus target", nominal: 1_000_000 }],
      potongan: [{ keterangan: "Denda merusak kabel", nominal: 150_000 }],
    });
    expect([h.totalUpahEvent, h.totalBonus, h.totalPotongan]).toEqual([400_000, 1_000_000, 150_000]);
    expect(h.bruto).toBe(6_800_000 + 400_000 + 1_000_000);
    const teratur = hitungPph21(6_800_000, "TK0");
    const gabung = hitungPph21TidakTeratur(6_800_000, 1_400_000, "TK0");
    expect(gabung.brutoSetahun).toBe(6_800_000 * 12 + 1_400_000);
    // PKP gaji tetap TK/0 = 81.600.000 - 4.080.000 - 54.000.000 = 23.520.000 (lapis 5%), tambahan 1.400.000 - 5% biaya jabatan.
    expect(gabung.pph21 - teratur.pph21).toBe(gabung.pphSetahun - teratur.pphSetahun);
    expect(h.pph21).toBe(gabung.pph21);
    expect(h.pph21).toBeGreaterThan(teratur.pph21);
    expect(h.thp).toBe(h.bruto - h.pph21 - 150_000);
  });

  it("jurnal gaji: Dr gaji tetap per akun jabatan, Dr 6-240 upah event, Dr 6-250 bonus; Kr Utang PPh 21, Kr 7-120 denda, Kr Kas THP", () => {
    const h = hitungGaji({ ...dasar, upahEvent: [{ kode: "E", nama: "E", fee: 400_000 }], bonus: [{ keterangan: "b", nominal: 1_000_000 }], potongan: [{ keterangan: "p", nominal: 150_000 }] });
    const baris = barisGaji([
      { akunBeban: "6-210", bruto: h.bruto, pph21: h.pph21, thp: h.thp, upahEvent: h.totalUpahEvent, bonus: h.totalBonus, potongan: h.totalPotongan },
      { akunBeban: "6-220", bruto: 5_000_000, pph21: 50_000, thp: 4_950_000 },
    ]);
    expect(baris).toEqual([
      { akun: "6-210", debit: 6_800_000, kredit: 0 },
      { akun: "6-220", debit: 5_000_000, kredit: 0 },
      { akun: "6-240", debit: 400_000, kredit: 0 },
      { akun: "6-250", debit: 1_000_000, kredit: 0 },
      { akun: "2-120", debit: 0, kredit: h.pph21 + 50_000 },
      { akun: "7-120", debit: 0, kredit: 150_000 },
      { akun: "1-110", debit: 0, kredit: h.thp + 4_950_000 },
    ]);
    expect(() => validasiBaris(baris)).not.toThrow();
  });
});
