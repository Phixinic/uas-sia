"use server";

/*
 * Server action Nilai Sisa Perlengkapan (use case: Input Nilai Sisa (Saldo Akhir) Perlengkapan).
 * Biaya = saldo buku - nilai sisa hasil hitung fisik. Jurnal penyesuaian dibuat DRAFT, lalu Admin mengajukan ke Owner.
 * Satu opname per periode: input ulang sesudah ditolak memperbarui baris OPN-YYYY-MM yang sama.
 * Diinput berurutan per bulan: bulan sebelumnya harus sudah disetujui (atau tidak bersaldo), dan bulan yang sudah
 * dilewati bulan berikutnya tidak bisa diinput atau diubah lagi, supaya biaya tidak terhitung dua kali.
 */
import { db } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { nomorOpname } from "@/lib/server/nomor";
import { pastikanTerbuka } from "@/lib/server/periode";
import { buatJurnal, saldoAkun } from "@/lib/server/jurnal";
import { catatLog } from "@/lib/server/log";
import { barisOpname } from "@/lib/inti/jurnal";
import { AKUN } from "@/lib/inti/akun";
import { hariTerakhir, labelPeriode, periodeBatasProses } from "@/lib/inti/tanggal";
import { rupiah } from "@/lib/format";
import { skemaNilaiSisa } from "@/lib/skema/konversi";
import { bahanNilaiSisa } from "@/lib/data/konversi/nilai-sisa";
import { tahanUrutanNilaiSisa } from "@/lib/data/konversi/hitung";

export async function simpanNilaiSisa(input: unknown): Promise<HasilAksi<{ no: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["nilai-sisa.input"]);
    const d = validasi(skemaNilaiSisa, input);
    const P = d.periode;
    if (P > periodeBatasProses()) throw new GalatAksi(`Nilai sisa hanya bisa diinput sampai ${labelPeriode(periodeBatasProses())}.`);
    const no = nomorOpname(P);

    const hasil = await db.$transaction(async (tx) => {
      await pastikanTerbuka(tx, P);
      // Satu input nilai sisa sekaligus, supaya cek urutan di bawah tidak disalip input bulan lain yang berjalan bersamaan.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7410002)`;
      const lama = await tx.opname.findUnique({ where: { periodeId: P }, select: { status: true } });
      if (lama && lama.status !== "DITOLAK") throw new GalatAksi(`Nilai sisa ${labelPeriode(P)} sudah diinput.`);

      // Urutan: saldo buku P dihitung dari biaya opname bulan-bulan sebelumnya, jadi bulan sesudah P belum boleh
      // punya nilai sisa (biaya akan terhitung dua kali) dan bulan sebelum P harus sudah final.
      const [lain, { saldo, terlewat }] = await Promise.all([
        tx.opname.findMany({ where: { periodeId: { not: P }, status: { not: "DITOLAK" } }, select: { periodeId: true, status: true } }),
        bahanNilaiSisa(tx, P),
      ]);
      const tahan = tahanUrutanNilaiSisa(P, lain, terlewat);
      if (tahan) throw new GalatAksi(tahan);
      if (!saldo.length) throw new GalatAksi("Tidak ada perlengkapan untuk dihitung.");
      const nilai = new Map(d.nilai.map((x) => [x.perlengkapanKode, x.nilaiSisa]));
      const galatIsian: Record<string, string> = {};
      const baris = saldo.map((s) => {
        const v = nilai.get(s.kode);
        if (v === undefined) galatIsian[s.kode] = "Belum dihitung.";
        else if (v > s.saldoBuku) galatIsian[s.kode] = `Nilai sisa harus 0 sampai ${rupiah(s.saldoBuku)}.`;
        return { kode: s.kode, nama: s.nama, saldoBuku: s.saldoBuku, nilaiSisa: v ?? 0 };
      });
      const salah = Object.keys(galatIsian);
      if (salah.length) {
        const pertama = baris.find((b) => b.kode === salah[0])!;
        throw new GalatAksi(`${pertama.nama}: ${galatIsian[salah[0]].toLowerCase()}`, Object.fromEntries(salah.map((k) => [`nilai.${k}`, galatIsian[k]])));
      }
      const total = baris.reduce((s, b) => s + (b.saldoBuku - b.nilaiSisa), 0);
      // Penjaga: biaya tidak boleh melebihi saldo akun Perlengkapan di buku besar sampai akhir P (saldo tidak boleh minus).
      const saldoAkunLkp = await saldoAkun(tx, AKUN.PERLENGKAPAN, P);
      if (total > saldoAkunLkp) {
        throw new GalatAksi(`Biaya perlengkapan ${rupiah(total)} melebihi saldo akun Perlengkapan sampai ${labelPeriode(P)} (${rupiah(saldoAkunLkp)}), jadi saldonya akan minus. Periksa lagi nilai sisa dan jurnal yang mengurangi akun Perlengkapan.`);
      }

      let jurnalNo: string | null = null;
      if (total > 0) {
        jurnalNo = await buatJurnal(tx, {
          tanggal: hariTerakhir(P),
          jenis: "PENYESUAIAN",
          status: "DRAFT",
          keterangan: `Biaya perlengkapan ${labelPeriode(P)} (dari input nilai sisa)`,
          baris: barisOpname(total),
          sumberTipe: "OPNAME",
          sumberId: no,
          dibuatOlehId: pengguna.id,
        });
      }
      // Total biaya 0: tidak ada jurnal, jadi opname langsung berlaku.
      const sekarang = new Date();
      const data = {
        totalBeban: total,
        status: total > 0 ? ("DRAFT" as const) : ("DISETUJUI" as const),
        alasanTolak: null,
        jurnalNo,
        dibuatOlehId: pengguna.id,
        dibuatPada: sekarang,
        disetujuiOlehId: total > 0 ? null : pengguna.id,
        disetujuiPada: total > 0 ? null : sekarang,
      };
      const detail = baris.map((b) => ({ perlengkapanKode: b.kode, saldoBuku: b.saldoBuku, nilaiSisa: b.nilaiSisa }));
      if (lama) {
        // Klaim bersyarat: hanya baris yang masih DITOLAK yang boleh diinput ulang.
        const klaim = await tx.opname.updateMany({ where: { no, status: "DITOLAK" }, data });
        if (klaim.count !== 1) throw new GalatAksi(`Nilai sisa ${labelPeriode(P)} baru saja diinput pengguna lain.`);
        await tx.detailOpname.deleteMany({ where: { opnameNo: no } });
        await tx.detailOpname.createMany({ data: detail.map((x) => ({ ...x, opnameNo: no })) });
      } else {
        await tx.opname.create({ data: { no, periodeId: P, ...data, detail: { create: detail } } });
      }
      await catatLog(tx, pengguna.id, lama ? "opname.input-ulang" : "opname.input", "opname", no, jurnalNo ? `Jurnal ${jurnalNo}, biaya ${total}` : "Tanpa biaya");
      return { jurnalNo, total };
    });

    segarkan();
    return {
      pesan: hasil.jurnalNo ? `Tersimpan. Jurnal ${hasil.jurnalNo} dibuat sebagai draf.` : "Tersimpan. Tidak ada biaya perlengkapan bulan ini.",
      data: { no },
    };
  });
}
