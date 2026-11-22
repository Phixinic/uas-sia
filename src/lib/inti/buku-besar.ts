/*
 * Buku besar dan neraca saldo dihitung dari baris jurnal (tidak disimpan sebagai tabel).
 * Hanya jurnal berstatus DISETUJUI yang dihitung, sama dengan versi-statis/assets/js/core/ledger.js.
 * Fungsi `mutasi`, `saldo`, `neracaSaldo`, dan `bukuBesar` memakai semua jenis jurnal (saldo lengkap) dan dipakai
 * dashboard, tutup periode, serta cek saldo kas. Tahap siklus akuntansi (sebelum atau setelah penyesuaian)
 * ada di `saringTahap`, `bukuBesarTahap`, dan `neracaLajur` di bagian bawah berkas.
 */
import type { BarisJurnal } from "./jurnal";

export type JenisJurnalBuku = "UMUM" | "PENYESUAIAN" | "PEMBALIK";

export type JurnalBuku = {
  no: string;
  tanggal: string;
  periode: string;
  status: string;
  jenis: JenisJurnalBuku;
  keterangan?: string;
  baris: BarisJurnal[];
};

export type SaldoNormal = "D" | "K";

/** Total debit dan kredit satu akun dari periode `dari` sampai `sampai` (inklusif, null = tanpa batas). */
export function mutasi(jurnal: JurnalBuku[], akun: string, dari: string | null = null, sampai: string | null = null) {
  let debit = 0;
  let kredit = 0;
  for (const j of jurnal) {
    if (j.status !== "DISETUJUI") continue;
    if (dari && j.periode < dari) continue;
    if (sampai && j.periode > sampai) continue;
    for (const b of j.baris) {
      if (b.akun !== akun) continue;
      debit += b.debit || 0;
      kredit += b.kredit || 0;
    }
  }
  return { debit, kredit };
}

/** Saldo akun sampai akhir periode, bertanda sesuai saldo normal. */
export function saldo(jurnal: JurnalBuku[], akun: string, normal: SaldoNormal, sampai: string | null = null): number {
  const m = mutasi(jurnal, akun, null, sampai);
  return normal === "D" ? m.debit - m.kredit : m.kredit - m.debit;
}

export type BarisNeraca = { kode: string; debit: number; kredit: number };

/** Neraca saldo sampai periode `sampai`. `kodeAkun` = akun master; akun yang hanya muncul di jurnal ikut dihitung. */
export function neracaSaldo(jurnal: JurnalBuku[], kodeAkun: string[], sampai: string | null) {
  const semua = new Set(kodeAkun);
  for (const j of jurnal) for (const b of j.baris) semua.add(b.akun);
  const baris: BarisNeraca[] = [];
  let debit = 0;
  let kredit = 0;
  for (const kode of [...semua].sort()) {
    const m = mutasi(jurnal, kode, null, sampai);
    const net = m.debit - m.kredit;
    if (!net) continue;
    baris.push({ kode, debit: net > 0 ? net : 0, kredit: net < 0 ? -net : 0 });
    if (net > 0) debit += net;
    else kredit += -net;
  }
  return { baris, debit, kredit, seimbang: debit === kredit };
}

export type BarisBukuBesar = { tanggal: string; no: string; jenis: JenisJurnalBuku; keterangan: string; debit: number; kredit: number; saldo: number };

/** Buku besar satu akun untuk satu periode: saldo awal, mutasi berurutan dengan saldo berjalan, saldo akhir. */
export function bukuBesar(jurnal: JurnalBuku[], akun: string, normal: SaldoNormal, periode: string) {
  const sebelum = jurnal.filter((j) => j.periode < periode);
  let s = saldo(sebelum, akun, normal, null);
  const saldoAwal = s;
  const baris: BarisBukuBesar[] = [];
  const dalam = jurnal
    .filter((j) => j.status === "DISETUJUI" && j.periode === periode)
    .sort((a, b) => (a.tanggal + a.no).localeCompare(b.tanggal + b.no));
  for (const j of dalam) {
    for (const b of j.baris) {
      if (b.akun !== akun) continue;
      s += normal === "D" ? b.debit - b.kredit : b.kredit - b.debit;
      baris.push({ tanggal: j.tanggal, no: j.no, jenis: j.jenis, keterangan: j.keterangan ?? "", debit: b.debit, kredit: b.kredit, saldo: s });
    }
  }
  return { saldoAwal, baris, saldoAkhir: s };
}

/* ---------- Tahap siklus akuntansi ---------- */

/** Tahap laporan: neraca saldo dan buku besar sebelum atau setelah jurnal penyesuaian periode itu. */
export type Tahap = "sebelum" | "setelah";

export const TAHAP: readonly Tahap[] = ["sebelum", "setelah"];

/** Nilai `?tahap=` dari URL; selain "sebelum" dianggap "setelah" supaya tautan lama tetap bermakna sama. */
export const tahapDari = (nilai: string | null | undefined): Tahap => (nilai === "sebelum" ? "sebelum" : "setelah");

/**
 * Jurnal yang dihitung untuk tahap tertentu di periode P (hanya jurnal DISETUJUI):
 * - "sebelum": semua jurnal di periode sebelum P (semua jenis, karena penyesuaian periode lalu sudah menjadi
 *   saldo awal) ditambah jurnal UMUM dan PEMBALIK di periode P.
 * - "setelah": semua jurnal sampai P, termasuk jurnal PENYESUAIAN periode P.
 * PEMBALIK ikut tahap "sebelum" karena hanya dibuat oleh aksi balik pembelian (`balikPembelian`): isinya membatalkan
 * jurnal transaksi pembelian, bukan penyesuaian akhir periode, dan langsung DISETUJUI tanpa alur persetujuan penyesuaian.
 */
