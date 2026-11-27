/*
 * Layanan server bersama riwayat nominal master: memuat versi, bahan pengaman per item, dan data item untuk log.
 *
 * Persetujuan nominal memegang kunci advisory 7410002 secara eksklusif (kunci yang sama dengan persetujuan setting gaji,
 * lihat src/lib/server/setting-gaji.ts). Hitung Gaji, pengajuan penggajian, kiriman laporan kapten, dan persetujuan fee
 * memegang kunci bersama, jadi slip dan laporan tidak bisa dibuat dengan nominal lama di tengah persetujuan versi baru.
 */
import type { DbAtauTx, Tx } from "@/lib/server/db";
import {
  buatPetaNominal, keteranganLogNominal, LABEL_JENIS_NOMINAL, nominalSama, pengamanNominal,
  type DokumenBeku, type IsiNominal, type JenisNominal, type PetaNominal, type VersiNominalRingkas,
} from "@/lib/inti/nominal";
import { dariDate, labelPeriode } from "@/lib/inti/tanggal";
import { pilihVersiBerlaku } from "@/lib/inti/setting-gaji";
import { GalatAksi } from "@/lib/server/aksi";
import { AWALAN, kodeBerikutnya } from "@/lib/server/nomor";
import { pastikanTerbuka } from "@/lib/server/periode";
import { catatLog } from "@/lib/server/log";
import { tahanKunciSetting } from "@/lib/server/setting-gaji";

const pilihVersi = {
  kode: true, jenis: true, golonganKode: true, tunjanganKode: true, jabatanKode: true, nominal: true, tunjJabatan: true, tunjKeluarga: true,
  status: true, berlakuMulai: true, diputuskanPada: true,
} as const;

type BarisVersi = { kode: string; jenis: JenisNominal; golonganKode: string | null; tunjanganKode: string | null; jabatanKode: string | null; nominal: number; tunjJabatan: number; tunjKeluarga: number; status: VersiNominalRingkas["status"]; berlakuMulai: string; diputuskanPada: Date | null };

export const keRingkas = (v: BarisVersi): VersiNominalRingkas => ({
  kode: v.kode,
  jenis: v.jenis,
  itemKode: (v.golonganKode ?? v.tunjanganKode ?? v.jabatanKode)!,
  nominal: v.nominal,
  tunjJabatan: v.tunjJabatan,
  tunjKeluarga: v.tunjKeluarga,
  status: v.status,
  berlakuMulai: v.berlakuMulai,
  diputuskanPada: v.diputuskanPada,
});

/** Semua versi nominal DISETUJUI sebagai peta per item (tabelnya kecil: beberapa versi per item master). */
export async function muatPetaNominal(klien: DbAtauTx): Promise<PetaNominal> {
  const versi = await klien.versiNominal.findMany({ where: { status: "DISETUJUI" }, select: pilihVersi });
  return buatPetaNominal(versi.map(keRingkas));
}

/** Semua versi (semua status) satu item, untuk pengaman pengajuan kembar dan log. */
export async function versiItem(klien: DbAtauTx, jenis: JenisNominal, itemKode: string): Promise<VersiNominalRingkas[]> {
  const kolom = jenis === "GOLONGAN" ? "golonganKode" : jenis === "TUNJANGAN" ? "tunjanganKode" : "jabatanKode";
  const versi = await klien.versiNominal.findMany({ where: { jenis, [kolom]: itemKode }, select: pilihVersi, orderBy: [{ berlakuMulai: "asc" }, { diajukanPada: "asc" }] });
  return versi.map(keRingkas);
}

/** Mengunci baris item master sampai transaksi selesai, supaya dua pengajuan atau keputusan untuk item yang sama berurutan. */
export async function kunciItemNominal(tx: Tx, jenis: JenisNominal, itemKode: string) {
  if (jenis === "GOLONGAN") await tx.$queryRaw`SELECT 1 FROM "golongan" WHERE "id_golongan" = ${itemKode} FOR UPDATE`;
  else if (jenis === "TUNJANGAN") await tx.$queryRaw`SELECT 1 FROM "tunjangan" WHERE "id_tunjangan" = ${itemKode} FOR UPDATE`;
  else await tx.$queryRaw`SELECT 1 FROM "jabatan" WHERE "id_jabatan" = ${itemKode} FOR UPDATE`;
}

