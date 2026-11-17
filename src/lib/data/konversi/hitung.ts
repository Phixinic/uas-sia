/*
 * Hitungan murni siklus konversi (tanpa database), supaya mudah diuji.
 */
import { labelPeriode, tambahBulan } from "@/lib/inti/tanggal";

export type PembelianLkp = { perlengkapanKode: string; periode: string; nilai: number };
export type BebanOpname = { perlengkapanKode: string; periode: string; beban: number };

/**
 * Saldo buku tiap perlengkapan pada awal pengisian periode P (sama dengan saldoBukuLkp di app lama):
 * pembelian DISETUJUI sampai periode P dikurangi beban opname yang tidak ditolak di periode sebelum P.
 */
export function saldoBukuPerlengkapan(pembelian: PembelianLkp[], opname: BebanOpname[], periode: string): Record<string, number> {
  const saldo: Record<string, number> = {};
  for (const b of pembelian) if (b.periode <= periode) saldo[b.perlengkapanKode] = (saldo[b.perlengkapanKode] ?? 0) + b.nilai;
  for (const o of opname) if (o.periode < periode) saldo[o.perlengkapanKode] = (saldo[o.perlengkapanKode] ?? 0) - o.beban;
  return saldo;
}

/**
 * Bulan paling awal sebelum `periode` yang masih punya saldo perlengkapan tetapi belum punya nilai sisa yang tidak ditolak.
 * Bulan tanpa saldo tidak perlu dihitung fisik. `sudahAda` = periode yang punya opname tidak ditolak.
 * Dipakai supaya nilai sisa diinput berurutan: bulan yang terlewat tidak bisa diisi lagi sesudah bulan berikutnya,
 * karena biaya bulan berikutnya sudah dihitung dari saldo tanpa biaya bulan itu.
 */
export function bulanNilaiSisaTerlewat(pembelian: PembelianLkp[], opname: BebanOpname[], sudahAda: ReadonlySet<string>, periode: string): string | null {
  let m = pembelian.reduce<string | null>((a, b) => (a === null || b.periode < a ? b.periode : a), null);
  for (; m !== null && m < periode; m = tambahBulan(m, 1)) {
    if (sudahAda.has(m)) continue;
    if (Object.values(saldoBukuPerlengkapan(pembelian, opname, m)).some((v) => v > 0)) return m;
  }
  return null;
}

/**
 * Alasan nilai sisa periode P belum boleh diinput karena urutan bulan, atau null bila boleh.
 * `lain` = opname periode lain yang tidak ditolak. Dipakai server action dan halaman supaya pesannya sama.
 */
export function tahanUrutanNilaiSisa(P: string, lain: { periodeId: string; status: string }[], terlewat: string | null): string | null {
  const sesudah = lain.filter((o) => o.periodeId > P && o.status !== "DITOLAK").map((o) => o.periodeId).sort()[0];
  if (sesudah) {
    return `Nilai sisa ${labelPeriode(sesudah)} sudah diinput, jadi nilai sisa ${labelPeriode(P)} tidak bisa diinput atau diubah lagi. Biaya perlengkapan ${labelPeriode(sesudah)} sudah dihitung dari saldo tanpa biaya ${labelPeriode(P)}, sehingga biayanya akan terhitung dua kali.`;
  }
  const tunda = lain.filter((o) => o.periodeId < P && (o.status === "DRAFT" || o.status === "DIAJUKAN")).map((o) => o.periodeId).sort()[0];
  if (tunda) return `Nilai sisa ${labelPeriode(tunda)} belum disetujui Owner. Selesaikan dulu supaya saldo buku ${labelPeriode(P)} sudah pasti.`;
  if (terlewat) return `Nilai sisa ${labelPeriode(terlewat)} belum diinput. Nilai sisa diisi berurutan per bulan, jadi isi ${labelPeriode(terlewat)} dulu.`;
  return null;
}

export type BarisAset = { periodeKe: number; periode: string; beban: number; jurnalNo: string | null; statusJurnal: string | null };

/** Akumulasi yang diakui = jumlah beban baris jadwal yang jurnalnya DISETUJUI. */
export const akumulasiDisetujui = (jadwal: BarisAset[]) => jadwal.filter((r) => r.jurnalNo && r.statusJurnal === "DISETUJUI").reduce((s, r) => s + r.beban, 0);

/** Baris jadwal yang sudah dijurnal tetapi jurnalnya belum disetujui (menahan pelepasan). */
export const jadwalMenunggu = (jadwal: BarisAset[]) => jadwal.filter((r) => r.jurnalNo && r.statusJurnal !== "DISETUJUI");

/** Keterangan kebijakan baris jadwal pada bulan pelepasan, ditampilkan di form pelepasan. */
export const KEBIJAKAN_BULAN_PELEPASAN =
  "Penyusutan pada bulan pelepasan: bila sudah dijurnal, jurnalnya harus disetujui dulu sebelum pelepasan; bila belum dijurnal, bulan itu tidak disusutkan.";

/**
 * Pemeriksaan jadwal penyusutan aset terhadap tanggal pelepasan (YYYY-MM-DD). Mengembalikan pesan penolakan, atau null bila boleh.
 *  - bulan SEBELUM bulan pelepasan harus sudah dijurnal dan jurnalnya DISETUJUI (kalau tidak, beban penyusutan pindah jadi rugi pelepasan);
 *  - bulan SESUDAH bulan pelepasan tidak boleh sudah dijurnal (pelepasan mundur tanggal);
 *  - bulan pelepasan: baris yang sudah dijurnal harus disetujui dulu, baris yang belum dijurnal dibiarkan (dihapus saat pelepasan disetujui).
 */
export function cekJadwalPelepasan(jadwal: BarisAset[], tanggal: string): string | null {
  const bulan = tanggal.slice(0, 7);
  const urut = (a: string, b: string) => a.localeCompare(b);
  const belum = jadwal.filter((r) => r.periode < bulan && !(r.jurnalNo && r.statusJurnal === "DISETUJUI")).map((r) => r.periode).sort(urut);
  if (belum.length) return `Penyusutan periode ${belum.join(", ")} belum diproses atau jurnalnya belum disetujui. Selesaikan dulu, atau pelepasan akan salah mencatat beban penyusutan sebagai rugi.`;
  const sesudah = jadwal.filter((r) => r.periode > bulan && r.jurnalNo).map((r) => r.periode).sort(urut);
  if (sesudah.length) return `Penyusutan periode ${sesudah.join(", ")} sudah dijurnal, sedangkan tanggal pelepasan ${tanggal} lebih awal. Pakai tanggal pelepasan di bulan itu atau sesudahnya.`;
  const tahan = [...new Set(jadwal.filter((r) => r.periode === bulan && r.jurnalNo && r.statusJurnal !== "DISETUJUI").map((r) => r.jurnalNo!))];
  if (tahan.length) return `Masih ada penyusutan aset ini yang belum disetujui (${tahan.join(", ")}). Tunggu disetujui atau ditolak dulu.`;
  return null;
}
