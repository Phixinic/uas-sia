"use server";

/*
 * Server action Pelepasan Peralatan (use case: Ajukan pelepasan peralatan; Setujui atau tolak pelepasan peralatan),
 * untuk peralatan yang dijual, dibuang, atau hilang.
 *   ajukan : Admin; setujui atau tolak : Owner.
 * Nilai buku memakai penyusutan yang sudah DISETUJUI. Pengajuan dan persetujuan ditolak bila jadwal aset belum lengkap
 * (lihat cekJadwalPelepasan: bulan sebelum pelepasan wajib sudah disetujui, bulan sesudahnya tidak boleh sudah dijurnal). Saat disetujui: jurnal umum langsung DISETUJUI, aset DILEPAS,
 * dan baris jadwal yang belum dijurnal dihapus.
 */
import { db, type Tx } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { AWALAN, nomorDokumen } from "@/lib/server/nomor";
import { pastikanTerbuka } from "@/lib/server/periode";
import { buatJurnal } from "@/lib/server/jurnal";
import { catatLog } from "@/lib/server/log";
import { barisPelepasan, hitungPelepasan } from "@/lib/inti/jurnal";
import { dariDate, keDate, periodeDari } from "@/lib/inti/tanggal";
import { LABEL_ALASAN_PELEPASAN } from "@/lib/format";
import { skemaAjukanPelepasan, skemaNoPelepasan } from "@/lib/skema/konversi";
import { skemaNoDanAlasan } from "@/lib/skema/pembelian";
import { akumulasiDisetujui, cekJadwalPelepasan } from "@/lib/data/konversi/hitung";

/** Akumulasi yang sudah disetujui dan jadwal penyusutan aset. */
async function posisiAset(tx: Tx, kode: string) {
  const a = await tx.aset.findUnique({ where: { kode }, include: { jadwal: { select: { periodeKe: true, periodeId: true, beban: true, jurnalNo: true, jurnal: { select: { status: true } } } } } });
  if (!a) throw new GalatAksi("Peralatan tidak ditemukan.");
  const jadwal = a.jadwal.map((r) => ({ periodeKe: r.periodeKe, periode: r.periodeId, beban: r.beban, jurnalNo: r.jurnalNo, statusJurnal: r.jurnal?.status ?? null }));
  return { a, jadwal, akumulasi: akumulasiDisetujui(jadwal) };
}

export async function ajukanPelepasan(input: unknown): Promise<HasilAksi<{ no: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["pelepasan.ajukan"]);
    const d = validasi(skemaAjukanPelepasan, input);
    const harga = d.alasan === "DIJUAL" ? Number(d.hargaJual) : 0;

    const no = await db.$transaction(async (tx) => {
      const { a, jadwal, akumulasi } = await posisiAset(tx, d.asetKode);
      if (a.status !== "AKTIF") throw new GalatAksi("Aset ini tidak aktif.", { asetKode: "Aset ini tidak aktif." });
      if (d.tanggal < dariDate(a.tglPerolehan)) throw new GalatAksi("Tanggal pelepasan tidak boleh sebelum tanggal perolehan.", { tanggal: "Tidak boleh sebelum tanggal perolehan." });
      await pastikanTerbuka(tx, periodeDari(d.tanggal), { tanggal: "Periode tanggal ini sudah dikunci." });
      if (await tx.pelepasan.count({ where: { asetKode: a.kode, status: "DIAJUKAN" } })) throw new GalatAksi("Aset ini sudah punya pengajuan yang menunggu keputusan.");
      const tahanAjukan = cekJadwalPelepasan(jadwal, d.tanggal);
      if (tahanAjukan) throw new GalatAksi(tahanAjukan, { tanggal: tahanAjukan });

      const h = hitungPelepasan(a.nilaiPerolehan, akumulasi, harga);
      const nomor = await nomorDokumen(tx, AWALAN.PELEPASAN, d.tanggal);
      await tx.pelepasan.create({
        data: {
          no: nomor,
          asetKode: a.kode,
          tanggal: keDate(d.tanggal),
          alasan: d.alasan,
          hargaJual: harga,
          nilaiPerolehan: a.nilaiPerolehan,
          akumulasi: h.akumulasi,
          nilaiBuku: h.nilaiBuku,
          labaRugi: h.labaRugi,
          status: "DIAJUKAN",
          dibuatOlehId: pengguna.id,
        },
      });
      await catatLog(tx, pengguna.id, "pelepasan.ajukan", "pelepasan", nomor, `${a.kode}, ${LABEL_ALASAN_PELEPASAN[d.alasan]}`);
      return nomor;
    });
    segarkan();
    return { pesan: `${no} diajukan ke Owner.`, data: { no } };
  });
}