/** Data item master: nama, aktif, dan untuk jabatan kelompok serta satuan tarifnya. null bila tidak ada. */
export async function dataItemNominal(klien: DbAtauTx, jenis: JenisNominal, itemKode: string) {
  if (jenis === "GOLONGAN") {
    const g = await klien.golongan.findUnique({ where: { kode: itemKode }, select: { nama: true, aktif: true } });
    return g ? { ...g, cocok: true, satuanTarif: null } : null;
  }
  if (jenis === "TUNJANGAN") {
    const t = await klien.tunjangan.findUnique({ where: { kode: itemKode }, select: { nama: true, aktif: true } });
    return t ? { ...t, cocok: true, satuanTarif: null } : null;
  }
  const j = await klien.jabatan.findUnique({ where: { kode: itemKode }, select: { nama: true, aktif: true, kelompok: true, satuanTarif: true } });
  if (!j) return null;
  return { nama: j.nama, aktif: j.aktif, cocok: (jenis === "JABATAN") === (j.kelompok === "INHOUSE"), satuanTarif: j.satuanTarif };
}

/**
 * Dokumen terkunci yang memakai item (bahan pengamanNominal):
 * - golongan dan jabatan inhouse: slip gaji DIAJUKAN atau DISETUJUI dengan golongan atau jabatan itu;
 * - tunjangan: slip gaji DIAJUKAN atau DISETUJUI yang memuat tunjangan itu;
 * - tarif jabatan event: laporan fee DIAJUKAN atau DISETUJUI untuk event yang memakai jabatan itu (periode = bulan tanggal
 *   selesai event, sama dengan bulan tarif yang dipakai fee event).
 */
export async function dokumenBeku(klien: DbAtauTx, jenis: JenisNominal, itemKode: string): Promise<DokumenBeku[]> {
  const beku = { in: ["DIAJUKAN", "DISETUJUI"] as ("DIAJUKAN" | "DISETUJUI")[] };
  if (jenis === "JABATAN_EVENT") {
    const lap = await klien.laporanFee.findMany({
      where: { status: beku, event: { OR: [{ penugasan: { some: { jabatanKode: itemKode } } }, { slipFee: { some: { jabatanKode: itemKode } } }] } },
      select: { no: true, status: true, event: { select: { tanggalSelesai: true } } },
    });
    return lap.map((l) => ({ no: l.no, periode: dariDate(l.event.tanggalSelesai).slice(0, 7), status: l.status, jenisDokumen: "LAPORAN_FEE" as const }));
  }
  const where =
    jenis === "GOLONGAN" ? { golonganKode: itemKode } : jenis === "JABATAN" ? { jabatanKode: itemKode } : { tunjangan: { some: { tunjanganKode: itemKode } } };
  const slip = await klien.slipGaji.findMany({ where: { status: beku, ...where }, select: { no: true, periodeId: true, status: true } });
  return slip.map((s) => ({ no: s.no, periode: s.periodeId, status: s.status, jenisDokumen: "SLIP" as const }));
}

/** Slip draf (atau event yang belum dikirim kapten) di bulan berlaku atau sesudahnya yang memakai item: akan ikut nominal baru. */
export async function drafTerdampak(klien: DbAtauTx, jenis: JenisNominal, itemKode: string, berlaku: string): Promise<string[]> {
  if (jenis === "JABATAN_EVENT") {
    const ev = await klien.event.findMany({ where: { status: "PENILAIAN", penugasan: { some: { jabatanKode: itemKode } } }, select: { kode: true, tanggalSelesai: true }, orderBy: { kode: "asc" } });
    return ev.filter((e) => dariDate(e.tanggalSelesai).slice(0, 7) >= berlaku).map((e) => e.kode);
  }
  const where =
    jenis === "GOLONGAN" ? { golonganKode: itemKode } : jenis === "JABATAN" ? { jabatanKode: itemKode } : { tunjangan: { some: { tunjanganKode: itemKode } } };
  const slip = await klien.slipGaji.findMany({ where: { status: "DRAFT", periodeId: { gte: berlaku }, ...where }, select: { no: true }, orderBy: { no: "asc" } });
  return slip.map((s) => s.no);
}

// ====================================================================== Alur ajukan, setujui, tolak
// Dipakai server action (src/lib/aksi/master/nominal.ts), simpanMaster (nominal awal data baru), dan skrip data dummy,
// supaya urutan cek, klaim status, dan log selalu sama.

const GALAT_BULAN = (pesan: string) => ({ bulan: pesan, tahun: pesan });
const kolomItem = (jenis: JenisNominal) => (jenis === "GOLONGAN" ? "golonganKode" : jenis === "TUNJANGAN" ? "tunjanganKode" : "jabatanKode");
const isiDari = (jenis: JenisNominal, d: IsiNominal): IsiNominal =>
  jenis === "JABATAN" ? { nominal: 0, tunjJabatan: d.tunjJabatan, tunjKeluarga: d.tunjKeluarga } : { nominal: d.nominal, tunjJabatan: 0, tunjKeluarga: 0 };

export type InputNominal = IsiNominal & { jenis: JenisNominal; itemKode: string; berlaku: string; alasan: string };

