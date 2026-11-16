"use server";

/*
 * Server action pembelian peralatan dan perlengkapan (pola rujukan, lihat docs/KONTRAK.md).
 * Use case: Kelola (CRUD) Pembelian; include Insert transaksi dan Hitung Penyusutan (jadwal dibuat saat posting).
 * Aturan peran (sama dengan app lama):
 *   simpan/ubah/hapus draf : Admin
 *   posting                : Admin atau Owner  (posting = status DISETUJUI, jurnal umum langsung berlaku)
 *   balik                  : Owner             (jurnal pembalik bertanggal hari ini, aset dibatalkan)
 */
import { db, type Tx } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran, type PenggunaSesi } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { AWALAN, kodeBerikutnya, nomorDokumen } from "@/lib/server/nomor";
import { pastikanPeriode } from "@/lib/server/periode";
import { buatJurnal } from "@/lib/server/jurnal";
import { catatLog } from "@/lib/server/log";
import { skemaNoDanAlasan, skemaNoDokumen, skemaPembelian } from "@/lib/skema/pembelian";
import { AKUN } from "@/lib/inti/akun";
import { barisPembalik, barisPembelian } from "@/lib/inti/jurnal";
import { hitungJadwal, nDariDasar } from "@/lib/inti/penyusutan";
import { dariDate, hariIni, keDate, periodeDari, tambahBulanTanggal } from "@/lib/inti/tanggal";
import { LABEL_CARA_BAYAR, LABEL_JENIS_PEMBELIAN } from "@/lib/format";

/** Posting membuat banyak baris jadwal (n bulan x jumlah unit), jadi batas waktu transaksi dilonggarkan. */
const OPSI_TX = { timeout: 20_000, maxWait: 10_000 };

/** Simpan draf baru atau ubah draf. Bila `posting: true`, langsung diposting dalam transaksi yang sama. */
export async function simpanPembelian(input: unknown): Promise<HasilAksi<{ no: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["pembelian.kelola-draf"]);
    const d = validasi(skemaPembelian, input);
    const peralatan = d.jenis === "PERALATAN";

    const no = await db.$transaction(async (tx) => {
      let lama: { status: string; jenis: string; detail: { peralatanKode: string | null; perlengkapanKode: string | null }[] } | null = null;
      if (d.no) {
        lama = await tx.pembelian.findUnique({ where: { no: d.no }, select: { status: true, jenis: true, detail: { select: { peralatanKode: true, perlengkapanKode: true } } } });
        if (!lama) throw new GalatAksi(`Pembelian ${d.no} tidak ditemukan.`);
        if (lama.status !== "DRAFT") throw new GalatAksi(`${d.no} sudah diposting, jadi tidak bisa diubah.`);
        if (lama.jenis !== d.jenis) throw new GalatAksi("Jenis pembelian tidak boleh diubah.");
      }

      // Master yang dipilih harus ada dan aktif (kecuali memang sudah dipakai di draf ini sebelumnya).
      if (d.supplierKode) {
        const s = await tx.supplier.findUnique({ where: { kode: d.supplierKode }, select: { aktif: true } });
        if (!s) throw new GalatAksi("Supplier tidak ditemukan.", { supplierKode: "Supplier tidak ditemukan." });
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
      if (d.posting) await postingDalamTransaksi(tx, nomor, pengguna);
      return nomor;
    }, OPSI_TX);

    segarkan();
    return { pesan: d.posting ? `${no} disimpan dan diposting.` : `Draf ${no} tersimpan.`, data: { no } };
  });
}

export async function hapusPembelian(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["pembelian.kelola-draf"]);
    const { no } = validasi(skemaNoDokumen, input);
    await db.$transaction(async (tx) => {
      const n = await tx.pembelian.deleteMany({ where: { no, status: "DRAFT" } });
      if (n.count !== 1) throw new GalatAksi("Hanya draf yang bisa dihapus.");
      await catatLog(tx, pengguna.id, "pembelian.hapus", "pembelian", no);
    });
    segarkan();
    return { pesan: `Draf ${no} dihapus.` };
  });
}

export async function postingPembelian(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["pembelian.posting"]);
    const { no } = validasi(skemaNoDokumen, input);
    const hasil = await db.$transaction((tx) => postingDalamTransaksi(tx, no, pengguna), OPSI_TX);
    segarkan();
    return { pesan: `${no} diposting. Jurnal ${hasil.jurnalNo} dibuat${hasil.aset.length ? `, ${hasil.aset.length} kartu aset ditambahkan` : ""}.` };
  });
}

