/*
 * Layanan server bersama untuk riwayat setting gaji: kunci, isi versi untuk log, dan bahan pengaman per karyawan.
 *
 * Kunci advisory 7410002 menyerialkan persetujuan setting gaji terhadap penghitungan dan pengajuan slip:
 * persetujuan memegang kunci eksklusif, Hitung Gaji dan pengajuan penggajian memegang kunci bersama sampai transaksinya
 * selesai. Jadi slip tidak bisa dihitung atau diajukan dengan versi lama di tengah persetujuan versi baru.
 */
import type { DbAtauTx, Tx } from "@/lib/server/db";
import type { IsiVersi, SlipRingkas, VersiRingkas } from "@/lib/inti/setting-gaji";

export async function tahanKunciSetting(tx: DbAtauTx, eksklusif = false) {
  if (eksklusif) await tx.$executeRaw`SELECT pg_advisory_xact_lock(7410002)`;
  else await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(7410002)`;
}

/** Mengunci baris karyawan sampai transaksi selesai, supaya dua pengajuan atau keputusan untuk karyawan yang sama berurutan. */
export async function kunciKaryawan(tx: Tx, karyawanKode: string) {
  await tx.$queryRaw`SELECT 1 FROM "karyawan" WHERE "id_karyawan" = ${karyawanKode} FOR UPDATE`;
}

/** Semua versi dan slip gaji satu karyawan (bahan pilihVersiBerlaku dan pengamanBerlaku). */
export async function bahanPengaman(klien: DbAtauTx, karyawanKode: string): Promise<{ versi: VersiRingkas[]; slip: SlipRingkas[] }> {
  // Berurutan (bukan Promise.all) karena biasanya dipanggil di dalam transaksi yang memakai satu koneksi.
  const versi = await klien.settingGaji.findMany({ where: { karyawanKode }, select: { kode: true, status: true, berlakuMulai: true, diputuskanPada: true, aktif: true } });
  const slip = await klien.slipGaji.findMany({ where: { karyawanKode }, select: { no: true, periodeId: true, status: true } });
  return { versi, slip: slip.map((s) => ({ no: s.no, periode: s.periodeId, status: s.status })) };
}

/** Isi lengkap satu versi (nama dan nominal saat ini) untuk ditampilkan dan dicatat di log. */
export async function isiVersi(klien: DbAtauTx, kode: string | null | undefined): Promise<IsiVersi | null> {
  if (!kode) return null;
  const v = await klien.settingGaji.findUnique({
    where: { kode },
    include: { jabatan: true, golongan: true, tunjangan: { include: { tunjangan: true }, orderBy: { tunjanganKode: "asc" } } },
  });
  if (!v) return null;
  return {
    jabatanKode: v.jabatanKode,
    jabatan: v.jabatan.nama,
    golonganKode: v.golonganKode,
    golongan: v.golongan.nama,
    gajiPokok: v.golongan.jumlah,
    tunjJabatan: v.jabatan.tunjJabatan,
    tunjangan: v.tunjangan.map((t) => ({ kode: t.tunjanganKode, nama: t.tunjangan.nama, nominal: t.tunjangan.nominal })),
    berlakuMulai: v.berlakuMulai,
  };
}