/** Item harus ada, jenisnya cocok (jabatan inhouse lawan jabatan event), dan aktif. Mengembalikan nama dan satuan tarif. */
async function pastikanItem(tx: Tx, jenis: JenisNominal, itemKode: string) {
  const item = await dataItemNominal(tx, jenis, itemKode);
  if (!item) throw new GalatAksi("Data master tidak ditemukan.", { itemKode: "Data master tidak ditemukan." });
  if (!item.cocok) throw new GalatAksi(jenis === "JABATAN_EVENT" ? "Jabatan ini jabatan inhouse, bukan jabatan event." : "Jabatan ini jabatan event. Tarifnya diubah lewat bagian Jabatan event.", { itemKode: "Jenis jabatan tidak cocok." });
  if (!item.aktif) throw new GalatAksi(`${item.nama} sudah dinonaktifkan, jadi nominalnya tidak bisa diubah.`, { itemKode: "Data nonaktif." });
  return item;
}

/**
 * Ajukan versi nominal baru (status DIAJUKAN). Pengaman: periode berlaku terbuka, item aktif, tidak ada pengajuan lain untuk
 * item dan bulan yang sama, tidak mengenai slip atau laporan fee yang sudah dikunci, dan nilainya berbeda dari versi
 * yang berlaku di bulan itu. Izin dicek pemanggil.
 */
export async function ajukanNominalDalam(tx: Tx, penggunaId: number, d: InputNominal): Promise<{ kode: string; nama: string; draf: string[] }> {
  await pastikanTerbuka(tx, d.berlaku, GALAT_BULAN("Periode ini sudah tertutup."));
  await kunciItemNominal(tx, d.jenis, d.itemKode);
  const item = await pastikanItem(tx, d.jenis, d.itemKode);
  const versi = await versiItem(tx, d.jenis, d.itemKode);
  if (versi.some((v) => v.status === "DIAJUKAN" && v.berlakuMulai === d.berlaku)) {
    throw new GalatAksi(`Sudah ada pengajuan ${LABEL_JENIS_NOMINAL[d.jenis].toLowerCase()} ${item.nama} berlaku ${labelPeriode(d.berlaku)} yang menunggu Owner. Tunggu keputusannya dulu.`, GALAT_BULAN("Sudah ada pengajuan di bulan ini."));
  }
  const p = pengamanNominal(d.berlaku, await dokumenBeku(tx, d.jenis, d.itemKode));
  if (p.galat) throw new GalatAksi(p.galat, GALAT_BULAN(p.galat));
  const isi = isiDari(d.jenis, d);
  const lama = pilihVersiBerlaku(versi, d.berlaku);
  if (lama && nominalSama(d.jenis, lama, isi)) {
    throw new GalatAksi(`Nominal sama dengan versi ${lama.kode} yang berlaku di ${labelPeriode(d.berlaku)}. Tidak ada yang berubah.`, d.jenis === "JABATAN" ? { tunjJabatan: "Belum ada perubahan." } : { nominal: "Belum ada perubahan." });
  }
  const kode = await kodeBerikutnya(tx, AWALAN.VERSI_NOMINAL, 4);
  await tx.versiNominal.create({
    data: { kode, jenis: d.jenis, [kolomItem(d.jenis)]: d.itemKode, ...isi, berlakuMulai: d.berlaku, alasan: d.alasan, status: "DIAJUKAN", diajukanOlehId: penggunaId },
  });
  const draf = await drafTerdampak(tx, d.jenis, d.itemKode, d.berlaku);
  const catatan = [`Alasan: ${d.alasan}.`, draf.length ? `Bila disetujui, ${d.jenis === "JABATAN_EVENT" ? "usulan fee event" : "slip draf"} ${draf.join(", ")} ikut nominal baru${d.jenis === "JABATAN_EVENT" ? "" : " dan perlu dihitung ulang"}.` : ""].join(" ").trim();
  await catatLog(tx, penggunaId, "nominal.ajukan", "nominal", kode, keteranganLogNominal(d.jenis, d.itemKode, item.nama, lama, { ...isi, kode, berlakuMulai: d.berlaku }, catatan, item.satuanTarif));
  return { kode, nama: item.nama, draf };
}

