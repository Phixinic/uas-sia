/*
 * Layanan server hitung gaji: menyimpan (atau menghitung ulang) slip draf satu karyawan dari bahan hitung
 * (muatBahanGaji). Dipakai server action Hitung Gaji (src/lib/aksi/sdm/gaji.ts) dan skrip data dummy, supaya isi slip,
 * versi setting dan versi nominal yang disimpan, serta log-nya selalu sama.
 */
import type { Tx } from "@/lib/server/db";
import { GalatAksi } from "@/lib/server/aksi";
import { nomorSlip } from "@/lib/server/nomor";
import { catatLog } from "@/lib/server/log";
import { hitungGaji } from "@/lib/inti/penggajian";
import { labelPeriode } from "@/lib/inti/tanggal";
import type { BahanGaji } from "@/lib/data/sdm/gaji";

/** Simpan (atau hitung ulang) slip draf satu karyawan. Mengembalikan false bila slipnya sudah beku (diajukan/dibayar). */
export async function simpanSlip(tx: Tx, b: BahanGaji, periode: string, penggunaId: number): Promise<boolean> {
  if (!b.jumlahPresensi) throw new GalatAksi(`${b.nama} belum punya presensi di ${labelPeriode(periode)}.`);
  if (b.kurang.length) throw new GalatAksi(`Slip ${b.nama} belum bisa dihitung: ${b.kurang.join(", ")} belum punya nominal yang disetujui dan berlaku di ${labelPeriode(periode)}.`);
  const h = hitungGaji(b.input);
  const no = nomorSlip(periode, b.karyawanKode);
  const data = {
    jabatanKode: h.jabatanKode,
    golonganKode: h.golonganKode,
    jadwalKode: h.jadwalKode,
    akunBebanKode: h.akunBebanKode,
    statusPtkp: h.statusPtkp,
    hariKerja: h.hariKerja,
    jumlahPresensi: h.rekap.jumlah,
    hadir: h.rekap.hadir,
    izin: h.rekap.izin,
    sakit: h.rekap.sakit,
    cuti: h.rekap.cuti,
    alpa: h.rekap.alpa,
    jamKerja: h.rekap.jamKerja,
    terlambatMenit: h.rekap.terlambatMenit,
    gajiPokok: h.gajiPokok,
    tunjJabatan: h.tunjJabatan,
    tunjKeluarga: h.tunjKeluarga,
    tunjLain: h.totalTunjLain,
    potonganAbsen: h.potonganAbsen,
    bruto: h.bruto,
    brutoSetahun: h.brutoSetahun,
    biayaJabatan: h.biayaJabatan,
    netoSetahun: h.netoSetahun,
    ptkp: h.ptkp,
    pkp: h.pkp,
    pphSetahun: h.pphSetahun,
    pph21: h.pph21,
    thp: h.thp,
    alasanTolak: null,
    settingKode: b.settingKode,
    versiGajiPokokKode: b.versiGajiPokok?.kode ?? null,
    versiJabatanKode: b.versiJabatan?.kode ?? null,
    dibuatOlehId: penggunaId,
    dihitungPada: new Date(),
  };
  const lama = await tx.slipGaji.findUnique({ where: { no }, select: { status: true } });
  if (lama && lama.status !== "DRAFT") return false;
  if (lama) {
    // Klaim bersyarat: hanya berhasil bila slip masih DRAFT (pengajuan bersamaan tidak ikut tertimpa).
    const n = await tx.slipGaji.updateMany({ where: { no, status: "DRAFT" }, data });
    if (n.count !== 1) return false;
    await tx.slipTunjangan.deleteMany({ where: { slipNo: no } });
  } else {
    await tx.slipGaji.create({ data: { no, periodeId: periode, karyawanKode: b.karyawanKode, status: "DRAFT", ...data } });
  }
  if (h.tunjLain.length) {
    const versiTunj = new Map(b.versiTunjangan.map((t) => [t.kode, t.versi?.kode ?? null]));
    await tx.slipTunjangan.createMany({ data: h.tunjLain.map((t) => ({ slipNo: no, tunjanganKode: t.kode, nama: t.nama, nominal: t.nominal, versiKode: versiTunj.get(t.kode) ?? null })) });
  }
  const versi = [b.versiGajiPokok?.kode, b.versiJabatan?.kode, ...b.versiTunjangan.map((t) => t.versi?.kode)].filter(Boolean).join(", ");
  await catatLog(tx, penggunaId, lama ? "slip.hitung-ulang" : "slip.hitung", "slip", no, `bruto ${h.bruto}, PPh 21 ${h.pph21}, THP ${h.thp}, setting ${b.settingKode}, nominal ${versi}`);
  return true;
}

