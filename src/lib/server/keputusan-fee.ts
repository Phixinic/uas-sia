/*
 * Keputusan Owner atas laporan kapten (dipanggil server action dan skrip seed).
 *
 * Setujui: fee akhir per orang dikirim Owner (alasan wajib bila berbeda dari usulan). Baris dipisah menurut jenis karyawan:
 *  - crew freelance (EVENT): PPh 21 bukan pegawai, cek saldo kas >= yang dibayar, satu jurnal umum DISETUJUI bertanggal
 *    selesai event (Dr beban fee event, Kr Utang PPh 21, Kr Kas), slip fee per orang;
 *  - karyawan inhouse: tidak dibayar lewat slip fee dan jurnal fee. Barisnya tetap tersimpan di slip_fee (rumus fee sama)
 *    dengan `periode_gaji` = bulan gaji yang membayarnya, PPh 0 dan dibayar = fee akhir, lalu ikut Gaji Bulanan bulan itu
 *    (bruto, PPh 21 pegawai, dan jurnal gaji).
 * Bulan gaji upah event = bulan tanggal keputusan Owner. Bila gaji karyawan itu di bulan tersebut sudah diajukan atau
 * dibayar, atau periodenya tertutup, dipakai bulan berikutnya yang masih terbuka.
 * Tolak: laporan DITOLAK dengan alasan, event kembali ke PENILAIAN supaya kapten menilai ulang dan mengirim lagi.
 */
import type { Tx } from "@/lib/server/db";
import { GalatAksi } from "@/lib/server/aksi";
import { nomorSlipFee } from "@/lib/server/nomor";
import { buatJurnal, saldoAkun } from "@/lib/server/jurnal";
import { kunciPenutupDb, pastikanPeriode } from "@/lib/server/periode";
import { catatLog } from "@/lib/server/log";
import { pesanKasKurang } from "@/lib/inti/modal";
import { AKUN } from "@/lib/inti/akun";
import { barisFeeEvent } from "@/lib/inti/jurnal";
import { pph21BukanPegawai } from "@/lib/inti/fee-event";
import { hariIni, labelPeriode, periodeDari, tambahBulan } from "@/lib/inti/tanggal";
import { kunciEvent, muatBahanEvent } from "@/lib/data/fee-event/bahan";
import { tahanKunciSetting } from "@/lib/server/setting-gaji";

export type InputSetujuiFee = { no: string; fee: { karyawanKode: string; feeAkhir: number; alasan?: string | null }[] };

/** Bulan gaji yang membayar upah event karyawan inhouse yang diputuskan pada `tanggal` (lihat keterangan berkas). */
export async function periodeGajiUpah(tx: Tx, karyawanKode: string, tanggal: string): Promise<string> {
  let P = periodeDari(tanggal);
  // Batas pencarian 10 tahun: gaji bisa sudah dibayar jauh ke depan (data contoh yang rentangnya diperluas).
  for (let i = 0; i < 120; i++, P = tambahBulan(P, 1)) {
    const [slip, paket, penutup] = await Promise.all([
      tx.slipGaji.findUnique({ where: { periodeId_karyawanKode: { periodeId: P, karyawanKode } }, select: { status: true } }),
      tx.penggajian.count({ where: { periodeId: P, status: { in: ["DIAJUKAN", "DISETUJUI"] } } }),
      kunciPenutupDb(tx, P),
    ]);
    if (!penutup && !paket && (!slip || slip.status === "DRAFT")) return P;
  }
  throw new GalatAksi("Tidak ada bulan gaji terbuka untuk membayar upah event ini.");
}

