/*
 * Urutan tampil daftar berstatus: yang belum disetujui atau belum diproses di atas, sisanya di bawah. Daftar masuk
 * sudah urut menaik dari kueri, dan urutan itu dipertahankan di dalam tiap kelompok.
 */

/** Baris yang memenuhi `belum` dipindah ke atas tanpa mengubah urutan di dalam kelompoknya. Daftar asal tidak diubah. */
export function belumDiAtas<T>(daftar: readonly T[], belum: (x: T) => boolean): T[] {
  return [...daftar.filter((x) => belum(x)), ...daftar.filter((x) => !belum(x))];
}

/** Draf dan diajukan: dokumen yang belum diputuskan. */
export const belumDiputuskan = (status: string) => status === "DRAFT" || status === "DIAJUKAN";

/**
 * Nomor jurnal nilai sisa yang dikembalikan Owner dan belum diajukan ulang: jurnal DITOLAK terakhir di tiap periode
 * yang opnamenya kembali draf tanpa jurnal. `jurnal` hanya berisi jurnal bersumber OPNAME. Jurnal ditolak yang sudah
 * diganti pengajuan baru adalah riwayat dan tidak ikut.
 */
export function jurnalDikembalikan(jurnal: readonly { no: string; periode: string; status: string }[], periodeKembali: ReadonlySet<string>): Set<string> {
  const terakhir = new Map<string, string>();
  for (const j of jurnal) {
    if (j.status === "DITOLAK" && periodeKembali.has(j.periode) && j.no > (terakhir.get(j.periode) ?? "")) terakhir.set(j.periode, j.no);
  }
  return new Set(terakhir.values());
}
