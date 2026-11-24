"use server";

/*
 * Server action Pelepasan Peralatan (use case: Ajukan pelepasan peralatan; Setujui atau tolak pelepasan peralatan),
 * untuk peralatan yang dijual, dibuang, atau hilang.
 *   ajukan : Admin; setujui atau tolak : Owner.
 * Nilai buku memakai penyusutan yang sudah DISETUJUI. Pengajuan dan persetujuan ditolak bila jadwal aset belum lengkap
 * (lihat cekJadwalPelepasan: bulan sebelum pelepasan wajib sudah disetujui, bulan sesudahnya tidak boleh sudah dijurnal). Saat disetujui: jurnal umum langsung DISETUJUI, aset DILEPAS,
 * dan baris jadwal yang belum dijurnal dihapus.
 */
import { db } from "@/lib/server/db";
import { aksiAman, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { skemaAjukanPelepasan, skemaNoPelepasan } from "@/lib/skema/konversi";
import { skemaNoDanAlasan } from "@/lib/skema/pembelian";
import { ajukanPelepasanDalam, setujuiPelepasanDalam, tolakPelepasanDalam } from "@/lib/server/pelepasan";

export async function ajukanPelepasan(input: unknown): Promise<HasilAksi<{ no: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["pelepasan.ajukan"]);
    const d = validasi(skemaAjukanPelepasan, input);
    const no = await db.$transaction((tx) => ajukanPelepasanDalam(tx, pengguna, d));
    segarkan();
    return { pesan: `${no} diajukan ke Owner.`, data: { no } };
  });
}

export async function setujuiPelepasan(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["pelepasan.putuskan"]);
    const { no } = validasi(skemaNoPelepasan, input);
    const jurnalNo = await db.$transaction((tx) => setujuiPelepasanDalam(tx, pengguna, no));
    segarkan();
    return { pesan: `${no} disetujui. Jurnal ${jurnalNo} dibuat.` };
  });
}

export async function tolakPelepasan(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["pelepasan.putuskan"]);
    const { no, alasan } = validasi(skemaNoDanAlasan, input);
    await db.$transaction((tx) => tolakPelepasanDalam(tx, pengguna, no, alasan));
    segarkan();
    return { pesan: `${no} ditolak.` };
  });
}
