/*
 * Layanan pembelian peralatan dan perlengkapan (dipanggil server action src/lib/aksi/konversi/pembelian.ts dan skrip seed): simpan draf dan posting (jurnal, kartu aset, jadwal penyusutan, cek kas pembelian tunai).
 */
import type { Tx } from "@/lib/server/db";
import { GalatAksi } from "@/lib/server/aksi";
import type { PenggunaSesi } from "@/lib/server/auth";
import { AWALAN, kodeBerikutnya, nomorDokumen } from "@/lib/server/nomor";
import { pastikanPeriode, pastikanTerbuka } from "@/lib/server/periode";
import { buatJurnal, mutasiAkunPerPeriode, tahanKunciKas } from "@/lib/server/jurnal";
import { pesanKasKurang, saldoKasTerendah } from "@/lib/inti/modal";
import { catatLog } from "@/lib/server/log";
import { skemaPembelian } from "@/lib/skema/pembelian";
import { AKUN } from "@/lib/inti/akun";
import { barisPembelian } from "@/lib/inti/jurnal";
import { hitungJadwal, nDariDasar } from "@/lib/inti/penyusutan";
import { dariDate, keDate, labelPeriode, periodeDari, tambahBulanTanggal } from "@/lib/inti/tanggal";
import { LABEL_CARA_BAYAR, LABEL_JENIS_PEMBELIAN, LABEL_SUMBER_INVESTASI, namaSupplierAtauSumber } from "@/lib/format";
import type { z } from "zod";

/** Posting membuat banyak baris jadwal (n bulan x jumlah unit), jadi batas waktu transaksi dilonggarkan. */
export const OPSI_TX = { timeout: 20_000, maxWait: 10_000 };

/** Simpan draf baru atau ubah draf. Bila `posting: true`, langsung diposting dalam transaksi yang sama. */
export async function simpanPembelianDalam(tx: Tx, pengguna: PenggunaSesi, d: z.infer<typeof skemaPembelian>) {
  const peralatan = d.jenis === "PERALATAN";
  let lama: { status: string; jenis: string; supplierKode: string | null; detail: { peralatanKode: string | null; perlengkapanKode: string | null }[] } | null = null;
  if (d.no) {
    lama = await tx.pembelian.findUnique({ where: { no: d.no }, select: { status: true, jenis: true, supplierKode: true, detail: { select: { peralatanKode: true, perlengkapanKode: true } } } });
    if (!lama) throw new GalatAksi(`Pembelian ${d.no} tidak ditemukan.`);
    if (lama.status !== "DRAFT") throw new GalatAksi(`${d.no} sudah diposting, jadi tidak bisa diubah.`);
    if (lama.jenis !== d.jenis) throw new GalatAksi("Jenis pembelian tidak boleh diubah.");
  }

  // Master yang dipilih harus ada dan aktif (kecuali memang sudah dipakai di draf ini sebelumnya).
  if (d.supplierKode) {
    const s = await tx.supplier.findUnique({ where: { kode: d.supplierKode }, select: { aktif: true } });
    if (!s) throw new GalatAksi("Supplier tidak ditemukan.", { supplierKode: "Supplier tidak ditemukan." });
    if (!s.aktif && lama?.supplierKode !== d.supplierKode) throw new GalatAksi("Supplier ini sudah dinonaktifkan.", { supplierKode: "Supplier nonaktif." });
  }
  const kodeBarang = [...new Set(d.baris.map((b) => b.barangKode))];
  const sudahDipakai = new Set((lama?.detail ?? []).map((x) => x.peralatanKode ?? x.perlengkapanKode));
  const barang = peralatan
    ? await tx.peralatan.findMany({ where: { kode: { in: kodeBarang } }, select: { kode: true, aktif: true } })
    : await tx.perlengkapan.findMany({ where: { kode: { in: kodeBarang } }, select: { kode: true, aktif: true } });
  for (const [i, b] of d.baris.entries()) {
    const x = barang.find((y) => y.kode === b.barangKode);
    if (!x) throw new GalatAksi(`Baris ${i + 1}: barang tidak ditemukan.`, { [`baris.${i}.barangKode`]: "Barang tidak ditemukan." });
    if (!x.aktif && !sudahDipakai.has(x.kode)) throw new GalatAksi(`Baris ${i + 1}: barang ini sudah dinonaktifkan.`, { [`baris.${i}.barangKode`]: "Barang nonaktif." });
  }

  const total = d.baris.reduce((s, b) => s + b.qty * b.harga, 0);
  const nomor = d.no ?? (await nomorDokumen(tx, peralatan ? AWALAN.PEMBELIAN_PERALATAN : AWALAN.PEMBELIAN_PERLENGKAPAN, d.tanggal));
  const header = {
    tanggal: keDate(d.tanggal),
    supplierKode: d.supplierKode || null,
    caraBayar: d.caraBayar,
    // Sumber hanya bermakna untuk Investasi (CHECK pembelian_sumber_investasi); bawaannya Pemilik.
    sumberInvestasi: d.caraBayar === "INVESTASI" ? (d.sumberInvestasi ?? "PEMILIK") : null,
    jatuhTempo: d.caraBayar === "KREDIT" ? keDate(d.jatuhTempo) : null,
    keterangan: d.keterangan,
    total,
  };
  const detail = d.baris.map((b, i) =>
    peralatan
      ? { noUrut: i + 1, peralatanKode: b.barangKode, qty: b.qty, harga: b.harga, residu: b.residu, garansiBulan: b.garansiBulan, masaManfaatBulan: b.masaManfaatBulan, dasarN: b.dasarN }
      : { noUrut: i + 1, perlengkapanKode: b.barangKode, qty: b.qty, harga: b.harga },
  );
  if (d.no) {
    // Klaim bersyarat: hanya berhasil bila masih DRAFT (mencegah ubah bersamaan dengan posting).
    const n = await tx.pembelian.updateMany({ where: { no: nomor, status: "DRAFT" }, data: header });
    if (n.count !== 1) throw new GalatAksi(`${nomor} baru saja diposting atau dihapus pengguna lain.`);
    await tx.detailPembelian.deleteMany({ where: { pembelianNo: nomor } });
    await tx.detailPembelian.createMany({ data: detail.map((x) => ({ ...x, pembelianNo: nomor })) });
  } else {
    await tx.pembelian.create({ data: { no: nomor, jenis: d.jenis, ...header, status: "DRAFT", dibuatOlehId: pengguna.id, detail: { create: detail } } });
  }
  await catatLog(tx, pengguna.id, d.no ? "pembelian.ubah" : "pembelian.buat", "pembelian", nomor);
  if (d.posting) await postingPembelianDalam(tx, nomor, pengguna);
  return nomor;
}