/**
 * Posting: jurnal umum (langsung DISETUJUI), lalu untuk peralatan satu kartu aset per unit beserta jadwal penyusutannya.
 * Akun aset, akumulasi, dan beban diambil dari kategori aset tiap peralatan.
 */
async function postingDalamTransaksi(tx: Tx, no: string, pengguna: PenggunaSesi) {
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

  const namaSupplier = b.supplier?.nama ?? "Setoran pemilik";
  const jurnalNo = await buatJurnal(tx, {
    tanggal,
    jenis: "UMUM",
    status: "DISETUJUI",
    keterangan: `Pembelian ${LABEL_JENIS_PEMBELIAN[b.jenis].toLowerCase()} ${no}, ${namaSupplier} (${LABEL_CARA_BAYAR[b.caraBayar]})`,
    baris: barisPembelian(debit, b.caraBayar),
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

/**
 * Balik pembelian yang sudah diposting: jurnal asli tetap ada, dibuat jurnal pembalik bertanggal hari ini.
 * Peralatan: semua kartu asetnya harus masih aktif dan belum punya penyusutan yang dijurnal; kartunya dibatalkan.
 * Perlengkapan: belum ada input nilai sisa di periode pembelian atau sesudahnya.
 */
export async function balikPembelian(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["pembelian.balik"]);
    const { no, alasan } = validasi(skemaNoDanAlasan, input);
    const jurnalNo = await db.$transaction(async (tx) => {
      const b = await tx.pembelian.findUnique({
        where: { no },
        include: { jurnal: { include: { detail: { orderBy: { noUrut: "asc" } } } }, detail: { include: { aset: { include: { jadwal: { where: { jurnalNo: { not: null } }, select: { periodeKe: true } } } } } } },
      });
      if (!b || b.status !== "DISETUJUI") throw new GalatAksi("Hanya pembelian yang sudah diposting yang bisa dibalik.");
      if (!b.jurnal) throw new GalatAksi("Jurnal asli pembelian ini tidak ditemukan.");
      const aset = b.detail.flatMap((d) => d.aset);
      if (b.jenis === "PERALATAN") {
        for (const a of aset) {
          if (a.status !== "AKTIF" || a.jadwal.length) {
            throw new GalatAksi(`${a.kode} sudah punya penyusutan yang dijurnal atau sudah dilepas. Gunakan Pelepasan Peralatan.`);
          }
        }
      } else {
        const opname = await tx.opname.count({ where: { status: { not: "DITOLAK" }, periodeId: { gte: periodeDari(dariDate(b.tanggal)) } } });
        if (opname) throw new GalatAksi("Nilai sisa perlengkapan untuk periode ini atau sesudahnya sudah diinput, jadi pembelian tidak bisa dibalik.");
      }
      const klaim = await tx.pembelian.updateMany({ where: { no, status: "DISETUJUI" }, data: { status: "DIBALIK", alasanBalik: alasan, dibalikOlehId: pengguna.id, dibalikPada: new Date() } });
      if (klaim.count !== 1) throw new GalatAksi(`${no} baru saja dibalik pengguna lain.`);
      const jb = await buatJurnal(tx, {
        tanggal: hariIni(),
        jenis: "PEMBALIK",
        status: "DISETUJUI",
        keterangan: `Pembalik ${b.jurnal.no} (pembelian ${no}): ${alasan}`,
        baris: barisPembalik(b.jurnal.detail.map((x) => ({ akun: x.akunKode, debit: x.debit, kredit: x.kredit }))),
        sumberTipe: "PEMBELIAN",
        sumberId: no,
        pembalikDariNo: b.jurnal.no,
        dibuatOlehId: pengguna.id,
        disetujuiOlehId: pengguna.id,
      });
      if (aset.length) {
        await tx.jadwalPenyusutan.deleteMany({ where: { asetKode: { in: aset.map((a) => a.kode) } } });
        await tx.aset.updateMany({ where: { kode: { in: aset.map((a) => a.kode) } }, data: { status: "BATAL" } });
      }
      await tx.pembelian.update({ where: { no }, data: { jurnalPembalikNo: jb } });
      await catatLog(tx, pengguna.id, "pembelian.balik", "pembelian", no, alasan);
      return jb;
    });
    segarkan();
    return { pesan: `${no} dibalik dengan jurnal ${jurnalNo}.` };
  });
}