export async function setujuiPelepasan(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["pelepasan.putuskan"]);
    const { no } = validasi(skemaNoPelepasan, input);
    const jurnalNo = await db.$transaction(async (tx) => {
      const p = await tx.pelepasan.findUnique({ where: { no } });
      if (!p || p.status !== "DIAJUKAN") throw new GalatAksi("Pengajuan ini sudah diputuskan.");
      // Klaim status lebih dulu supaya dua persetujuan bersamaan tidak sama-sama lolos.
      const klaim = await tx.pelepasan.updateMany({ where: { no, status: "DIAJUKAN" }, data: { status: "DISETUJUI", disetujuiOlehId: pengguna.id, disetujuiPada: new Date() } });
      if (klaim.count !== 1) throw new GalatAksi("Pengajuan ini baru saja diputuskan pengguna lain.");

      const { a, jadwal, akumulasi } = await posisiAset(tx, p.asetKode);
      if (a.status !== "AKTIF") throw new GalatAksi("Aset ini sudah tidak aktif.");
      const tanggal = dariDate(p.tanggal);
      const tahanSetuju = cekJadwalPelepasan(jadwal, tanggal);
      if (tahanSetuju) throw new GalatAksi(tahanSetuju);
      const h = hitungPelepasan(a.nilaiPerolehan, akumulasi, p.hargaJual);

      const jurnalNo = await buatJurnal(tx, {
        tanggal,
        jenis: "UMUM",
        status: "DISETUJUI",
        keterangan: `Pelepasan ${a.kode} ${a.nama} (${LABEL_ALASAN_PELEPASAN[p.alasan].toLowerCase()})`,
        baris: barisPelepasan({ nilaiPerolehan: a.nilaiPerolehan, akumulasi: h.akumulasi, hargaJual: p.hargaJual, akunAset: a.akunAsetKode, akunAkumulasi: a.akunAkumulasiKode }),
        sumberTipe: "PELEPASAN",
        sumberId: no,
        dibuatOlehId: p.dibuatOlehId,
        disetujuiOlehId: pengguna.id,
      });
      const lepas = await tx.aset.updateMany({ where: { kode: a.kode, status: "AKTIF" }, data: { status: "DILEPAS", tanggalLepas: p.tanggal } });
      if (lepas.count !== 1) throw new GalatAksi("Aset ini sudah tidak aktif.");
      await tx.jadwalPenyusutan.deleteMany({ where: { asetKode: a.kode, jurnalNo: null } });
      await tx.pelepasan.update({ where: { no }, data: { jurnalNo, akumulasi: h.akumulasi, nilaiBuku: h.nilaiBuku, labaRugi: h.labaRugi } });
      await catatLog(tx, pengguna.id, "pelepasan.setujui", "pelepasan", no, `Jurnal ${jurnalNo}`);
      return jurnalNo;
    });
    segarkan();
    return { pesan: `${no} disetujui. Jurnal ${jurnalNo} dibuat.` };
  });
}

export async function tolakPelepasan(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["pelepasan.putuskan"]);
    const { no, alasan } = validasi(skemaNoDanAlasan, input);
    await db.$transaction(async (tx) => {
      const klaim = await tx.pelepasan.updateMany({ where: { no, status: "DIAJUKAN" }, data: { status: "DITOLAK", alasanTolak: alasan, disetujuiOlehId: pengguna.id, disetujuiPada: new Date() } });
      if (klaim.count !== 1) throw new GalatAksi("Pengajuan ini sudah diputuskan.");
      await catatLog(tx, pengguna.id, "pelepasan.tolak", "pelepasan", no, alasan);
    });
    segarkan();
    return { pesan: `${no} ditolak.` };
  });
}