export function saringTahap(jurnal: JurnalBuku[], periode: string, tahap: Tahap): JurnalBuku[] {
  return jurnal.filter(
    (j) => j.status === "DISETUJUI" && (j.periode < periode || (j.periode === periode && (tahap === "setelah" || j.jenis !== "PENYESUAIAN"))),
  );
}

/**
 * Buku besar satu akun per tahap. Saldo awal = semua jurnal sebelum P. Mutasi UMUM dan PEMBALIK di P tampil lebih dulu
 * (urut tanggal lalu nomor), lalu `saldoSebelumPenyesuaian`. Untuk tahap "setelah", mutasi PENYESUAIAN di P menyusul
 * sesudahnya, jadi saldo sebelum penyesuaian + mutasi penyesuaian = saldo akhir.
 */
export function bukuBesarTahap(jurnal: JurnalBuku[], akun: string, normal: SaldoNormal, periode: string, tahap: Tahap) {
  const sebelum = bukuBesar(saringTahap(jurnal, periode, "sebelum"), akun, normal, periode);
  if (tahap === "sebelum") {
    return { ...sebelum, saldoSebelumPenyesuaian: sebelum.saldoAkhir, mutasiPenyesuaian: 0, adaPenyesuaian: false };
  }
  const penyesuaian = jurnal.filter((j) => j.status === "DISETUJUI" && j.periode === periode && j.jenis === "PENYESUAIAN");
  const lanjutan = bukuBesar(penyesuaian, akun, normal, periode).baris.map((b) => ({ ...b, saldo: b.saldo + sebelum.saldoAkhir }));
  const saldoAkhir = lanjutan.length ? lanjutan[lanjutan.length - 1].saldo : sebelum.saldoAkhir;
  return {
    saldoAwal: sebelum.saldoAwal,
    baris: [...sebelum.baris, ...lanjutan],
    saldoSebelumPenyesuaian: sebelum.saldoAkhir,
    mutasiPenyesuaian: saldoAkhir - sebelum.saldoAkhir,
    adaPenyesuaian: lanjutan.length > 0,
    saldoAkhir,
  };
}

type DK = { debit: number; kredit: number };
export type BarisNeracaLajur = { kode: string; neracaSaldo: DK; penyesuaian: DK; setelah: DK };

/**
 * Neraca lajur ringkas periode P: Neraca Saldo (tahap "sebelum"), Penyesuaian (jumlah debit dan kredit jurnal
 * PENYESUAIAN DISETUJUI di P, tidak dinetokan), dan Neraca Saldo Setelah Penyesuaian (tahap "setelah").
 * Per akun berlaku saldo neraca saldo + (debit - kredit penyesuaian) = saldo setelah penyesuaian.
 * Akun tanpa saldo dan tanpa penyesuaian tidak ditampilkan.
 */
export function neracaLajur(jurnal: JurnalBuku[], kodeAkun: string[], periode: string) {
  const ns = neracaSaldo(saringTahap(jurnal, periode, "sebelum"), kodeAkun, periode);
  const nss = neracaSaldo(saringTahap(jurnal, periode, "setelah"), kodeAkun, periode);
  const adj = new Map<string, DK>();
  for (const j of jurnal) {
    if (j.status !== "DISETUJUI" || j.periode !== periode || j.jenis !== "PENYESUAIAN") continue;
    for (const b of j.baris) {
      const m = adj.get(b.akun) ?? { debit: 0, kredit: 0 };
      m.debit += b.debit || 0;
      m.kredit += b.kredit || 0;
      adj.set(b.akun, m);
    }
  }
  const kosong = (): DK => ({ debit: 0, kredit: 0 });
  const petaNs = new Map(ns.baris.map((b) => [b.kode, { debit: b.debit, kredit: b.kredit }]));
  const petaNss = new Map(nss.baris.map((b) => [b.kode, { debit: b.debit, kredit: b.kredit }]));
  const kode = [...new Set([...petaNs.keys(), ...adj.keys(), ...petaNss.keys()])].sort();
  const baris: BarisNeracaLajur[] = kode
    .map((k) => ({ kode: k, neracaSaldo: petaNs.get(k) ?? kosong(), penyesuaian: adj.get(k) ?? kosong(), setelah: petaNss.get(k) ?? kosong() }))
    .filter((b) => b.neracaSaldo.debit || b.neracaSaldo.kredit || b.penyesuaian.debit || b.penyesuaian.kredit || b.setelah.debit || b.setelah.kredit);
  const jumlah = (pilih: (b: BarisNeracaLajur) => DK): DK & { seimbang: boolean } => {
    const t = baris.reduce((s, b) => ({ debit: s.debit + pilih(b).debit, kredit: s.kredit + pilih(b).kredit }), kosong());
    return { ...t, seimbang: t.debit === t.kredit };
  };
  const total = { neracaSaldo: jumlah((b) => b.neracaSaldo), penyesuaian: jumlah((b) => b.penyesuaian), setelah: jumlah((b) => b.setelah) };
  return { baris, total, seimbang: total.neracaSaldo.seimbang && total.penyesuaian.seimbang && total.setelah.seimbang };
}
