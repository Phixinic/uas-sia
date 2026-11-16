/*
 * Bukti bahwa logika inti TypeScript menghasilkan angka yang sama dengan app lama untuk data contoh Oktober 2026.
 */
import { describe, expect, it } from "vitest";
import { hitungJadwal, nDariDasar } from "@/lib/inti/penyusutan";
import { hitungGaji, hitungPph21, type KodePtkp, type JenisAbsensi } from "@/lib/inti/penggajian";
import { neracaSaldo, bukuBesar, saldo, type JurnalBuku } from "@/lib/inti/buku-besar";
import { barisGaji, barisPenyusutan, barisPelepasan, barisPembalik, validasiBaris, GalatJurnal } from "@/lib/inti/jurnal";
import { tambahBulan, hariTerakhir, tambahBulanTanggal } from "@/lib/inti/tanggal";
import { muatAppLama, koleksi } from "./app-lama";

const { seed, jalankan } = muatAppLama();
const keKodePtkp = (s: string) => s.replace("/", "") as KodePtkp;

type AsetLama = {
  id: string; nilai_perolehan: number; residu: number; n: number; d: number; terakhir: number; pengaman: boolean;
  bulan_mulai: string; dasar_n: string; garansi_bulan: number; masa_manfaat_bulan: number; tgl_perolehan: string; garansi_sampai: string;
  jadwal: { p: number; periode: string; beban: number; akumulasi: number; nilai_buku: number }[];
};

describe("tanggal", () => {
  it("geser periode dan hari terakhir", () => {
    expect(tambahBulan("2026-10", 3)).toBe("2027-01");
    expect(tambahBulan("2026-01", -1)).toBe("2025-12");
    expect(hariTerakhir("2028-02")).toBe("2028-02-29");
    expect(tambahBulanTanggal("2026-10-05", 24)).toBe("2028-10-05");
  });
});

describe("penyusutan dua tahap", () => {
  const aset = koleksi<AsetLama>(seed, "aset");

  it("data contoh punya 9 aset", () => expect(aset).toHaveLength(9));

  for (const a of aset) {
    it(`${a.id}: jadwal identik dengan seed lama`, () => {
      const n = nDariDasar(a.dasar_n === "garansi" ? "GARANSI" : "MASA_MANFAAT", a.garansi_bulan, a.masa_manfaat_bulan);
      expect(n).toBe(a.n);
      const h = hitungJadwal(a.nilai_perolehan, a.residu, n, a.bulan_mulai);
      expect([h.d, h.terakhir, h.pengaman]).toEqual([a.d, a.terakhir, a.pengaman]);
      expect(h.baris.map((r) => [r.periodeKe, r.periode, r.beban, r.akumulasi, r.nilaiBuku])).toEqual(
        a.jadwal.map((r) => [r.p, r.periode, r.beban, r.akumulasi, r.nilai_buku]),
      );
      expect(tambahBulanTanggal(a.tgl_perolehan, a.garansi_bulan)).toBe(a.garansi_sampai);
    });
  }

  it("sama dengan fungsi lama untuk kasus tepi (pengaman, n = 1, residu)", () => {
    for (const [b, s, n] of [[1000, 0, 3], [10, 0, 7], [100, 99, 4], [5_000_000, 500_000, 1], [950_000, 0, 24], [7, 0, 6]]) {
      const lama = jalankan<{ d: number; last: number; pengaman: boolean; rows: { beban: number }[] }>(`hitungJadwal(${b},${s},${n},'2026-10')`);
      const baru = hitungJadwal(b, s, n, "2026-10");
      expect([baru.d, baru.terakhir, baru.pengaman]).toEqual([lama.d, lama.last, lama.pengaman]);
      expect(baru.baris.map((r) => r.beban)).toEqual(lama.rows.map((r) => r.beban));
    }
  });

  it("menolak input tidak sah", () => {
    expect(() => hitungJadwal(0, 0, 1, "2026-10")).toThrow();
    expect(() => hitungJadwal(100, 100, 1, "2026-10")).toThrow();
    expect(() => hitungJadwal(100, 0, 0, "2026-10")).toThrow();
  });

  it("jurnal penyusutan Oktober = JP-2026-0001 (Rp1.492.915)", () => {
    const baris = barisPenyusutan(aset.map((a) => ({ akunBeban: "6-110", akunAkumulasi: "1-151", beban: a.jadwal[0].beban })));
    expect(baris).toEqual([{ akun: "6-110", debit: 1_492_915, kredit: 0 }, { akun: "1-151", debit: 0, kredit: 1_492_915 }]);
  });
});