/**
 * Posting: jurnal umum (langsung DISETUJUI), lalu untuk peralatan satu kartu aset per unit beserta jadwal penyusutannya.
 * Akun aset, akumulasi, dan beban diambil dari kategori aset tiap peralatan.
 */
export async function postingPembelianDalam(tx: Tx, no: string, pengguna: PenggunaSesi) {
  const b = await tx.pembelian.findUnique({
    where: { no },
    include: { supplier: true, detail: { orderBy: { noUrut: "asc" }, include: { peralatan: { include: { kategori: true } } } } },
  });
  if (!b) throw new GalatAksi("Pembelian tidak ditemukan.");
  if (b.status !== "DRAFT") throw new GalatAksi(`${no} sudah diposting.`);
  const tanggal = dariDate(b.tanggal);
  const mulai = periodeDari(tanggal);

  // Klaim status lebih dulu supaya dua posting bersamaan tidak sama-sama lolos.
  const klaim = await tx.pembelian.updateMany({ where: { no, status: "DRAFT" }, data: { status: "DISETUJUI", disetujuiOlehId: pengguna.id, disetujuiPada: new Date() } });
  if (klaim.count !== 1) throw new GalatAksi(`${no} baru saja diposting pengguna lain.`);

  const debit: Record<string, number> = {};
  const rencanaAset: { noUrut: number; jadwal: ReturnType<typeof hitungJadwal>; d: (typeof b.detail)[number] }[] = [];
  for (const d of b.detail) {
    if (b.jenis === "PERALATAN") {
      if (!d.peralatan) throw new GalatAksi(`Baris ${d.noUrut}: peralatan tidak ditemukan.`);
      const n = nDariDasar(d.dasarN ?? "GARANSI", d.garansiBulan ?? 0, d.masaManfaatBulan ?? 0);
      const jadwal = hitungJadwal(d.harga, d.residu ?? 0, n, mulai);
      const akunAset = d.peralatan.kategori.akunAsetKode || AKUN.PERALATAN;
      debit[akunAset] = (debit[akunAset] ?? 0) + d.qty * d.harga;
      rencanaAset.push({ noUrut: d.noUrut, jadwal, d });
    } else {
      debit[AKUN.PERLENGKAPAN] = (debit[AKUN.PERLENGKAPAN] ?? 0) + d.qty * d.harga;
    }
  }

  // Pembelian tunai membayar dari kas: saldo kas akhir periode tanggal pembelian dan semua periode sesudahnya harus cukup,
  // sama seperti penggajian dan fee event. Kas berasal dari setoran modal (Investasi Kas).
  if (b.caraBayar === "TUNAI") {
    await pastikanTerbuka(tx, mulai); // periode tertutup dilaporkan lebih dulu daripada kas kurang
    await tahanKunciKas(tx);
    const total = Object.values(debit).reduce((s, x) => s + x, 0);
    const kas = saldoKasTerendah(await mutasiAkunPerPeriode(tx, AKUN.KAS), mulai);
    if (kas.saldo < total) {
      const titik = kas.periode === mulai ? `akhir ${labelPeriode(mulai)}` : `akhir ${labelPeriode(kas.periode)} (terendah sejak ${labelPeriode(mulai)})`;
      throw new GalatAksi(`${pesanKasKurang(kas.saldo, total, `pembelian tunai ${no}`)} Saldo yang dipakai: ${titik}.`);
    }
  }

  const namaSupplier = namaSupplierAtauSumber(b.supplier?.nama, b.sumberInvestasi);
  const jurnalNo = await buatJurnal(tx, {
    tanggal,
    jenis: "UMUM",
    status: "DISETUJUI",
    keterangan: `Pembelian ${LABEL_JENIS_PEMBELIAN[b.jenis].toLowerCase()} ${no}, ${namaSupplier} (${LABEL_CARA_BAYAR[b.caraBayar]}${b.sumberInvestasi ? `, ${LABEL_SUMBER_INVESTASI[b.sumberInvestasi]}` : ""})`,
    baris: barisPembelian(debit, b.caraBayar, b.sumberInvestasi),
    sumberTipe: "PEMBELIAN",
    sumberId: no,
    dibuatOlehId: pengguna.id,
    disetujuiOlehId: pengguna.id,
  });

  const kodeAset: string[] = [];
  for (const { jadwal, d } of rencanaAset) {
    const alat = d.peralatan!;
    await pastikanPeriode(tx, ...jadwal.baris.map((r) => r.periode));
    for (let u = 0; u < d.qty; u++) {
      const kode = await kodeBerikutnya(tx, AWALAN.ASET, 4);
      kodeAset.push(kode);
      await tx.aset.create({
        data: {
          kode,
          pembelianNo: no,
          noUrut: d.noUrut,
          peralatanKode: alat.kode,
          kategoriKode: alat.kategoriKode,
          nama: alat.nama,
          tglPerolehan: b.tanggal,
          bulanMulai: mulai,
          nilaiPerolehan: d.harga,
          residu: d.residu ?? 0,
          garansiBulan: d.garansiBulan ?? 0,
          garansiSampai: d.garansiBulan ? keDate(tambahBulanTanggal(tanggal, d.garansiBulan)) : null,
          masaManfaatBulan: d.masaManfaatBulan ?? 0,
          dasarN: d.dasarN ?? "GARANSI",
          n: jadwal.baris.length,
          d: jadwal.d,
          terakhir: jadwal.terakhir,
          pengaman: jadwal.pengaman,
          akunAsetKode: alat.kategori.akunAsetKode,
          akunAkumulasiKode: alat.kategori.akunAkumulasiKode,
          akunBebanKode: alat.kategori.akunBebanKode,
          jadwal: { create: jadwal.baris.map((r) => ({ periodeKe: r.periodeKe, periodeId: r.periode, beban: r.beban, akumulasi: r.akumulasi, nilaiBuku: r.nilaiBuku })) },
        },
      });
    }
  }

  await tx.pembelian.update({ where: { no }, data: { jurnalNo } });
  await catatLog(tx, pengguna.id, "pembelian.posting", "pembelian", no, `Jurnal ${jurnalNo}${kodeAset.length ? `, aset ${kodeAset.join(", ")}` : ""}`);
  return { jurnalNo, aset: kodeAset };
}
