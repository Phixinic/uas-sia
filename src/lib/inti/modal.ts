/*
 * Investasi Kas dan ringkasan "Dari mana kas dan modal" (logika murni, tanpa database).
 *
 * Aplikasi ini hanya mencakup siklus konversi (peralatan, perlengkapan) dan siklus SDM (gaji inhouse, fee event),
 * tanpa siklus pendapatan. Jadi kas yang dipakai pembelian tunai, gaji, dan fee harus berasal dari setoran modal
 * pemilik. Ringkasan di sini menelusuri setiap rupiah di akun Kas 1-110 dan Modal Pemilik 3-110 ke sumber jurnalnya,
 * dihitung hanya dari jurnal DISETUJUI, sehingga totalnya selalu sama dengan saldo kedua akun di buku besar.
 *
 * Biaya SDM dipisah menurut perilakunya: gaji inhouse = biaya tetap (komponen dari Setting Gaji, hanya potongan absen
 * yang berubah per bulan), fee crew event = biaya variabel (tarif x jam atau hari, per event). Biaya dicatat bruto;
 * PPh 21 yang dipotong menjadi utang, jadi biaya tetap + biaya variabel - PPh 21 dipotong = kas keluar siklus SDM.
 */
import { AKUN } from "./akun";
import { rupiah } from "@/lib/format";
import type { BarisJurnal } from "./jurnal";

/** Jurnal setoran kas: Dr Kas, Kr Modal Pemilik sebesar jumlah setoran. */
export function barisInvestasiKas(jumlah: number): BarisJurnal[] {
  return [
    { akun: AKUN.KAS, debit: jumlah, kredit: 0 },
    { akun: AKUN.MODAL, debit: 0, kredit: jumlah },
  ];
}

/** Pesan saat saldo kas tidak cukup, mengarahkan pengguna ke Investasi Kas. */
export function pesanKasKurang(kas: number, perlu: number, untuk: string): string {
  return `Saldo kas ${rupiah(kas)} tidak cukup untuk membayar ${untuk} ${rupiah(perlu)}. Kurang ${rupiah(perlu - kas)}. Catat setoran modal di menu Investasi Kas, minta Owner menyetujuinya, lalu ulangi.`;
}

/** Bentuk jurnal yang dibutuhkan ringkasan (dibaca dari tabel jurnal beserta sumbernya). */
export type JurnalSumber = {
  no: string;
  tanggal: string;
  periode: string;
  status: string;
  jenis: "UMUM" | "PENYESUAIAN" | "PEMBALIK";
  sumberTipe: string | null;
  sumberId: string | null;
  keterangan: string;
  baris: BarisJurnal[];
};

/** Satu baris rincian: jurnal dan dokumen asalnya. `jumlah` bertanda (negatif = mengurangi, misalnya jurnal pembalik). */
export type RincianSumber = { jurnalNo: string; sumberId: string | null; tanggal: string; keterangan: string; jumlah: number };

type Pos = { jumlah: number; rincian: RincianSumber[] };
const pos = (): Pos => ({ jumlah: 0, rincian: [] });

/** Biaya SDM satu jenis: bruto (akun beban) dan PPh 21 yang dipotong (Kr Utang PPh 21). */
export type BiayaSdm = { bruto: Pos; pph21: number; dibayar: number };

export type RingkasanModal = {
  /** null = kumulatif (semua jurnal disetujui); selain itu satu periode "YYYY-MM". */
  periode: string | null;
  modal: {
    /** Saldo Modal Pemilik sebelum periode (0 untuk kumulatif). */
    awal: number;
    /** Setoran kas lewat Investasi Kas. */
    setoranKas: Pos;
    /** Setoran barang: pembelian peralatan atau perlengkapan dengan cara bayar Investasi (pembaliknya mengurangi). */
    setoranBarang: Pos;
    /** Jurnal lain yang menyentuh Modal Pemilik (misalnya saldo awal yang tidak berpola setoran). Biasanya 0. */
    lainnya: Pos;
    mutasi: number;
    akhir: number;
  };
  kas: {
    awal: number;
    masuk: { investasi: Pos; penjualanAset: Pos; lainnya: Pos; total: number };
    keluar: {
      /** Siklus konversi: pembelian tunai (dikurangi pembaliknya). Aplikasi belum punya pelunasan utang usaha. */
      pembelianTunai: Pos;
      /** Siklus SDM. */
      gaji: Pos;
      fee: Pos;
      lainnya: Pos;
      konversi: number;
      sdm: number;
      total: number;
    };
    akhir: number;
  };
  /** Biaya SDM di rentang yang sama (jurnal PENGGAJIAN dan FEE_EVENT). */
  biayaSdm: {
    /** Gaji inhouse, biaya tetap. */
    tetap: BiayaSdm;
    /** Fee crew event, biaya variabel. */
    variabel: BiayaSdm;
    bruto: number;
    pph21: number;
    /** = kas.keluar.sdm */
    dibayar: number;
  };
};

/** Bruto (semua akun selain Kas dan Utang PPh 21) dan PPh 21 dipotong dari satu jurnal gaji atau fee. */
function pecahBiaya(j: JurnalSumber) {
  let bruto = 0;
  let pph21 = 0;
  for (const b of j.baris) {
    if (b.akun === AKUN.KAS) continue;
    if (b.akun === AKUN.UTANG_PPH21) pph21 += (b.kredit || 0) - (b.debit || 0);
    else bruto += (b.debit || 0) - (b.kredit || 0);
  }
  return { bruto, pph21 };
}