describe("penggajian Oktober 2026", () => {
  type Slip = { karyawan_id: string; bruto: number; pph21: number; thp: number; potongan_absen: number; tunj_keluarga: number; hari_kerja: number; jam_kerja: number; terlambat_menit: number; alpa: number; hadir: number; akun_beban: string; pajak: Record<string, number> };
  const slipLama = koleksi<Slip>(seed, "slip");
  const karyawan = koleksi<{ status_ptkp: string }>(seed, "karyawan");
  const setgaji = koleksi<{ karyawan_id: string; jabatan_id: string; golongan_id: string; tunjangan_ids: string[] }>(seed, "setgaji");
  const jabatan = koleksi<{ tunj_jabatan: number; tunj_keluarga: number; akun_beban: string }>(seed, "jabatan");
  const golongan = koleksi<{ jumlah: number }>(seed, "golongan");
  const tunjangan = koleksi<{ nama: string; nominal: number }>(seed, "tunjangan");
  const jadwal = koleksi<{ jabatan_id: string; hari_kerja: number }>(seed, "jadwal");
  const presensi = koleksi<{ karyawan_id: string; tanggal: string; absensi: string; jam_masuk: string; jam_keluar: string; terlambat: number }>(seed, "presensi");

  const hasil = setgaji.map((st) => {
    const k = karyawan.find((x) => x.id === st.karyawan_id)!;
    const jab = jabatan.find((x) => x.id === st.jabatan_id)!;
    const gp = golongan.find((x) => x.id === st.golongan_id)!;
    const tm = jadwal.find((x) => x.jabatan_id === st.jabatan_id) ?? null;
    return hitungGaji({
      statusPtkp: keKodePtkp(k.status_ptkp),
      jabatan: { kode: jab.id, tunjJabatan: jab.tunj_jabatan, tunjKeluarga: jab.tunj_keluarga, akunBebanKode: jab.akun_beban },
      golongan: { kode: gp.id, jumlah: gp.jumlah },
      jadwal: tm ? { kode: tm.id, hariKerja: tm.hari_kerja } : null,
      tunjangan: st.tunjangan_ids.map((id) => tunjangan.find((t) => t.id === id)!).map((t) => ({ kode: t.id, nama: t.nama, nominal: t.nominal })),
      presensi: presensi
        .filter((p) => p.karyawan_id === st.karyawan_id && p.tanggal.startsWith("2026-10"))
        .map((p) => ({ absensi: p.absensi.toUpperCase() as JenisAbsensi, jamMasuk: p.jam_masuk, jamKeluar: p.jam_keluar, terlambat: p.terlambat })),
    });
  });

  it("total bruto Rp31.500.001, PPh 21 Rp299.658, THP Rp31.200.343", () => {
    expect(hasil.reduce((s, x) => s + x.bruto, 0)).toBe(31_500_001);
    expect(hasil.reduce((s, x) => s + x.pph21, 0)).toBe(299_658);
    expect(hasil.reduce((s, x) => s + x.thp, 0)).toBe(31_200_343);
  });

  it("tiap slip sama dengan slip di seed lama dan hitungGaji lama", () => {
    setgaji.forEach((st, i) => {
      const lama = slipLama.find((s) => s.karyawan_id === st.karyawan_id)!;
      const fnLama = jalankan<Slip & { presensi: number }>(`hitungGaji('${st.karyawan_id}','2026-10')`);
      const x = hasil[i];
      for (const pembanding of [lama, fnLama]) {
        expect({ bruto: x.bruto, pph21: x.pph21, thp: x.thp, pot: x.potonganAbsen, tk: x.tunjKeluarga, hk: x.hariKerja, jam: x.rekap.jamKerja, telat: x.rekap.terlambatMenit, alpa: x.rekap.alpa, hadir: x.rekap.hadir, akun: x.akunBebanKode }).toEqual({
          bruto: pembanding.bruto, pph21: pembanding.pph21, thp: pembanding.thp, pot: pembanding.potongan_absen, tk: pembanding.tunj_keluarga, hk: pembanding.hari_kerja,
          jam: pembanding.jam_kerja, telat: pembanding.terlambat_menit, alpa: pembanding.alpa, hadir: pembanding.hadir, akun: pembanding.akun_beban,
        });
        expect([x.brutoSetahun, x.biayaJabatan, x.netoSetahun, x.ptkp, x.pkp, x.pphSetahun]).toEqual([
          pembanding.pajak.setahun, pembanding.pajak.biaya, pembanding.pajak.neto, pembanding.pajak.ptkp, pembanding.pajak.pkp, pembanding.pajak.pph_setahun,
        ]);
      }
    });
  });

  it("PPh 21 sama dengan fungsi lama di banyak titik bruto dan status", () => {
    for (const bruto of [0, 4_277_273, 5_000_000, 12_345_678, 25_000_000, 80_000_000, 450_000_000]) {
      for (const st of ["TK/0", "TK/3", "K/0", "K/2", "K/3"]) {
        const lama = jalankan<{ pph21: number; pph_setahun: number }>(`hitungPph(${bruto},'${st}')`);
        const baru = hitungPph21(bruto, keKodePtkp(st));
        expect([baru.pph21, baru.pphSetahun]).toEqual([lama.pph21, lama.pph_setahun]);
      }
    }
  });

  it("jurnal penggajian = JU-2026-0011", () => {
    const baris = barisGaji(hasil.map((x) => ({ akunBeban: x.akunBebanKode, bruto: x.bruto, pph21: x.pph21, thp: x.thp })));
    const lama = (seed.jurnal["JU-2026-0011"] as { baris: unknown[] }).baris;
    expect(baris).toEqual(lama);
  });
});

