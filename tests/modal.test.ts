/*
 * Tes ringkasan "Dari mana kas dan modal" dan Biaya SDM (src/lib/inti/modal.ts), tanpa database.
 * Pengecekan utama: total ringkasan selalu sama dengan saldo Kas dan Modal Pemilik di buku besar (fungsi `saldo`),
 * dan biaya tetap + biaya variabel - PPh 21 dipotong = kas keluar siklus SDM.
 */
import { describe, expect, it } from "vitest";
import { barisInvestasiKas, pesanKasKurang, ringkasModal, type JurnalSumber } from "@/lib/inti/modal";
import { saldo } from "@/lib/inti/buku-besar";
import { AKUN } from "@/lib/inti/akun";
import { muatSeedLama, koleksi } from "./app-lama";

const j = (no: string, tanggal: string, sumberTipe: string | null, baris: [string, number, number][], extra: Partial<JurnalSumber> = {}): JurnalSumber => ({
  no,
  tanggal,
  periode: tanggal.slice(0, 7),
  status: "DISETUJUI",
  jenis: "UMUM",
  sumberTipe,
  sumberId: null,
  keterangan: no,
  baris: baris.map(([akun, debit, kredit]) => ({ akun, debit, kredit })),
  ...extra,
});

/** Cek identitas ringkasan terhadap buku besar untuk satu rentang. */
function cocokBukuBesar(jurnal: JurnalSumber[], periode: string | null) {
  const r = ringkasModal(jurnal, periode);
  const buku = jurnal.map((x) => ({ ...x }));
  expect(r.kas.akhir).toBe(saldo(buku, AKUN.KAS, "D", periode));
  expect(r.modal.akhir).toBe(saldo(buku, AKUN.MODAL, "K", periode));
  expect(r.kas.awal + r.kas.masuk.total - r.kas.keluar.total).toBe(r.kas.akhir);
  expect(r.modal.awal + r.modal.setoranKas.jumlah + r.modal.setoranBarang.jumlah + r.modal.lainnya.jumlah).toBe(r.modal.akhir);
  expect(r.biayaSdm.tetap.bruto.jumlah + r.biayaSdm.variabel.bruto.jumlah - r.biayaSdm.pph21).toBe(r.kas.keluar.sdm);
  expect(r.biayaSdm.dibayar).toBe(r.kas.keluar.gaji.jumlah + r.kas.keluar.fee.jumlah);
  return r;
}