function tambah(p: Pos, j: JurnalSumber, jumlah: number) {
  if (!jumlah) return;
  p.jumlah += jumlah;
  p.rincian.push({ jurnalNo: j.no, sumberId: j.sumberId, tanggal: j.tanggal, keterangan: j.keterangan, jumlah });
}

/** Mutasi bersih satu akun di satu jurnal: debit - kredit. */
const bersih = (j: JurnalSumber, akun: string) => j.baris.reduce((s, b) => (b.akun === akun ? s + (b.debit || 0) - (b.kredit || 0) : s), 0);

/**
 * Ringkasan asal kas dan modal untuk satu periode (`periode` = "YYYY-MM") atau kumulatif (`periode` = null).
 * Hanya jurnal DISETUJUI yang dihitung. Setiap baris jurnal Kas dan Modal masuk tepat ke satu pos, jadi:
 *   kas.awal + kas.masuk.total - kas.keluar.total = kas.akhir = saldo Kas di buku besar sampai periode itu
 *   modal.awal + modal.mutasi = modal.akhir = saldo Modal Pemilik di buku besar sampai periode itu
 * Penggolongan memakai sumber jurnal: INVESTASI_KAS, PELEPASAN (hasil jual aset), PEMBELIAN (termasuk pembaliknya),
 * PENGGAJIAN, FEE_EVENT; sumber lain masuk pos "lainnya" supaya tidak ada rupiah yang hilang dari ringkasan.
 */
export function ringkasModal(jurnal: JurnalSumber[], periode: string | null): RingkasanModal {
  const m = { awal: 0, setoranKas: pos(), setoranBarang: pos(), lainnya: pos() };
  const biaya = { tetap: pos(), variabel: pos(), pphTetap: 0, pphVariabel: 0 };
  const k = { awal: 0, investasi: pos(), penjualanAset: pos(), masukLain: pos(), pembelianTunai: pos(), gaji: pos(), fee: pos(), keluarLain: pos() };
  const urut = [...jurnal].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.no.localeCompare(b.no));
  for (const j of urut) {
    if (j.status !== "DISETUJUI") continue;
    if (periode && j.periode > periode) continue;
    const kas = bersih(j, AKUN.KAS);
    const modal = -bersih(j, AKUN.MODAL); // saldo normal kredit
    if (periode && j.periode < periode) {
      k.awal += kas;
      m.awal += modal;
      continue;
    }
    switch (j.sumberTipe) {
      case "INVESTASI_KAS":
        tambah(k.investasi, j, kas);
        tambah(m.setoranKas, j, modal);
        break;
      case "PELEPASAN":
        tambah(k.penjualanAset, j, kas);
        tambah(m.lainnya, j, modal);
        break;
      case "PEMBELIAN":
        tambah(k.pembelianTunai, j, -kas);
        tambah(m.setoranBarang, j, modal);
        break;
      case "PENGGAJIAN": {
        tambah(k.gaji, j, -kas);
        tambah(m.lainnya, j, modal);
        const b = pecahBiaya(j);
        tambah(biaya.tetap, j, b.bruto);
        biaya.pphTetap += b.pph21;
        break;
      }
      case "FEE_EVENT": {
        tambah(k.fee, j, -kas);
        tambah(m.lainnya, j, modal);
        const b = pecahBiaya(j);
        tambah(biaya.variabel, j, b.bruto);
        biaya.pphVariabel += b.pph21;
        break;
      }
      default:
        if (kas > 0) tambah(k.masukLain, j, kas);
        else tambah(k.keluarLain, j, -kas);
        tambah(m.lainnya, j, modal);
    }
  }
  const masuk = k.investasi.jumlah + k.penjualanAset.jumlah + k.masukLain.jumlah;
  const konversi = k.pembelianTunai.jumlah;
  const sdm = k.gaji.jumlah + k.fee.jumlah;
  const keluar = konversi + sdm + k.keluarLain.jumlah;
  const mutasiModal = m.setoranKas.jumlah + m.setoranBarang.jumlah + m.lainnya.jumlah;
  return {
    periode,
    modal: { awal: m.awal, setoranKas: m.setoranKas, setoranBarang: m.setoranBarang, lainnya: m.lainnya, mutasi: mutasiModal, akhir: m.awal + mutasiModal },
    kas: {
      awal: k.awal,
      masuk: { investasi: k.investasi, penjualanAset: k.penjualanAset, lainnya: k.masukLain, total: masuk },
      keluar: { pembelianTunai: k.pembelianTunai, gaji: k.gaji, fee: k.fee, lainnya: k.keluarLain, konversi, sdm, total: keluar },
      akhir: k.awal + masuk - keluar,
    },
    biayaSdm: {
      tetap: { bruto: biaya.tetap, pph21: biaya.pphTetap, dibayar: biaya.tetap.jumlah - biaya.pphTetap },
      variabel: { bruto: biaya.variabel, pph21: biaya.pphVariabel, dibayar: biaya.variabel.jumlah - biaya.pphVariabel },
      bruto: biaya.tetap.jumlah + biaya.variabel.jumlah,
      pph21: biaya.pphTetap + biaya.pphVariabel,
      dibayar: biaya.tetap.jumlah + biaya.variabel.jumlah - biaya.pphTetap - biaya.pphVariabel,
    },
  };
}
