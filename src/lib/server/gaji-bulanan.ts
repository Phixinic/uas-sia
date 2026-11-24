/*
 * Layanan Gaji Bulanan (dipanggil server action dan skrip seed). Hitung Gaji dan Distribusi digabung:
 *  - HRD mengisi potongan dan bonus manual per karyawan (penyesuaian_gaji), angka dihitung langsung sebagai pratinjau;
 *  - HRD mengajukan satu paket gaji satu bulan: semua slip karyawan yang siap dihitung ulang dari bahan terbaru
 *    (setting dan nominal berlaku, presensi, upah event, potongan, bonus), lalu slip DIAJUKAN dan penggajian DIAJUKAN;
 *  - Owner menyetujui (cek kas, jurnal gaji, slip DISETUJUI = dibayar) atau menolak dengan alasan (slip kembali DRAFT,
 *    HRD memperbaiki lalu mengajukan ulang).
 */
import type { Tx } from "@/lib/server/db";
import { GalatAksi } from "@/lib/server/aksi";
import { AWALAN, nomorDokumen } from "@/lib/server/nomor";
import { pastikanPeriode, pastikanTerbuka } from "@/lib/server/periode";
import { buatJurnal, saldoAkun } from "@/lib/server/jurnal";
import { catatLog } from "@/lib/server/log";
import { simpanSlip } from "@/lib/server/gaji";
import { tahanKunciSetting } from "@/lib/server/setting-gaji";
import { pesanKasKurang } from "@/lib/inti/modal";
import { AKUN } from "@/lib/inti/akun";
import { barisGaji } from "@/lib/inti/jurnal";
import { hitungGaji } from "@/lib/inti/penggajian";
import { hariTerakhir, labelPeriode } from "@/lib/inti/tanggal";
import { rupiah } from "@/lib/format";
import { muatBahanGaji } from "@/lib/data/sdm/gaji";

/** Gaji karyawan di periode ini masih bisa diubah: belum ada slip yang diajukan atau dibayar. */
async function pastikanBisaDiubah(tx: Tx, periode: string, karyawanKode: string) {
  const slip = await tx.slipGaji.findUnique({ where: { periodeId_karyawanKode: { periodeId: periode, karyawanKode } }, select: { status: true } });
  if (slip && slip.status !== "DRAFT") throw new GalatAksi(`Gaji ${labelPeriode(periode)} karyawan ini sudah diajukan atau dibayar, jadi potongan dan bonusnya terkunci.`);
}

export async function simpanPenyesuaianDalam(tx: Tx, penggunaId: number, d: { periode: string; karyawanKode: string; jenis: "POTONGAN" | "BONUS"; nominal: number; keterangan: string }) {
  await pastikanTerbuka(tx, d.periode);
  const k = await tx.karyawan.findUnique({ where: { kode: d.karyawanKode }, select: { jenis: true, aktif: true, nama: true } });
  if (!k || !k.aktif || k.jenis !== "INHOUSE") throw new GalatAksi("Potongan dan bonus hanya untuk karyawan inhouse yang aktif.");
  await pastikanBisaDiubah(tx, d.periode, d.karyawanKode);
  await pastikanPeriode(tx, d.periode);
  const r = await tx.penyesuaianGaji.create({ data: { periodeId: d.periode, karyawanKode: d.karyawanKode, jenis: d.jenis, nominal: d.nominal, keterangan: d.keterangan.trim(), dibuatOlehId: penggunaId } });
  await catatLog(tx, penggunaId, "gaji.penyesuaian-tambah", "penyesuaian_gaji", String(r.id), `${d.karyawanKode} ${d.periode} ${d.jenis} ${d.nominal}: ${d.keterangan}`);
  return { id: r.id, nama: k.nama };
}