const CONTOH: JurnalSumber[] = [
  j("JU-01", "2026-10-01", "INVESTASI_KAS", [[AKUN.KAS, 30_000_000, 0], [AKUN.MODAL, 0, 30_000_000]], { sumberId: "INV-2026-0001" }),
  j("JU-02", "2026-10-05", "PEMBELIAN", [[AKUN.PERALATAN, 9_800_000, 0], [AKUN.KAS, 0, 9_800_000]], { sumberId: "BP-2026-0002" }),
  j("JU-03", "2026-10-15", "PEMBELIAN", [[AKUN.PERALATAN, 3_800_000, 0], [AKUN.MODAL, 0, 3_800_000]], { sumberId: "BP-2026-0003" }),
  j("JU-04", "2026-10-20", "PEMBELIAN", [[AKUN.PERALATAN, 5_000_000, 0], [AKUN.UTANG_USAHA, 0, 5_000_000]], { sumberId: "BP-2026-0004" }),
  j("JU-05", "2026-10-31", "PENGGAJIAN", [[AKUN.BIAYA_GAJI_PRODUKSI, 10_000_000, 0], [AKUN.BIAYA_GAJI_ADMINISTRASI, 2_000_000, 0], [AKUN.UTANG_PPH21, 0, 300_000], [AKUN.KAS, 0, 11_700_000]]),
  j("JP-01", "2026-10-31", "PENYUSUTAN", [[AKUN.BIAYA_PENYUSUTAN, 500_000, 0], [AKUN.AKUMULASI_PENYUSUTAN, 0, 500_000]], { jenis: "PENYESUAIAN" }),
  j("JU-06", "2026-11-02", "INVESTASI_KAS", [[AKUN.KAS, 5_000_000, 0], [AKUN.MODAL, 0, 5_000_000]], { sumberId: "INV-2026-0002" }),
  // Pembalik pembelian tunai November mengembalikan kas; pembalik setoran barang mengurangi modal.
  j("JU-07", "2026-11-03", "PEMBELIAN", [[AKUN.PERLENGKAPAN, 75_000, 0], [AKUN.KAS, 0, 75_000]], { sumberId: "BL-2026-0003" }),
  j("JB-01", "2026-11-04", "PEMBELIAN", [[AKUN.KAS, 75_000, 0], [AKUN.PERLENGKAPAN, 0, 75_000]], { sumberId: "BL-2026-0003", jenis: "PEMBALIK" }),
  j("JB-02", "2026-11-04", "PEMBELIAN", [[AKUN.MODAL, 800_000, 0], [AKUN.PERALATAN, 0, 800_000]], { sumberId: "BP-2026-0009", jenis: "PEMBALIK" }),
  j("JU-08", "2026-11-10", "PELEPASAN", [[AKUN.KAS, 600_000, 0], [AKUN.AKUMULASI_PENYUSUTAN, 500_000, 0], [AKUN.RUGI_PELEPASAN, 200_000, 0], [AKUN.PERALATAN, 0, 1_300_000]]),
  j("JU-09", "2026-11-20", "FEE_EVENT", [[AKUN.BIAYA_FEE_EVENT, 1_000_000, 0], [AKUN.UTANG_PPH21, 0, 25_000], [AKUN.KAS, 0, 975_000]]),
  // Setoran lama yang tidak dibackfill tetap terhitung di pos "lainnya", supaya tidak ada rupiah yang hilang.
  j("JU-10", "2026-11-21", "SALDO_AWAL", [[AKUN.KAS, 1_000_000, 0], [AKUN.MODAL, 0, 1_000_000]]),
  // Yang belum disetujui tidak dihitung.
  j("JU-11", "2026-11-22", "INVESTASI_KAS", [[AKUN.KAS, 9_999_000, 0], [AKUN.MODAL, 0, 9_999_000]], { status: "DIAJUKAN" }),
];

