"use server";

/*
 * Server action hitung gaji (use case: Hitung Gaji). Hanya HRD.
 * Rumus ada di src/lib/inti/penggajian.ts (hitungGaji); di sini hanya menyusun masukan, menyimpan hasilnya
 * sebagai slip DRAFT (dan rincian tunjangannya), serta menghapus slip draf.
 * Slip yang sudah diajukan atau dibayar tidak boleh dihitung ulang atau dihapus.
 * Komponen tetap diambil dari versi setting gaji yang berlaku di periode slip (muatBahanGaji), dan id versinya disimpan
 * di slip, jadi slip bulan lama yang dihitung ulang tetap memakai gaji lama walau promosi sesudahnya sudah disetujui.
 * Nominal komponen (gaji pokok, tunjangan jabatan, tunjangan istri/anak, tunjangan lain) juga diambil dari versi nominal
 * yang berlaku di periode slip, dan kode versinya disimpan di slip (id_versi_gaji_pokok, id_versi_jabatan, id_versi
 * tiap tunjangan), jadi kenaikan nominal yang berlaku bulan depan tidak mengubah slip bulan ini walau dihitung ulang.
 */
import { db } from "@/lib/server/db";
import { aksiAman, GalatAksi, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { pastikanTerbuka } from "@/lib/server/periode";
import { catatLog } from "@/lib/server/log";
import { skemaHitungSatu, skemaNoDokumen, skemaPeriode } from "@/lib/skema/sdm";
import { labelPeriode } from "@/lib/inti/tanggal";
import { muatBahanGaji } from "@/lib/data/sdm/gaji";
import { simpanSlip } from "@/lib/server/gaji";
import { tahanKunciSetting } from "@/lib/server/setting-gaji";

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
        // Komponen tanpa nominal berlaku membuat seluruh hitungan dibatalkan dengan pesan yang menyebut komponennya.
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