export async function hapusPenyesuaianDalam(tx: Tx, penggunaId: number, id: number) {
  const r = await tx.penyesuaianGaji.findUnique({ where: { id } });
  if (!r) throw new GalatAksi("Data potongan atau bonus tidak ditemukan.");
  await pastikanTerbuka(tx, r.periodeId);
  await pastikanBisaDiubah(tx, r.periodeId, r.karyawanKode);
  await tx.penyesuaianGaji.delete({ where: { id } });
  await catatLog(tx, penggunaId, "gaji.penyesuaian-hapus", "penyesuaian_gaji", String(id), `${r.karyawanKode} ${r.periodeId} ${r.jenis} ${r.nominal}: ${r.keterangan}`);
}

/**
 * HRD mengajukan paket gaji satu bulan. Karyawan inhouse yang punya setting berlaku, punya presensi bulan itu, dan belum
 * diajukan atau dibayar ikut paket: slipnya dihitung ulang dari bahan terbaru lalu diajukan bersama. Komponen tanpa
 * nominal berlaku atau THP minus menahan pengajuan.
 */
export async function ajukanGajiBulananDalam(tx: Tx, penggunaId: number, periode: string) {
  await pastikanTerbuka(tx, periode);
  await tahanKunciSetting(tx);
  if (await tx.penggajian.count({ where: { periodeId: periode, status: "DIAJUKAN" } })) throw new GalatAksi(`Gaji ${labelPeriode(periode)} sudah diajukan dan menunggu keputusan Owner.`);
  const [bahan, slip] = await Promise.all([
    muatBahanGaji(tx, periode),
    tx.slipGaji.findMany({ where: { periodeId: periode }, select: { karyawanKode: true, status: true } }),
  ]);
  const beku = new Set(slip.filter((s) => s.status !== "DRAFT").map((s) => s.karyawanKode));
  // Karyawan tanpa presensi bulan ini tidak ikut paket (halaman dan dialog konfirmasi menyebut namanya).
  const ikut = bahan.filter((b) => !beku.has(b.karyawanKode) && b.jumlahPresensi > 0);
  if (!ikut.length) throw new GalatAksi(`Tidak ada gaji ${labelPeriode(periode)} yang bisa diajukan. Pastikan karyawan punya setting gaji berlaku dan presensi bulan itu.`);
  const kurang = ikut.filter((b) => b.kurang.length);
  if (kurang.length) throw new GalatAksi(`Nominal ${kurang.map((b) => `${b.nama} (${b.kurang.join(", ")})`).join("; ")} belum disetujui dan berlaku di ${labelPeriode(periode)}.`);
  const minus = ikut.filter((b) => hitungGaji(b.input).thp < 0);
  if (minus.length) throw new GalatAksi(`Potongan ${minus.map((b) => b.nama).join(", ")} lebih besar dari gaji yang diterima. Kurangi potongannya.`);

  for (const b of ikut) {
    if (!(await simpanSlip(tx, b, periode, penggunaId))) throw new GalatAksi("Slip baru saja diubah pengguna lain. Muat ulang halaman lalu coba lagi.");
  }
  const draf = await tx.slipGaji.findMany({ where: { periodeId: periode, status: "DRAFT", karyawanKode: { in: ikut.map((b) => b.karyawanKode) } }, select: { no: true, bruto: true, pph21: true, thp: true } });
  const no = await nomorDokumen(tx, AWALAN.PENGGAJIAN, hariTerakhir(periode));
  // Klaim slip lebih dulu (bersyarat DRAFT) supaya dua pengajuan bersamaan tidak memakai slip yang sama.
  const klaim = await tx.slipGaji.updateMany({ where: { no: { in: draf.map((s) => s.no) }, status: "DRAFT" }, data: { status: "DIAJUKAN", alasanTolak: null } });
  if (klaim.count !== draf.length || draf.length !== ikut.length) throw new GalatAksi("Slip baru saja diubah pengguna lain. Muat ulang halaman lalu coba lagi.");
  await tx.penggajian.create({
    data: {
      no,
      periodeId: periode,
      jumlahSlip: draf.length,
      totalBruto: draf.reduce((s, x) => s + x.bruto, 0),
      totalPph: draf.reduce((s, x) => s + x.pph21, 0),
      totalThp: draf.reduce((s, x) => s + x.thp, 0),
      status: "DIAJUKAN",
      dibuatOlehId: penggunaId,
    },
  });
  await tx.slipGaji.updateMany({ where: { no: { in: draf.map((s) => s.no) } }, data: { penggajianNo: no } });
  await catatLog(tx, penggunaId, "penggajian.ajukan", "penggajian", no, `${draf.length} slip ${periode}, THP ${draf.reduce((s, x) => s + x.thp, 0)}`);
  return { no, jumlah: draf.length, thp: draf.reduce((s, x) => s + x.thp, 0) };
}

