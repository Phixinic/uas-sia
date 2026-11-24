/*
 * Layanan Investasi Kas (dipanggil server action src/lib/aksi/modal/investasi-kas.ts dan skrip seed). Aturan di docs/KONTRAK.md.
 */
import type { Tx } from "@/lib/server/db";
import { GalatAksi } from "@/lib/server/aksi";
import type { PenggunaSesi } from "@/lib/server/auth";
import { AWALAN, nomorDokumen } from "@/lib/server/nomor";
import { pastikanTerbuka } from "@/lib/server/periode";
import { buatJurnal } from "@/lib/server/jurnal";
import { catatLog } from "@/lib/server/log";
import { barisInvestasiKas } from "@/lib/inti/modal";
import { dariDate, keDate, periodeDari } from "@/lib/inti/tanggal";
import { rupiah } from "@/lib/format";
import { skemaInvestasiKas } from "@/lib/skema/modal";
import type { z } from "zod";

export async function catatInvestasiKasDalam(tx: Tx, pengguna: PenggunaSesi, d: z.infer<typeof skemaInvestasiKas>) {
  await pastikanTerbuka(tx, periodeDari(d.tanggal), { tanggal: "Periode tanggal ini sudah tertutup." });
  const nomor = await nomorDokumen(tx, AWALAN.INVESTASI_KAS, d.tanggal);
  await tx.investasiKas.create({
    data: { no: nomor, tanggal: keDate(d.tanggal), jumlah: d.jumlah, keterangan: d.keterangan, status: "DIAJUKAN", dibuatOlehId: pengguna.id },
  });
  await catatLog(tx, pengguna.id, "investasi-kas.catat", "investasi_kas", nomor, `${rupiah(d.jumlah)}, ${d.keterangan}`);
  return nomor;
}

export async function setujuiInvestasiKasDalam(tx: Tx, pengguna: PenggunaSesi, no: string) {
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
}

export async function tolakInvestasiKasDalam(tx: Tx, pengguna: PenggunaSesi, no: string, alasan: string) {
  const klaim = await tx.investasiKas.updateMany({
    where: { no, status: "DIAJUKAN" },
    data: { status: "DITOLAK", alasanTolak: alasan, diputuskanOlehId: pengguna.id, diputuskanPada: new Date() },
  });
  if (klaim.count !== 1) throw new GalatAksi("Setoran ini sudah diputuskan atau tidak ditemukan.");
  await catatLog(tx, pengguna.id, "investasi-kas.tolak", "investasi_kas", no, alasan);
}