describe("buku besar dan neraca saldo", () => {
  const jurnal: JurnalBuku[] = koleksi<{ tanggal: string; periode: string; status: string; keterangan: string; baris: { akun: string; debit: number; kredit: number }[] }>(seed, "jurnal").map((j) => ({
    no: j.id, tanggal: j.tanggal, periode: j.periode, status: j.status.toUpperCase(), keterangan: j.keterangan, baris: j.baris,
  }));
  const kodeAkun = Object.keys(seed.akun);

  it("neraca saldo s.d. Oktober 2026 seimbang Rp145.622.573", () => {
    const ns = neracaSaldo(jurnal, kodeAkun, "2026-10");
    expect(ns.debit).toBe(145_622_573);
    expect(ns.kredit).toBe(145_622_573);
    expect(ns.seimbang).toBe(true);
    const lama = jalankan<{ rows: { k: string; d: number; c: number }[]; d: number; c: number }>(`neraca('2026-10')`);
    expect(ns.baris.map((b) => [b.kode, b.debit, b.kredit])).toEqual(lama.rows.map((r) => [r.k, r.d, r.c]));
  });

  it("saldo kas dan buku besar kas sama dengan app lama", () => {
    expect(saldo(jurnal, "1-110", "D", "2026-10")).toBe(jalankan<number>(`saldo('1-110','2026-10')`));
    const bb = bukuBesar(jurnal, "1-110", "D", "2026-10");
    expect(bb.saldoAwal).toBe(0);
    expect(bb.saldoAkhir).toBe(saldo(jurnal, "1-110", "D", "2026-10"));
  });
});

describe("pembentuk jurnal", () => {
  it("pelepasan HT dibuang: rugi = nilai buku", () => {
    const baris = validasiBaris(barisPelepasan({ nilaiPerolehan: 950_000, akumulasi: 39_583, hargaJual: 0 }));
    expect(baris).toEqual([
      { akun: "1-151", debit: 39_583, kredit: 0 },
      { akun: "8-110", debit: 910_417, kredit: 0 },
      { akun: "1-150", debit: 0, kredit: 950_000 },
    ]);
  });
  it("pembalik menukar debit dan kredit", () => {
    expect(barisPembalik([{ akun: "1-150", debit: 5, kredit: 0 }, { akun: "1-110", debit: 0, kredit: 5 }])).toEqual([
      { akun: "1-150", debit: 0, kredit: 5 }, { akun: "1-110", debit: 5, kredit: 0 },
    ]);
  });
  it("menolak jurnal tidak seimbang atau satu baris", () => {
    expect(() => validasiBaris([{ akun: "1-110", debit: 5, kredit: 0 }, { akun: "3-110", debit: 0, kredit: 4 }])).toThrow(GalatJurnal);
    expect(() => validasiBaris([{ akun: "1-110", debit: 5, kredit: 5 }])).toThrow(GalatJurnal);
  });
});