export async function setujuiPenggajianDalam(tx: Tx, penggunaId: number, no: string) {
  const g = await tx.penggajian.findUnique({ where: { no }, select: { periodeId: true, status: true, dibuatOlehId: true } });
  if (!g || g.status !== "DIAJUKAN") throw new GalatAksi("Pengajuan ini sudah diputuskan.");
  // Klaim status bersyarat; bila cek berikutnya gagal, transaksi dibatalkan dan klaim ikut batal.
  const klaim = await tx.penggajian.updateMany({ where: { no, status: "DIAJUKAN" }, data: { status: "DISETUJUI", disetujuiOlehId: penggunaId, disetujuiPada: new Date() } });
  if (klaim.count !== 1) throw new GalatAksi("Pengajuan ini baru saja diputuskan pengguna lain.");

  const slip = await tx.slipGaji.findMany({ where: { penggajianNo: no, status: "DIAJUKAN" }, orderBy: { karyawanKode: "asc" } });
  if (!slip.length) throw new GalatAksi("Slip pengajuan ini tidak ditemukan.");
  const thp = slip.reduce((s, x) => s + x.thp, 0);
  const kas = await saldoAkun(tx, AKUN.KAS);
  if (kas < thp) throw new GalatAksi(pesanKasKurang(kas, thp, "gaji"));

  const jurnal = await buatJurnal(tx, {
    tanggal: hariTerakhir(g.periodeId),
    jenis: "UMUM",
    status: "DISETUJUI",
    keterangan: `Penggajian ${labelPeriode(g.periodeId)} (${slip.length} karyawan), ${no}`,
    baris: barisGaji(slip.map((s) => ({ akunBeban: s.akunBebanKode, bruto: s.bruto, pph21: s.pph21, thp: s.thp, upahEvent: s.upahEvent, bonus: s.bonus, potongan: s.potonganLain }))),
    sumberTipe: "PENGGAJIAN",
    sumberId: no,
    dibuatOlehId: g.dibuatOlehId,
    disetujuiOlehId: penggunaId,
  });
  await tx.slipGaji.updateMany({ where: { no: { in: slip.map((s) => s.no) }, status: "DIAJUKAN" }, data: { status: "DISETUJUI", disetujuiOlehId: penggunaId, disetujuiPada: new Date() } });
  await tx.penggajian.update({ where: { no }, data: { jurnalNo: jurnal } });
  await catatLog(tx, penggunaId, "penggajian.setujui", "penggajian", no, `Jurnal ${jurnal}, THP ${thp}`);
  return { jurnalNo: jurnal, thp, pesan: `${no} disetujui. Jurnal ${jurnal} dibuat dan gaji ${rupiah(thp)} dibayar.` };
}

export async function tolakPenggajianDalam(tx: Tx, penggunaId: number, no: string, alasan: string) {
  const klaim = await tx.penggajian.updateMany({ where: { no, status: "DIAJUKAN" }, data: { status: "DITOLAK", alasanTolak: alasan, disetujuiOlehId: penggunaId, disetujuiPada: new Date() } });
  if (klaim.count !== 1) throw new GalatAksi("Pengajuan ini sudah diputuskan.");
  await tx.slipGaji.updateMany({ where: { penggajianNo: no, status: "DIAJUKAN" }, data: { status: "DRAFT", penggajianNo: null, alasanTolak: alasan } });
  await catatLog(tx, penggunaId, "penggajian.tolak", "penggajian", no, alasan);
}
