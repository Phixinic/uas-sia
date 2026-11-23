"use server";

/*
 * Server action hitung gaji (use case: Hitung Gaji). Hanya HRD.
 * Rumus ada di src/lib/inti/penggajian.ts (hitungGaji); di sini hanya menyusun masukan, menyimpan hasilnya
 * sebagai slip DRAFT (dan rincian tunjangannya), serta menghapus slip draf.
 * Slip yang sudah diajukan atau dibayar tidak boleh dihitung ulang atau dihapus.
 * Komponen tetap diambil dari versi setting gaji yang berlaku di periode slip (muatBahanGaji), dan id versinya disimpan
 * di slip, jadi slip bulan lama yang dihitung ulang tetap memakai gaji lama walau promosi sesudahnya sudah disetujui.
 */
import { db, type Tx } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { nomorSlip } from "@/lib/server/nomor";
import { pastikanTerbuka } from "@/lib/server/periode";
import { catatLog } from "@/lib/server/log";
import { skemaHitungSatu, skemaNoDokumen, skemaPeriode } from "@/lib/skema/sdm";
import { hitungGaji } from "@/lib/inti/penggajian";
import { labelPeriode } from "@/lib/inti/tanggal";
import { muatBahanGaji, type BahanGaji } from "@/lib/data/sdm/gaji";
import { tahanKunciSetting } from "@/lib/server/setting-gaji";

/** Simpan (atau hitung ulang) slip draf satu karyawan. Mengembalikan false bila slipnya sudah beku (diajukan/dibayar). */
async function simpanSlip(tx: Tx, b: BahanGaji, periode: string, penggunaId: number): Promise<boolean> {
  if (!b.jumlahPresensi) throw new GalatAksi(`${b.nama} belum punya presensi di ${labelPeriode(periode)}.`);
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
    await tx.slipTunjangan.createMany({ data: h.tunjLain.map((t) => ({ slipNo: no, tunjanganKode: t.kode, nama: t.nama, nominal: t.nominal })) });
  }
  await catatLog(tx, penggunaId, lama ? "slip.hitung-ulang" : "slip.hitung", "slip", no, `bruto ${h.bruto}, PPh 21 ${h.pph21}, THP ${h.thp}, setting ${b.settingKode}`);
  return true;
}

export async function hitungSlipSatu(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["gaji.hitung"]);
    const { periode, karyawanKode } = validasi(skemaHitungSatu, input);
    const nama = await db.$transaction(async (tx) => {
      await pastikanTerbuka(tx, periode);
      await tahanKunciSetting(tx);
      const [b] = await muatBahanGaji(tx, periode, karyawanKode);
      if (!b) throw new GalatAksi(`Karyawan ini belum punya setting gaji yang disetujui dan berlaku di ${labelPeriode(periode)}.`);
      if (!(await simpanSlip(tx, b, periode, pengguna.id))) throw new GalatAksi(`Slip ${b.nama} sudah diajukan atau dibayar, jadi tidak bisa dihitung ulang.`);
      return b.nama;
    });
    segarkan();
    return { pesan: `Slip ${nama} disimpan sebagai draf.` };
  });
}

export async function hitungSlipSemua(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["gaji.hitung"]);
    const { periode } = validasi(skemaPeriode, input);
    const n = await db.$transaction(async (tx) => {
      await pastikanTerbuka(tx, periode);
      await tahanKunciSetting(tx);
      let jumlah = 0;
      for (const b of await muatBahanGaji(tx, periode)) {
        if (!b.jumlahPresensi) continue;
        if (await simpanSlip(tx, b, periode, pengguna.id)) jumlah++;
      }
      return jumlah;
    });
    if (!n) throw new GalatAksi(`Tidak ada slip yang bisa dihitung di ${labelPeriode(periode)}. Pastikan presensi sudah diinput dan slipnya belum diajukan.`);
    segarkan();
    return { pesan: `${n} slip gaji ${labelPeriode(periode)} disimpan sebagai draf.` };
  });
}

export async function hapusSlip(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["gaji.hitung"]);
    const { no } = validasi(skemaNoDokumen, input);
    await db.$transaction(async (tx) => {
      const n = await tx.slipGaji.deleteMany({ where: { no, status: "DRAFT" } });
      if (n.count !== 1) throw new GalatAksi("Hanya slip draf yang bisa dihapus.");
      await catatLog(tx, pengguna.id, "slip.hapus", "slip", no);
    });
    segarkan();
    return { pesan: `Slip ${no} dihapus.` };
  });
}
