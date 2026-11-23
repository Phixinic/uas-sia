"use server";

/*
 * Server action distribusi gaji (use case: Distribusi Beban Gaji).
 *   ajukan : HRD mengajukan semua slip DRAFT satu periode sekaligus -> penggajian DIAJUKAN, slip DIAJUKAN.
 *   setujui: Owner menyetujui -> cek saldo kas >= total THP, jurnal umum (Dr biaya gaji, Kr Utang PPh 21 dan Kas),
 *            penggajian dan slip DISETUJUI (tampil "Dibayar").
 *   tolak  : Owner menolak dengan alasan -> slip kembali DRAFT dan bisa diajukan ulang.
 */
import { db } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { AWALAN, nomorDokumen } from "@/lib/server/nomor";
import { pastikanTerbuka } from "@/lib/server/periode";
import { buatJurnal, saldoAkun } from "@/lib/server/jurnal";
import { pesanKasKurang } from "@/lib/inti/modal";
import { catatLog } from "@/lib/server/log";
import { skemaNoDanAlasan, skemaNoDokumen, skemaPeriode } from "@/lib/skema/sdm";
import { AKUN } from "@/lib/inti/akun";
import { barisGaji } from "@/lib/inti/jurnal";
import { hariTerakhir, labelPeriode } from "@/lib/inti/tanggal";
import { tahanKunciSetting } from "@/lib/server/setting-gaji";
import { muatBahanGaji, pilihSidik, sidikBahan, sidikSlip } from "@/lib/data/sdm/gaji";

export async function ajukanPenggajian(input: unknown): Promise<HasilAksi<{ no: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["penggajian.ajukan"]);
    const { periode } = validasi(skemaPeriode, input);
    const hasil = await db.$transaction(async (tx) => {
      await pastikanTerbuka(tx, periode);
      await tahanKunciSetting(tx);
      const draf = await tx.slipGaji.findMany({ where: { periodeId: periode, status: "DRAFT" }, select: { no: true, karyawanKode: true, bruto: true, pph21: true, thp: true, ...pilihSidik } });
      if (!draf.length) throw new GalatAksi(`Tidak ada slip draf di ${labelPeriode(periode)}. Hitung gaji dulu di menu Hitung Gaji.`);
      // Slip draf yang dihitung dengan versi setting atau versi nominal komponen yang sekarang sudah tidak berlaku (misalnya
      // promosi atau kenaikan gaji pokok baru disetujui) harus dihitung ulang dulu, supaya gaji yang diajukan dan dibayar
      // sesuai setting dan nominal yang berlaku di bulan itu.
      const bahan = new Map((await muatBahanGaji(tx, periode)).map((b) => [b.karyawanKode, b]));
      const usang = draf.filter((s) => {
        const b = bahan.get(s.karyawanKode);
        return s.settingKode === null || !b || s.settingKode !== b.settingKode || sidikSlip(s) !== sidikBahan(b);
      });
      if (usang.length) {
        throw new GalatAksi(`Setting gaji atau nominal komponen ${usang.map((s) => s.no).join(", ")} sudah berubah sejak slipnya dihitung. Hitung ulang slip itu di menu Hitung Gaji, lalu ajukan lagi.`);
      }
      const no = await nomorDokumen(tx, AWALAN.PENGGAJIAN, hariTerakhir(periode));
      // Klaim slip lebih dulu (bersyarat DRAFT) supaya dua pengajuan bersamaan tidak memakai slip yang sama.
      const klaim = await tx.slipGaji.updateMany({ where: { no: { in: draf.map((s) => s.no) }, status: "DRAFT" }, data: { status: "DIAJUKAN", penggajianNo: null, alasanTolak: null } });
      if (klaim.count !== draf.length) throw new GalatAksi("Slip draf baru saja diubah pengguna lain. Muat ulang halaman lalu coba lagi.");
      await tx.penggajian.create({
        data: {
          no,
          periodeId: periode,
          jumlahSlip: draf.length,
          totalBruto: draf.reduce((s, x) => s + x.bruto, 0),
          totalPph: draf.reduce((s, x) => s + x.pph21, 0),
          totalThp: draf.reduce((s, x) => s + x.thp, 0),
          status: "DIAJUKAN",
          dibuatOlehId: pengguna.id,
        },
      });
      await tx.slipGaji.updateMany({ where: { no: { in: draf.map((s) => s.no) } }, data: { penggajianNo: no } });
      await catatLog(tx, pengguna.id, "penggajian.ajukan", "penggajian", no, `${draf.length} slip ${periode}`);
      return { no, jumlah: draf.length };
    });
    segarkan();
    return { pesan: `${hasil.no} diajukan ke Owner (${hasil.jumlah} slip).`, data: { no: hasil.no } };
  });
}

