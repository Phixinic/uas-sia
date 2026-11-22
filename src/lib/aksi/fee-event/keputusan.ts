"use server";

/*
 * Keputusan Owner atas laporan kapten (izin fee-event.putuskan).
 *   setujuiFee: Owner mengirim fee akhir per orang (alasan wajib bila berbeda dari usulan sistem). Sistem menghitung
 *               PPh 21 bukan pegawai, cek saldo kas >= total dibayar, membuat satu jurnal umum DISETUJUI
 *               (Dr beban fee event, Kr Utang PPh 21, Kr Kas), slip fee per orang, lalu event SELESAI.
 *               Periode tanggal selesai event harus terbuka (dicek buatJurnal).
 *   tolakFee  : laporan DITOLAK dengan alasan, event kembali ke PENILAIAN supaya kapten menilai ulang dan mengirim lagi.
 */
import { db } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { nomorSlipFee } from "@/lib/server/nomor";
import { buatJurnal, saldoAkun } from "@/lib/server/jurnal";
import { catatLog } from "@/lib/server/log";
import { AKUN } from "@/lib/inti/akun";
import { barisFeeEvent } from "@/lib/inti/jurnal";
import { pph21BukanPegawai } from "@/lib/inti/fee-event";
import { rupiah } from "@/lib/format";
import { kunciEvent, muatBahanEvent } from "@/lib/data/fee-event/bahan";
import { skemaSetujuiFee, skemaTolakFee } from "@/lib/skema/fee-event";

export async function setujuiFee(input: unknown): Promise<HasilAksi<{ jurnalNo: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["fee-event.putuskan"]);
    const d = validasi(skemaSetujuiFee, input);
    const hasil = await db.$transaction(async (tx) => {
      const lap = await tx.laporanFee.findUnique({ where: { no: d.no }, select: { eventKode: true, status: true } });
      if (!lap) throw new GalatAksi("Laporan tidak ditemukan.");
      const e = await kunciEvent(tx, lap.eventKode);
      if (lap.status !== "DIAJUKAN" || e.status !== "DIAJUKAN") throw new GalatAksi("Laporan ini sudah diputuskan.");
      const klaim = await tx.laporanFee.updateMany({ where: { no: d.no, status: "DIAJUKAN" }, data: { status: "DISETUJUI", diputuskanOlehId: pengguna.id, diputuskanPada: new Date() } });
      if (klaim.count !== 1) throw new GalatAksi("Laporan ini baru saja diputuskan pengguna lain.");

      const b = await muatBahanEvent(tx, lap.eventKode);
      if (!b || !b.orang.length) throw new GalatAksi("Event ini tidak punya penugasan.");
      const kiriman = new Map(d.fee.map((f) => [f.karyawanKode, f]));
      if (kiriman.size !== d.fee.length || kiriman.size !== b.orang.length || b.orang.some((o) => !kiriman.has(o.karyawanKode))) {
        throw new GalatAksi("Daftar orang di form tidak sama dengan data event. Muat ulang halaman lalu coba lagi.");
      }
      const galatIsian: Record<string, string> = {};
      const slip = b.orang.map((o) => {
        const f = kiriman.get(o.karyawanKode)!;
        const i = d.fee.indexOf(f);
        const berubah = f.feeAkhir !== o.usulan.fee;
        if (berubah && !f.alasan) galatIsian[`fee.${i}.alasan`] = "Tulis alasan karena fee berbeda dari usulan.";
        return { o, feeAkhir: f.feeAkhir, alasan: berubah ? f.alasan : null, pajak: pph21BukanPegawai(f.feeAkhir) };
      });
      if (Object.keys(galatIsian).length) throw new GalatAksi("Fee yang diubah dari usulan wajib diberi alasan.", galatIsian);
      const totalFee = slip.reduce((s, x) => s + x.pajak.bruto, 0);
      const totalPph = slip.reduce((s, x) => s + x.pajak.pph21, 0);
      const totalDibayar = slip.reduce((s, x) => s + x.pajak.dibayar, 0);
      if (totalFee <= 0) throw new GalatAksi("Total fee akhir Rp0. Tolak laporan bila memang tidak ada yang dibayar.");
      const kas = await saldoAkun(tx, AKUN.KAS);
      if (kas < totalDibayar) throw new GalatAksi(`Saldo kas ${rupiah(kas)} tidak cukup untuk membayar fee ${rupiah(totalDibayar)}.`);

      const jurnalNo = await buatJurnal(tx, {
        tanggal: e.tanggalSelesai,
        jenis: "UMUM",
        status: "DISETUJUI",
        keterangan: `Fee event ${b.nama} (${slip.length} orang), ${d.no}`,
        baris: barisFeeEvent(slip.map((x) => ({ akunBeban: x.o.akunBebanKode, bruto: x.pajak.bruto, pph21: x.pajak.pph21, dibayar: x.pajak.dibayar }))),
        sumberTipe: "FEE_EVENT",
        sumberId: d.no,
        dibuatOlehId: pengguna.id,
        disetujuiOlehId: pengguna.id,
      });
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
        })),
      });
      await tx.laporanFee.update({ where: { no: d.no }, data: { totalFee, totalPph, totalDibayar, jurnalNo } });
      const selesai = await tx.event.updateMany({ where: { kode: b.kode, status: "DIAJUKAN" }, data: { status: "SELESAI", alasanTolak: null } });
      if (selesai.count !== 1) throw new GalatAksi("Status event berubah. Muat ulang halaman lalu coba lagi.");
      const diubah = slip.filter((x) => x.alasan).length;
      await catatLog(tx, pengguna.id, "laporan-fee.setujui", "laporan_fee", d.no, `Jurnal ${jurnalNo}, fee ${totalFee}, dibayar ${totalDibayar}${diubah ? `, ${diubah} fee diubah` : ""}`);
      return { jurnalNo, totalDibayar };
    });
    segarkan();
    return { pesan: `${d.no} disetujui. Jurnal ${hasil.jurnalNo} dibuat dan fee ${rupiah(hasil.totalDibayar)} dibayar.`, data: { jurnalNo: hasil.jurnalNo } };
  });
}

export async function tolakFee(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["fee-event.putuskan"]);
    const { no, alasan } = validasi(skemaTolakFee, input);
    await db.$transaction(async (tx) => {
      const lap = await tx.laporanFee.findUnique({ where: { no }, select: { eventKode: true } });
      if (!lap) throw new GalatAksi("Laporan tidak ditemukan.");
      await kunciEvent(tx, lap.eventKode);
      const klaim = await tx.laporanFee.updateMany({ where: { no, status: "DIAJUKAN" }, data: { status: "DITOLAK", alasanTolak: alasan, diputuskanOlehId: pengguna.id, diputuskanPada: new Date() } });
      if (klaim.count !== 1) throw new GalatAksi("Laporan ini sudah diputuskan.");
      const balik = await tx.event.updateMany({ where: { kode: lap.eventKode, status: "DIAJUKAN" }, data: { status: "PENILAIAN", alasanTolak: alasan } });
      if (balik.count !== 1) throw new GalatAksi("Status event berubah. Muat ulang halaman lalu coba lagi.");
      await catatLog(tx, pengguna.id, "laporan-fee.tolak", "laporan_fee", no, alasan);
    });
    segarkan();
    return { pesan: `${no} ditolak. Laporan kembali ke kapten untuk dinilai ulang.` };
  });
}
