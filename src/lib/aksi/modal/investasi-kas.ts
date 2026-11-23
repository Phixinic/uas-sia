"use server";

/*
 * Server action Investasi Kas (setoran modal pemilik berupa kas).
 *   catat     : Admin atau Owner, dokumen dibuat DIAJUKAN (periode tanggal setoran harus terbuka);
 *   setujui   : Owner, jurnal umum DISETUJUI Dr Kas 1-110, Kr Modal Pemilik 3-110 bertanggal setoran (periode harus terbuka);
 *   tolak     : Owner, alasan wajib, tanpa jurnal.
 * Owner boleh menyetujui setoran yang ia catat sendiri: setoran ini uang Owner sendiri dan hanya ada satu Owner.
 */
import { db } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { AWALAN, nomorDokumen } from "@/lib/server/nomor";
import { pastikanTerbuka } from "@/lib/server/periode";
import { buatJurnal } from "@/lib/server/jurnal";
import { catatLog } from "@/lib/server/log";
import { barisInvestasiKas } from "@/lib/inti/modal";
import { dariDate, keDate, periodeDari } from "@/lib/inti/tanggal";
import { rupiah } from "@/lib/format";
import { skemaInvestasiKas } from "@/lib/skema/modal";
import { skemaNoDanAlasan, skemaNoDokumen } from "@/lib/skema/pembelian";

export async function catatInvestasiKas(input: unknown): Promise<HasilAksi<{ no: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["investasi-kas.catat"]);
    const d = validasi(skemaInvestasiKas, input);
    const no = await db.$transaction(async (tx) => {
      await pastikanTerbuka(tx, periodeDari(d.tanggal), { tanggal: "Periode tanggal ini sudah tertutup." });
      const nomor = await nomorDokumen(tx, AWALAN.INVESTASI_KAS, d.tanggal);
      await tx.investasiKas.create({
        data: { no: nomor, tanggal: keDate(d.tanggal), jumlah: d.jumlah, keterangan: d.keterangan, status: "DIAJUKAN", dibuatOlehId: pengguna.id },
      });
      await catatLog(tx, pengguna.id, "investasi-kas.catat", "investasi_kas", nomor, `${rupiah(d.jumlah)}, ${d.keterangan}`);
      return nomor;
    });
    segarkan();
    return { pesan: `${no} dicatat dan menunggu keputusan Owner.`, data: { no } };
  });
}

export async function setujuiInvestasiKas(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["investasi-kas.putuskan"]);
    const { no } = validasi(skemaNoDokumen, input);
    const jurnalNo = await db.$transaction(async (tx) => {
      const inv = await tx.investasiKas.findUnique({ where: { no } });
      if (!inv) throw new GalatAksi("Setoran tidak ditemukan.");
      if (inv.status !== "DIAJUKAN") throw new GalatAksi("Setoran ini sudah diputuskan.");
      // Jurnal dibuat dulu karena CHECK tabel mewajibkan setoran DISETUJUI punya jurnal. Klaim status bersyarat
      // sesudahnya tetap mencegah dua persetujuan bersamaan: yang kalah menunggu kunci baris, lalu count = 0,
      // dan transaksinya (termasuk jurnal dan nomornya) dibatalkan.
      const jurnal = await buatJurnal(tx, {
        tanggal: dariDate(inv.tanggal),
        jenis: "UMUM",
        status: "DISETUJUI",
        keterangan: `Setoran modal pemilik ${no}: ${inv.keterangan}`,
        baris: barisInvestasiKas(inv.jumlah),
        sumberTipe: "INVESTASI_KAS",
        sumberId: no,
        dibuatOlehId: inv.dibuatOlehId,
        disetujuiOlehId: pengguna.id,
      });
      const klaim = await tx.investasiKas.updateMany({
        where: { no, status: "DIAJUKAN" },
        data: { status: "DISETUJUI", jurnalNo: jurnal, diputuskanOlehId: pengguna.id, diputuskanPada: new Date() },
      });
      if (klaim.count !== 1) throw new GalatAksi("Setoran ini baru saja diputuskan pengguna lain.");
      await catatLog(tx, pengguna.id, "investasi-kas.setujui", "investasi_kas", no, `Jurnal ${jurnal}`);
      return jurnal;
    });
    segarkan();
    return { pesan: `${no} disetujui. Jurnal ${jurnalNo} dibuat, kas dan modal pemilik bertambah.` };
  });
}

export async function tolakInvestasiKas(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["investasi-kas.putuskan"]);
    const { no, alasan } = validasi(skemaNoDanAlasan, input);
    await db.$transaction(async (tx) => {
      const klaim = await tx.investasiKas.updateMany({
        where: { no, status: "DIAJUKAN" },
        data: { status: "DITOLAK", alasanTolak: alasan, diputuskanOlehId: pengguna.id, diputuskanPada: new Date() },
      });
      if (klaim.count !== 1) throw new GalatAksi("Setoran ini sudah diputuskan atau tidak ditemukan.");
      await catatLog(tx, pengguna.id, "investasi-kas.tolak", "investasi_kas", no, alasan);
    });
    segarkan();
    return { pesan: `${no} ditolak.` };
  });
}
