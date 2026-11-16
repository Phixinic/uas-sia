"use server";

/*
 * Server action Proses Penyusutan. Saat pembelian diposting sistem hanya membuat jadwal; beban tiap bulan
 * baru dijurnal di sini, satu jurnal penyesuaian (DRAFT) per periode, dikelompokkan per pasangan akun.
 */
import { db } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { pastikanTerbuka } from "@/lib/server/periode";
import { ajukanJurnal, buatJurnal } from "@/lib/server/jurnal";
import { catatLog } from "@/lib/server/log";
import { barisPenyusutan } from "@/lib/inti/jurnal";
import { hariTerakhir, labelPeriode, periodeIni } from "@/lib/inti/tanggal";
import { skemaNoJurnal, skemaProsesPenyusutan } from "@/lib/skema/konversi";

export async function prosesPenyusutan(input: unknown): Promise<HasilAksi<{ jurnalNo: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["penyusutan.proses"]);
    const { periode: P } = validasi(skemaProsesPenyusutan, input);
    if (P > periodeIni()) throw new GalatAksi("Periode ini belum berjalan, jadi belum bisa diproses.");

    const hasil = await db.$transaction(async (tx) => {
      await pastikanTerbuka(tx, P);
      const lebihAwal = await tx.jadwalPenyusutan.findFirst({ where: { periodeId: { lt: P }, jurnalNo: null, aset: { status: "AKTIF" } }, orderBy: { periodeId: "asc" }, select: { periodeId: true } });
      if (lebihAwal) throw new GalatAksi(`Periode ${labelPeriode(lebihAwal.periodeId)} belum diproses. Proses periode paling lama dulu supaya urutan jadwal tetap benar.`);

      const baris = await tx.jadwalPenyusutan.findMany({
        where: { periodeId: P, jurnalNo: null, aset: { status: "AKTIF" } },
        orderBy: { asetKode: "asc" },
        include: { aset: { select: { akunBebanKode: true, akunAkumulasiKode: true } } },
      });
      if (!baris.length) throw new GalatAksi(`Penyusutan ${labelPeriode(P)} sudah diproses atau tidak ada.`);

      const jurnalNo = await buatJurnal(tx, {
        tanggal: hariTerakhir(P),
        jenis: "PENYESUAIAN",
        status: "DRAFT",
        keterangan: `Penyusutan peralatan ${labelPeriode(P)}`,
        baris: barisPenyusutan(baris.map((r) => ({ akunBeban: r.aset.akunBebanKode, akunAkumulasi: r.aset.akunAkumulasiKode, beban: r.beban }))),
        sumberTipe: "PENYUSUTAN",
        sumberId: P,
        dibuatOlehId: pengguna.id,
      });
      // Klaim bersyarat: hanya baris yang masih kosong jurnalnya, supaya dua proses bersamaan tidak tumpang tindih.
      const klaim = await tx.jadwalPenyusutan.updateMany({ where: { periodeId: P, jurnalNo: null, asetKode: { in: baris.map((r) => r.asetKode) } }, data: { jurnalNo } });
      if (klaim.count !== baris.length) throw new GalatAksi(`Penyusutan ${labelPeriode(P)} baru saja diproses pengguna lain.`);
      await catatLog(tx, pengguna.id, "penyusutan.proses", "jurnal", jurnalNo, `${labelPeriode(P)}, ${baris.length} aset`);
      return { jurnalNo, jumlah: baris.length };
    });

    segarkan();
    return { pesan: `Jurnal ${hasil.jurnalNo} dibuat sebagai draf untuk ${hasil.jumlah} aset. Ajukan ke Owner supaya masuk buku besar.`, data: { jurnalNo: hasil.jurnalNo } };
  });
}

/**
 * Jalan pintas: Admin mengajukan draf jurnal penyusutan atau opname langsung dari halaman konversi.
 * Memakai layanan bersama ajukanJurnal, sama dengan tombol di halaman Jurnal Penyesuaian.
 */
export async function ajukanJurnalKonversi(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["jurnal-penyesuaian.ajukan"]);
    const { no } = validasi(skemaNoJurnal, input);
    await db.$transaction(async (tx) => {
      const j = await tx.jurnal.findUnique({ where: { no }, select: { sumberTipe: true } });
      if (!j || (j.sumberTipe !== "PENYUSUTAN" && j.sumberTipe !== "OPNAME")) throw new GalatAksi("Jurnal ini bukan jurnal penyusutan atau nilai sisa.");
      const klaim = await tx.jurnal.count({ where: { no, status: "DRAFT" } });
      if (klaim !== 1) throw new GalatAksi(`${no} bukan draf.`);
      await ajukanJurnal(tx, no, pengguna.id);
    });
    segarkan();
    return { pesan: `${no} diajukan ke Owner.` };
  });
}
