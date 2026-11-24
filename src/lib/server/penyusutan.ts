/*
 * Layanan Proses Penyusutan (dipanggil server action dan skrip seed). Penyusutan dihitung dari jadwal yang dibuat saat
 * pembelian diposting, jadi tidak ada yang perlu diputuskan: jurnal penyesuaian satu periode langsung DISETUJUI dan
 * masuk buku besar. Urutan periode dan kunci periode tetap berlaku.
 */
import type { Tx } from "@/lib/server/db";
import { GalatAksi } from "@/lib/server/aksi";
import { pastikanTerbuka } from "@/lib/server/periode";
import { buatJurnal } from "@/lib/server/jurnal";
import { catatLog } from "@/lib/server/log";
import { barisPenyusutan } from "@/lib/inti/jurnal";
import { hariTerakhir, labelPeriode, periodeBatasProses } from "@/lib/inti/tanggal";

export async function prosesPenyusutanDalam(tx: Tx, penggunaId: number, P: string, batas: string = periodeBatasProses()): Promise<{ jurnalNo: string; jumlah: number; total: number }> {
  if (P > batas) throw new GalatAksi(`Penyusutan hanya bisa diproses sampai ${labelPeriode(batas)}.`);
  await pastikanTerbuka(tx, P);
  const lebihAwal = await tx.jadwalPenyusutan.findFirst({ where: { periodeId: { lt: P }, jurnalNo: null, aset: { status: "AKTIF" } }, orderBy: { periodeId: "asc" }, select: { periodeId: true } });
  if (lebihAwal) throw new GalatAksi(`Periode ${labelPeriode(lebihAwal.periodeId)} belum diproses. Proses periode paling lama dulu supaya urutan jadwal tetap benar.`);

  const baris = await tx.jadwalPenyusutan.findMany({
    where: { periodeId: P, jurnalNo: null, aset: { status: "AKTIF" } },
    orderBy: { asetKode: "asc" },
    include: { aset: { select: { akunBebanKode: true, akunAkumulasiKode: true } } },
  });
  if (!baris.length) throw new GalatAksi(`Penyusutan ${labelPeriode(P)} sudah diproses atau tidak ada.`);

  const total = baris.reduce((s, r) => s + r.beban, 0);
  const jurnalNo = await buatJurnal(tx, {
    tanggal: hariTerakhir(P),
    jenis: "PENYESUAIAN",
    status: "DISETUJUI",
    keterangan: `Penyusutan peralatan ${labelPeriode(P)}`,
    baris: barisPenyusutan(baris.map((r) => ({ akunBeban: r.aset.akunBebanKode, akunAkumulasi: r.aset.akunAkumulasiKode, beban: r.beban }))),
    sumberTipe: "PENYUSUTAN",
    sumberId: P,
    dibuatOlehId: penggunaId,
    disetujuiOlehId: penggunaId,
  });
  // Klaim bersyarat: hanya baris yang masih kosong jurnalnya, supaya dua proses bersamaan tidak tumpang tindih.
  const klaim = await tx.jadwalPenyusutan.updateMany({ where: { periodeId: P, jurnalNo: null, asetKode: { in: baris.map((r) => r.asetKode) } }, data: { jurnalNo } });
  if (klaim.count !== baris.length) throw new GalatAksi(`Penyusutan ${labelPeriode(P)} baru saja diproses pengguna lain.`);
  await catatLog(tx, penggunaId, "penyusutan.proses", "jurnal", jurnalNo, `${labelPeriode(P)}, ${baris.length} aset, langsung disetujui`);
  return { jurnalNo, jumlah: baris.length, total };
}