export async function setujuiFeeDalam(tx: Tx, penggunaId: number, d: InputSetujuiFee, tanggalKeputusan: string = hariIni()) {
  const lap = await tx.laporanFee.findUnique({ where: { no: d.no }, select: { eventKode: true, status: true } });
  if (!lap) throw new GalatAksi("Laporan tidak ditemukan.");
  const e = await kunciEvent(tx, lap.eventKode);
  if (lap.status !== "DIAJUKAN" || e.status !== "DIAJUKAN") throw new GalatAksi("Laporan ini sudah diputuskan.");
  const klaim = await tx.laporanFee.updateMany({ where: { no: d.no, status: "DIAJUKAN" }, data: { status: "DISETUJUI", diputuskanOlehId: penggunaId, diputuskanPada: new Date() } });
  if (klaim.count !== 1) throw new GalatAksi("Laporan ini baru saja diputuskan pengguna lain.");

  // Kunci bersama: persetujuan perubahan tarif menunggu sampai fee ini selesai disetujui (atau sebaliknya).
  await tahanKunciSetting(tx);
  const b = await muatBahanEvent(tx, lap.eventKode);
  if (!b || !b.orang.length) throw new GalatAksi("Event ini tidak punya penugasan.");
  if (b.tarifKurang.length) throw new GalatAksi(`Tarif ${b.tarifKurang.join(", ")} belum punya versi yang disetujui dan berlaku di ${labelPeriode(b.periodeTarif)}. Setujui tarifnya dulu di Master SDM, tab Struktur gaji.`);
  const kiriman = new Map(d.fee.map((f) => [f.karyawanKode, f]));
  if (kiriman.size !== d.fee.length || kiriman.size !== b.orang.length || b.orang.some((o) => !kiriman.has(o.karyawanKode))) {
    throw new GalatAksi("Daftar orang di form tidak sama dengan data event. Muat ulang halaman lalu coba lagi.");
  }
  const galatIsian: Record<string, string> = {};
  const slip = await Promise.all(
    b.orang.map(async (o) => {
      const f = kiriman.get(o.karyawanKode)!;
      const i = d.fee.indexOf(f);
      const berubah = f.feeAkhir !== o.usulan.fee;
      if (berubah && !f.alasan) galatIsian[`fee.${i}.alasan`] = "Tulis alasan karena fee berbeda dari usulan.";
      const inhouse = o.jenisKaryawan === "INHOUSE";
      const pajak = inhouse ? { bruto: f.feeAkhir, dpp: 0, pph21: 0, dibayar: f.feeAkhir } : pph21BukanPegawai(f.feeAkhir);
      return { o, alasan: berubah ? f.alasan ?? null : null, pajak, periodeGaji: inhouse ? await periodeGajiUpah(tx, o.karyawanKode, tanggalKeputusan) : null };
    }),
  );
  if (Object.keys(galatIsian).length) throw new GalatAksi("Fee yang diubah dari usulan wajib diberi alasan.", galatIsian);
  const totalFee = slip.reduce((s, x) => s + x.pajak.bruto, 0);
  if (totalFee <= 0) throw new GalatAksi("Total fee akhir Rp0. Tolak laporan bila memang tidak ada yang dibayar.");
  const freelance = slip.filter((x) => !x.periodeGaji);
  const totalPph = freelance.reduce((s, x) => s + x.pajak.pph21, 0);
  const totalDibayar = freelance.reduce((s, x) => s + x.pajak.dibayar, 0);
  if (totalDibayar > 0) {
    const kas = await saldoAkun(tx, AKUN.KAS);
    if (kas < totalDibayar) throw new GalatAksi(pesanKasKurang(kas, totalDibayar, "fee"));
  }

  // Jurnal fee hanya untuk crew freelance yang dibayar lewat slip fee (bruto > 0).
  const dijurnal = freelance.filter((x) => x.pajak.bruto > 0);
  const jurnalNo = dijurnal.length
    ? await buatJurnal(tx, {
        tanggal: e.tanggalSelesai,
        jenis: "UMUM",
        status: "DISETUJUI",
        keterangan: `Fee event ${b.nama} (${dijurnal.length} crew freelance), ${d.no}`,
        baris: barisFeeEvent(dijurnal.map((x) => ({ akunBeban: x.o.akunBebanKode, bruto: x.pajak.bruto, pph21: x.pajak.pph21, dibayar: x.pajak.dibayar }))),
        sumberTipe: "FEE_EVENT",
        sumberId: d.no,
        dibuatOlehId: penggunaId,
        disetujuiOlehId: penggunaId,
      })
    : null;
  await pastikanPeriode(tx, ...slip.filter((x) => x.periodeGaji).map((x) => x.periodeGaji!));
  await tx.slipFee.createMany({
    data: slip.map((x) => ({
      no: nomorSlipFee(b.kode, x.o.karyawanKode),
      laporanNo: d.no,
      eventKode: b.kode,
      karyawanKode: x.o.karyawanKode,
      jabatanKode: x.o.jabatanKode,
      akunBebanKode: x.o.akunBebanKode,
      peranEvent: x.o.peranEvent,
      satuanTarif: x.o.satuanTarif,
      tarif: x.o.usulan.tarif,
      versiTarifKode: x.o.versiTarif?.kode ?? null,
      jumlahSesi: x.o.usulan.jumlahSesi,
      menitTercatat: x.o.usulan.menitTercatat,
      menitDiakui: x.o.usulan.menitDiakui,
      jumlahHari: x.o.usulan.jumlahHari,
      feeUsulan: x.o.usulan.fee,
      feeAkhir: x.pajak.bruto,
      alasanUbah: x.alasan,
      dpp: x.pajak.dpp,
      pph21: x.pajak.pph21,
      dibayar: x.pajak.dibayar,
      periodeGajiId: x.periodeGaji,
    })),
  });
  await tx.laporanFee.update({ where: { no: d.no }, data: { totalFee, totalPph, totalDibayar, jurnalNo } });
  const selesai = await tx.event.updateMany({ where: { kode: b.kode, status: "DIAJUKAN" }, data: { status: "SELESAI", alasanTolak: null } });
  if (selesai.count !== 1) throw new GalatAksi("Status event berubah. Muat ulang halaman lalu coba lagi.");
  const diubah = slip.filter((x) => x.alasan).length;
  const lewatGaji = slip.filter((x) => x.periodeGaji);
  await catatLog(
    tx, penggunaId, "laporan-fee.setujui", "laporan_fee", d.no,
    `Jurnal ${jurnalNo ?? "-"}, fee ${totalFee}, dibayar ${totalDibayar}${diubah ? `, ${diubah} fee diubah` : ""}${lewatGaji.length ? `, ${lewatGaji.map((x) => `${x.o.karyawanKode} lewat gaji ${x.periodeGaji}`).join(", ")}` : ""}`,
  );
  return { jurnalNo, totalDibayar, lewatGaji: lewatGaji.map((x) => ({ nama: x.o.nama, periode: x.periodeGaji!, fee: x.pajak.bruto })) };
}

export async function tolakFeeDalam(tx: Tx, penggunaId: number, no: string, alasan: string) {
  const lap = await tx.laporanFee.findUnique({ where: { no }, select: { eventKode: true } });
  if (!lap) throw new GalatAksi("Laporan tidak ditemukan.");
  await kunciEvent(tx, lap.eventKode);
  const klaim = await tx.laporanFee.updateMany({ where: { no, status: "DIAJUKAN" }, data: { status: "DITOLAK", alasanTolak: alasan, diputuskanOlehId: penggunaId, diputuskanPada: new Date() } });
  if (klaim.count !== 1) throw new GalatAksi("Laporan ini sudah diputuskan.");
  const balik = await tx.event.updateMany({ where: { kode: lap.eventKode, status: "DIAJUKAN" }, data: { status: "PENILAIAN", alasanTolak: alasan } });
  if (balik.count !== 1) throw new GalatAksi("Status event berubah. Muat ulang halaman lalu coba lagi.");
  await catatLog(tx, penggunaId, "laporan-fee.tolak", "laporan_fee", no, alasan);
}
