/*
 * Pembentuk baris jurnal dan validasinya. Murni (tanpa database): dipakai server action, pratinjau di form, dan tes.
 * Aturan sama dengan versi-statis: tiap baris hanya debit atau kredit, minimal dua baris, total debit = kredit > 0.
 */
import { AKUN, AKUN_LAWAN_BAYAR, type CaraBayar } from "./akun";

export type BarisJurnal = { akun: string; debit: number; kredit: number };

export class GalatJurnal extends Error {}

/** Membuang baris nol lalu memeriksa keseimbangan. Melempar GalatJurnal bila tidak sah. */
export function validasiBaris(baris: BarisJurnal[]): BarisJurnal[] {
  const bersih = baris
    .filter((b) => (b.debit || 0) > 0 || (b.kredit || 0) > 0)
    .map((b) => ({ akun: b.akun, debit: Math.round(b.debit || 0), kredit: Math.round(b.kredit || 0) }));
  for (const b of bersih) {
    if (b.debit < 0 || b.kredit < 0) throw new GalatJurnal("Nilai debit atau kredit tidak boleh negatif.");
    if (b.debit > 0 && b.kredit > 0) throw new GalatJurnal("Satu baris jurnal hanya boleh berisi debit atau kredit.");
  }
  const { debit, kredit } = totalBaris(bersih);
  if (bersih.length < 2 || debit !== kredit || debit <= 0) throw new GalatJurnal("Jurnal tidak seimbang, jadi tidak disimpan.");
  return bersih;
}

export const totalBaris = (baris: BarisJurnal[]) => ({
  debit: baris.reduce((s, b) => s + (b.debit || 0), 0),
  kredit: baris.reduce((s, b) => s + (b.kredit || 0), 0),
});

/** Pembelian: debit akun aset/perlengkapan (per akun), kredit kas/utang/modal sebesar total. */
export function barisPembelian(debitPerAkun: Record<string, number>, caraBayar: CaraBayar): BarisJurnal[] {
  const total = Object.values(debitPerAkun).reduce((s, x) => s + x, 0);
  return Object.keys(debitPerAkun)
    .map((akun) => ({ akun, debit: debitPerAkun[akun], kredit: 0 }))
    .concat([{ akun: AKUN_LAWAN_BAYAR[caraBayar], debit: 0, kredit: total }]);
}

/** Penyusutan satu periode: dikelompokkan per pasangan akun beban dan akun akumulasi. */
export function barisPenyusutan(daftar: { akunBeban: string; akunAkumulasi: string; beban: number }[]): BarisJurnal[] {
  const grup = new Map<string, number>();
  for (const x of daftar) {
    const k = `${x.akunBeban}|${x.akunAkumulasi}`;
    grup.set(k, (grup.get(k) ?? 0) + x.beban);
  }
  return [...grup.entries()].flatMap(([k, nilai]) => {
    const [beban, akm] = k.split("|");
    return [{ akun: beban, debit: nilai, kredit: 0 }, { akun: akm, debit: 0, kredit: nilai }];
  });
}

/** Biaya perlengkapan dari input nilai sisa. */
export const barisOpname = (totalBeban: number): BarisJurnal[] => [
  { akun: AKUN.BIAYA_PERLENGKAPAN, debit: totalBeban, kredit: 0 },
  { akun: AKUN.PERLENGKAPAN, debit: 0, kredit: totalBeban },
];

/** Nilai buku dan laba/rugi pelepasan. labaRugi positif = laba. */
export function hitungPelepasan(nilaiPerolehan: number, akumulasiDisetujui: number, hargaJual: number) {
  const nilaiBuku = nilaiPerolehan - akumulasiDisetujui;
  return { akumulasi: akumulasiDisetujui, nilaiBuku, labaRugi: hargaJual - nilaiBuku };
}

export function barisPelepasan(a: {
  nilaiPerolehan: number;
  akumulasi: number;
  hargaJual: number;
  akunAset?: string;
  akunAkumulasi?: string;
}): BarisJurnal[] {
  const { labaRugi } = hitungPelepasan(a.nilaiPerolehan, a.akumulasi, a.hargaJual);
  return [
    { akun: a.akunAkumulasi || AKUN.AKUMULASI_PENYUSUTAN, debit: a.akumulasi, kredit: 0 },
    { akun: AKUN.KAS, debit: a.hargaJual, kredit: 0 },
    { akun: AKUN.RUGI_PELEPASAN, debit: labaRugi < 0 ? -labaRugi : 0, kredit: 0 },
    { akun: a.akunAset || AKUN.PERALATAN, debit: 0, kredit: a.nilaiPerolehan },
    { akun: AKUN.LABA_PELEPASAN, debit: 0, kredit: labaRugi > 0 ? labaRugi : 0 },
  ];
}

/** Penggajian: debit biaya gaji per akun beban (bruto), kredit utang PPh 21 dan kas (THP). */
export function barisGaji(slip: { akunBeban: string; bruto: number; pph21: number; thp: number }[]): BarisJurnal[] {
  const grup: Record<string, number> = {};
  for (const s of slip) grup[s.akunBeban || AKUN.BIAYA_GAJI_ADMINISTRASI] = (grup[s.akunBeban || AKUN.BIAYA_GAJI_ADMINISTRASI] ?? 0) + s.bruto;
  return Object.keys(grup)
    .sort()
    .map((akun) => ({ akun, debit: grup[akun], kredit: 0 }))
    .concat([
      { akun: AKUN.UTANG_PPH21, debit: 0, kredit: slip.reduce((s, x) => s + x.pph21, 0) },
      { akun: AKUN.KAS, debit: 0, kredit: slip.reduce((s, x) => s + x.thp, 0) },
    ]);
}

/**
 * Fee event: debit beban fee per akun beban jabatan (fee akhir = bruto), kredit Utang PPh 21 dan Kas (yang dibayar).
 * Baris bernilai nol dibuang oleh validasiBaris.
 */
export function barisFeeEvent(slip: { akunBeban: string; bruto: number; pph21: number; dibayar: number }[]): BarisJurnal[] {
  const grup: Record<string, number> = {};
  for (const s of slip) {
    const akun = s.akunBeban || AKUN.BIAYA_FEE_EVENT;
    grup[akun] = (grup[akun] ?? 0) + s.bruto;
  }
  return Object.keys(grup)
    .sort()
    .map((akun) => ({ akun, debit: grup[akun], kredit: 0 }))
    .concat([
      { akun: AKUN.UTANG_PPH21, debit: 0, kredit: slip.reduce((s, x) => s + x.pph21, 0) },
      { akun: AKUN.KAS, debit: 0, kredit: slip.reduce((s, x) => s + x.dibayar, 0) },
    ]);
}

/** Jurnal pembalik: debit dan kredit ditukar. */
export const barisPembalik = (baris: BarisJurnal[]): BarisJurnal[] => baris.map((b) => ({ akun: b.akun, debit: b.kredit, kredit: b.debit }));