/** Setujui pengajuan nominal (Owner). Semua pengaman dicek ulang karena slip atau laporan bisa terkunci sejak diajukan. */
export async function setujuiNominalDalam(tx: Tx, penggunaId: number, kode: string) {
  const v = await tx.versiNominal.findUnique({ where: { kode } });
  if (!v) throw new GalatAksi(`Pengajuan ${kode} tidak ditemukan.`);
  if (v.status !== "DIAJUKAN") throw new GalatAksi(`Pengajuan ${kode} sudah diputuskan.`);
  const itemKode = (v.golonganKode ?? v.tunjanganKode ?? v.jabatanKode)!;
  await pastikanTerbuka(tx, v.berlakuMulai);
  // Kunci eksklusif: Hitung Gaji, pengajuan penggajian, kiriman laporan kapten, dan persetujuan fee menunggu keputusan ini.
  await tahanKunciSetting(tx, true);
  await kunciItemNominal(tx, v.jenis, itemKode);
  const item = await pastikanItem(tx, v.jenis, itemKode);
  const p = pengamanNominal(v.berlakuMulai, await dokumenBeku(tx, v.jenis, itemKode));
  if (p.galat) throw new GalatAksi(`${p.galat} Tolak pengajuan ini, lalu ajukan ulang dengan bulan berlaku yang benar.`);
  const lama = pilihVersiBerlaku(await versiItem(tx, v.jenis, itemKode), v.berlakuMulai);
  const klaim = await tx.versiNominal.updateMany({ where: { kode, status: "DIAJUKAN" }, data: { status: "DISETUJUI", diputuskanOlehId: penggunaId, diputuskanPada: new Date() } });
  if (klaim.count !== 1) throw new GalatAksi(`Pengajuan ${kode} baru saja diputuskan pengguna lain.`);
  const draf = await drafTerdampak(tx, v.jenis, itemKode, v.berlakuMulai);
  const catatan = draf.length
    ? v.jenis === "JABATAN_EVENT" ? `Usulan fee event ${draf.join(", ")} ikut tarif baru.` : `Slip draf ${draf.join(", ")} perlu dihitung ulang.`
    : v.jenis === "JABATAN_EVENT" ? "Tidak ada event penilaian yang terdampak." : "Tidak ada slip draf yang terdampak.";
  await catatLog(tx, penggunaId, "nominal.setujui", "nominal", kode, keteranganLogNominal(v.jenis, itemKode, item.nama, lama, v, catatan, item.satuanTarif));
  return { nama: item.nama, jenis: v.jenis, berlaku: v.berlakuMulai, draf };
}

/** Tolak pengajuan nominal (Owner, alasan wajib). */
export async function tolakNominalDalam(tx: Tx, penggunaId: number, kode: string, alasan: string) {
  const v = await tx.versiNominal.findUnique({ where: { kode } });
  if (!v) throw new GalatAksi(`Pengajuan ${kode} tidak ditemukan.`);
  const itemKode = (v.golonganKode ?? v.tunjanganKode ?? v.jabatanKode)!;
  await kunciItemNominal(tx, v.jenis, itemKode);
  const item = await dataItemNominal(tx, v.jenis, itemKode);
  const lama = pilihVersiBerlaku(await versiItem(tx, v.jenis, itemKode), v.berlakuMulai);
  const klaim = await tx.versiNominal.updateMany({ where: { kode, status: "DIAJUKAN" }, data: { status: "DITOLAK", alasanTolak: alasan, diputuskanOlehId: penggunaId, diputuskanPada: new Date() } });
  if (klaim.count !== 1) throw new GalatAksi(`Pengajuan ${kode} sudah diputuskan.`);
  await catatLog(tx, penggunaId, "nominal.tolak", "nominal", kode, keteranganLogNominal(v.jenis, itemKode, item?.nama ?? itemKode, lama, v, `Alasan tolak: ${alasan}.`, item?.satuanTarif));
  return { nama: item?.nama ?? itemKode, jenis: v.jenis };
}

/**
 * Khusus seed (database baru): versi nominal awal langsung DISETUJUI, sama dengan hasil migrasi untuk data lama.
 * Aplikasi dan skrip data dummy memakai ajukanNominalDalam lalu setujuiNominalDalam.
 * Pengaju dan pemutus dipisah karena pengajuan dibuat HRD dan diputuskan Owner.
 */
export async function versiAwalSeed(
  klien: DbAtauTx,
  d: IsiNominal & { jenis: JenisNominal; itemKode: string; berlaku: string; alasan: string; pengajuId?: number | null; pemutusId?: number | null; pada?: Date },
): Promise<string> {
  const kode = await kodeBerikutnya(klien, AWALAN.VERSI_NOMINAL, 4);
  const pada = d.pada ?? new Date();
  await klien.versiNominal.create({
    data: {
      kode, jenis: d.jenis, [kolomItem(d.jenis)]: d.itemKode, ...isiDari(d.jenis, d), berlakuMulai: d.berlaku, alasan: d.alasan,
      status: "DISETUJUI", diajukanOlehId: d.pengajuId ?? null, diajukanPada: pada, diputuskanOlehId: d.pemutusId ?? null, diputuskanPada: pada,
    },
  });
  return kode;
}
