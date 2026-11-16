/*
 * Buku besar dan neraca saldo dihitung dari baris jurnal (tidak disimpan sebagai tabel).
 * Hanya jurnal berstatus DISETUJUI yang dihitung, sama dengan versi-statis/assets/js/core/ledger.js.
 */
import type { BarisJurnal } from "./jurnal";

export type JurnalBuku = {
  no: string;
  tanggal: string;
  periode: string;
  status: string;
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

export type BarisBukuBesar = { tanggal: string; no: string; keterangan: string; debit: number; kredit: number; saldo: number };

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
      baris.push({ tanggal: j.tanggal, no: j.no, keterangan: j.keterangan ?? "", debit: b.debit, kredit: b.kredit, saldo: s });
    }
  }
  return { saldoAwal, baris, saldoAkhir: s };
}