export async function setujuiPenggajian(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["penggajian.putuskan"]);
    const { no } = validasi(skemaNoDokumen, input);
    const jurnalNo = await db.$transaction(async (tx) => {
      const g = await tx.penggajian.findUnique({ where: { no }, select: { periodeId: true, status: true, dibuatOlehId: true } });
      if (!g || g.status !== "DIAJUKAN") throw new GalatAksi("Pengajuan ini sudah diputuskan.");
      // Klaim status bersyarat; bila cek berikutnya gagal, transaksi dibatalkan dan klaim ikut batal.
      const klaim = await tx.penggajian.updateMany({ where: { no, status: "DIAJUKAN" }, data: { status: "DISETUJUI", disetujuiOlehId: pengguna.id, disetujuiPada: new Date() } });
      if (klaim.count !== 1) throw new GalatAksi("Pengajuan ini baru saja diputuskan pengguna lain.");

      const slip = await tx.slipGaji.findMany({ where: { penggajianNo: no, status: "DIAJUKAN" }, orderBy: { karyawanKode: "asc" }, include: { karyawan: { select: { nama: true } } } });
      if (!slip.length) throw new GalatAksi("Slip pengajuan ini tidak ditemukan.");
      const thp = slip.reduce((s, x) => s + x.thp, 0);
      const kas = await saldoAkun(tx, AKUN.KAS);
      if (kas < thp) throw new GalatAksi(pesanKasKurang(kas, thp, "gaji"));

      const jurnal = await buatJurnal(tx, {
        tanggal: hariTerakhir(g.periodeId),
        jenis: "UMUM",
        status: "DISETUJUI",
        keterangan: `Penggajian ${labelPeriode(g.periodeId)} (${slip.length} karyawan), ${no}`,
        baris: barisGaji(slip.map((s) => ({ akunBeban: s.akunBebanKode, bruto: s.bruto, pph21: s.pph21, thp: s.thp }))),
        sumberTipe: "PENGGAJIAN",
        sumberId: no,
        dibuatOlehId: g.dibuatOlehId,
        disetujuiOlehId: pengguna.id,
      });
      await tx.slipGaji.updateMany({ where: { no: { in: slip.map((s) => s.no) }, status: "DIAJUKAN" }, data: { status: "DISETUJUI", disetujuiOlehId: pengguna.id, disetujuiPada: new Date() } });
      await tx.penggajian.update({ where: { no }, data: { jurnalNo: jurnal } });
      await catatLog(tx, pengguna.id, "penggajian.setujui", "penggajian", no, `Jurnal ${jurnal}, THP ${thp}`);
      return jurnal;
    });
    segarkan();
    return { pesan: `${no} disetujui. Jurnal ${jurnalNo} dibuat dan gaji dibayar.` };
  });
}

export async function tolakPenggajian(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["penggajian.putuskan"]);
    const { no, alasan } = validasi(skemaNoDanAlasan, input);
    await db.$transaction(async (tx) => {
      const klaim = await tx.penggajian.updateMany({ where: { no, status: "DIAJUKAN" }, data: { status: "DITOLAK", alasanTolak: alasan, disetujuiOlehId: pengguna.id, disetujuiPada: new Date() } });
      if (klaim.count !== 1) throw new GalatAksi("Pengajuan ini sudah diputuskan.");
      await tx.slipGaji.updateMany({ where: { penggajianNo: no, status: "DIAJUKAN" }, data: { status: "DRAFT", penggajianNo: null, alasanTolak: alasan } });
      await catatLog(tx, pengguna.id, "penggajian.tolak", "penggajian", no, alasan);
    });
    segarkan();
    return { pesan: `${no} ditolak. Slip kembali menjadi draf.` };
  });
}