describe("ringkasModal", () => {
  it("kumulatif: modal = setoran kas + setoran barang, kas masuk dan keluar per siklus, cocok buku besar", () => {
    const r = cocokBukuBesar(CONTOH, null);
    expect(r.modal.awal).toBe(0);
    expect(r.modal.setoranKas.jumlah).toBe(35_000_000);
    expect(r.modal.setoranBarang.jumlah).toBe(3_000_000);
    expect(r.modal.setoranBarang.rincian.map((x) => [x.sumberId, x.jumlah])).toEqual([["BP-2026-0003", 3_800_000], ["BP-2026-0009", -800_000]]);
    expect(r.modal.lainnya.jumlah).toBe(1_000_000);
    expect(r.modal.akhir).toBe(39_000_000);
    expect(r.kas.masuk.investasi.jumlah).toBe(35_000_000);
    expect(r.kas.masuk.penjualanAset.jumlah).toBe(600_000);
    expect(r.kas.masuk.lainnya.jumlah).toBe(1_000_000);
    expect(r.kas.keluar.pembelianTunai.jumlah).toBe(9_800_000);
    expect(r.kas.keluar.konversi).toBe(9_800_000);
    expect(r.kas.keluar.gaji.jumlah).toBe(11_700_000);
    expect(r.kas.keluar.fee.jumlah).toBe(975_000);
    expect(r.kas.keluar.sdm).toBe(12_675_000);
    expect(r.kas.akhir).toBe(36_600_000 - 9_800_000 - 12_675_000);
  });

  it("per periode: saldo awal dari periode sebelumnya, mutasi hanya periode itu", () => {
    const okt = cocokBukuBesar(CONTOH, "2026-10");
    expect([okt.kas.awal, okt.kas.akhir]).toEqual([0, 30_000_000 - 9_800_000 - 11_700_000]);
    const nov = cocokBukuBesar(CONTOH, "2026-11");
    expect(nov.kas.awal).toBe(okt.kas.akhir);
    expect(nov.modal.awal).toBe(okt.modal.akhir);
    expect(nov.modal.setoranKas.jumlah).toBe(5_000_000);
    expect(nov.modal.setoranBarang.jumlah).toBe(-800_000);
    expect(nov.kas.keluar.pembelianTunai.jumlah).toBe(0); // dibeli 75.000 lalu dibalik
    expect(nov.kas.keluar.gaji.jumlah).toBe(0);
    expect(cocokBukuBesar(CONTOH, "2026-12").kas.awal).toBe(nov.kas.akhir);
  });

  it("Biaya SDM: gaji = biaya tetap, fee = biaya variabel, bruto dikurangi PPh 21 = kas keluar SDM", () => {
    const okt = ringkasModal(CONTOH, "2026-10").biayaSdm;
    expect([okt.tetap.bruto.jumlah, okt.tetap.pph21, okt.tetap.dibayar]).toEqual([12_000_000, 300_000, 11_700_000]);
    expect(okt.variabel.bruto.jumlah).toBe(0);
    const nov = ringkasModal(CONTOH, "2026-11").biayaSdm;
    expect([nov.variabel.bruto.jumlah, nov.variabel.pph21, nov.variabel.dibayar]).toEqual([1_000_000, 25_000, 975_000]);
    expect(nov.tetap.bruto.jumlah).toBe(0);
    const semua = ringkasModal(CONTOH, null).biayaSdm;
    expect([semua.bruto, semua.pph21, semua.dibayar]).toEqual([13_000_000, 325_000, 12_675_000]);
  });

  it("data contoh Oktober 2026: modal Rp33.800.000 + Rp75.000.000, kas sama dengan buku besar app lama", () => {
    const seed = muatSeedLama();
    // Setoran modal data lama diperlakukan seperti hasil seed/backfill: sumber INVESTASI_KAS.
    const jurnal = koleksi<{ tanggal: string; periode: string; status: string; jenis: string; sumber_tipe?: string; sumber_id?: string; keterangan: string; baris: { akun: string; debit: number; kredit: number }[] }>(seed, "jurnal").map((x) => ({
      no: x.id,
      tanggal: x.tanggal,
      periode: x.periode,
      status: x.status.toUpperCase(),
      jenis: x.jenis.toUpperCase() as JurnalSumber["jenis"],
      sumberTipe: x.sumber_tipe === "saldo_awal" ? "INVESTASI_KAS" : (x.sumber_tipe?.toUpperCase() ?? null),
      sumberId: x.sumber_id ?? null,
      keterangan: x.keterangan,
      baris: x.baris,
    }));
    const r = cocokBukuBesar(jurnal, "2026-10");
    expect(r.modal.setoranKas.jumlah).toBe(105_000_000);
    expect(r.modal.setoranBarang.jumlah).toBe(3_800_000);
    expect(r.kas.keluar.pembelianTunai.jumlah).toBe(9_800_000 + 8_900_000 + 9_500_000 + 1_290_000);
    expect(r.kas.keluar.gaji.jumlah).toBe(31_200_343);
    expect(r.biayaSdm.tetap.bruto.jumlah).toBe(25_904_546 + 5_595_455);
    cocokBukuBesar(jurnal, null);
  });
});

describe("Investasi Kas: jurnal dan pesan", () => {
  it("jurnal setoran Dr Kas, Kr Modal Pemilik", () => {
    expect(barisInvestasiKas(1_500_000)).toEqual([
      { akun: "1-110", debit: 1_500_000, kredit: 0 },
      { akun: "3-110", debit: 0, kredit: 1_500_000 },
    ]);
  });
  it("pesan kas kurang menyebut kekurangannya dan mengarahkan ke Investasi Kas", () => {
    const p = pesanKasKurang(1_000_000, 3_500_000, "gaji");
    expect(p).toContain("Kurang Rp2.500.000");
    expect(p).toContain("Investasi Kas");
  });
});
