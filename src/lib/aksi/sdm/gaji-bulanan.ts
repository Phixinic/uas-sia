"use server";

/*
 * Server action Gaji Bulanan (Hitung Gaji dan Distribusi digabung). Logikanya di src/lib/server/gaji-bulanan.ts.
 *   HRD   : tambah dan hapus potongan atau bonus manual, ajukan paket gaji satu bulan.
 *   Owner : setujui (jurnal gaji, gaji dibayar) atau tolak dengan alasan.
 */
import { db } from "@/lib/server/db";
import { aksiAman, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { rupiah } from "@/lib/format";
import { ajukanGajiBulananDalam, hapusPenyesuaianDalam, setujuiPenggajianDalam, simpanPenyesuaianDalam, tolakPenggajianDalam } from "@/lib/server/gaji-bulanan";
import { skemaIdPenyesuaian, skemaNoDanAlasan, skemaNoDokumen, skemaPenyesuaianGaji, skemaPeriode } from "@/lib/skema/sdm";

export async function simpanPenyesuaianGaji(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["gaji.hitung"]);
    const d = validasi(skemaPenyesuaianGaji, input);
    const h = await db.$transaction((tx) => simpanPenyesuaianDalam(tx, pengguna.id, d));
    segarkan();
    return { pesan: `${d.jenis === "BONUS" ? "Bonus" : "Potongan"} ${rupiah(d.nominal)} untuk ${h.nama} tersimpan.` };
  });
}

export async function hapusPenyesuaianGaji(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["gaji.hitung"]);
    const { id } = validasi(skemaIdPenyesuaian, input);
    await db.$transaction((tx) => hapusPenyesuaianDalam(tx, pengguna.id, id));
    segarkan();
    return { pesan: "Baris dihapus." };
  });
}

export async function ajukanGajiBulanan(input: unknown): Promise<HasilAksi<{ no: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["penggajian.ajukan"]);
    const { periode } = validasi(skemaPeriode, input);
    const h = await db.$transaction((tx) => ajukanGajiBulananDalam(tx, pengguna.id, periode));
    segarkan();
    return { pesan: `${h.no} diajukan ke Owner (${h.jumlah} karyawan, THP ${rupiah(h.thp)}).`, data: { no: h.no } };
  });
}

export async function setujuiPenggajian(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["penggajian.putuskan"]);
    const { no } = validasi(skemaNoDokumen, input);
    const h = await db.$transaction((tx) => setujuiPenggajianDalam(tx, pengguna.id, no));
    segarkan();
    return { pesan: h.pesan };
  });
}

export async function tolakPenggajian(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["penggajian.putuskan"]);
    const { no, alasan } = validasi(skemaNoDanAlasan, input);
    await db.$transaction((tx) => tolakPenggajianDalam(tx, pengguna.id, no, alasan));
    segarkan();
    return { pesan: `${no} ditolak. HRD memperbaiki lalu mengajukan ulang.` };
  });
}
