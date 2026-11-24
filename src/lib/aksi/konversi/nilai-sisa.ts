"use server";

/*
 * Server action Nilai Sisa Perlengkapan (use case: Input Nilai Sisa (Saldo Akhir) Perlengkapan).
 * Biaya = saldo buku - nilai sisa hasil hitung fisik. Logikanya di src/lib/server/nilai-sisa.ts (dipakai juga seed):
 * simpan atau ubah draf, lalu ajukan lewat Jurnal Penyesuaian; Owner menyetujui atau mengembalikan untuk revisi.
 * Sesudah disetujui, Admin boleh mengajukan revisi; Owner menyetujui (jurnal lama dibalik, jurnal baru dibuat) atau
 * mengembalikan dengan alasan.
 */
import { db } from "@/lib/server/db";
import { aksiAman, segarkan, validasi, type HasilAksi } from "@/lib/server/aksi";
import { wajibPeran } from "@/lib/server/auth";
import { IZIN } from "@/lib/peran";
import { rupiah } from "@/lib/format";
import { ajukanRevisiDalam, kembalikanRevisiDalam, setujuiRevisiDalam, simpanNilaiSisaDalam } from "@/lib/server/nilai-sisa";
import { skemaKembalikanRevisi, skemaNilaiSisa, skemaNoRevisi, skemaRevisiNilaiSisa } from "@/lib/skema/konversi";

export async function simpanNilaiSisa(input: unknown): Promise<HasilAksi<{ no: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["nilai-sisa.input"]);
    const d = validasi(skemaNilaiSisa, input);
    const hasil = await db.$transaction((tx) => simpanNilaiSisaDalam(tx, pengguna.id, d));
    segarkan();
    return {
      pesan: hasil.jurnalNo ? `Tersimpan. Jurnal ${hasil.jurnalNo} masih draf, ajukan ke Owner bila sudah benar.` : "Tersimpan. Tidak ada biaya perlengkapan bulan ini.",
      data: { no: hasil.no },
    };
  });
}

export async function ajukanRevisiNilaiSisa(input: unknown): Promise<HasilAksi<{ no: string }>> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["nilai-sisa.input"]);
    const d = validasi(skemaRevisiNilaiSisa, input);
    const h = await db.$transaction((tx) => ajukanRevisiDalam(tx, pengguna.id, d));
    segarkan();
    return { pesan: `Revisi ${h.no} diajukan ke Owner (biaya ${rupiah(h.totalLama)} menjadi ${rupiah(h.total)}).`, data: { no: h.no } };
  });
}

export async function setujuiRevisiNilaiSisa(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["jurnal-penyesuaian.putuskan"]);
    const { no } = validasi(skemaNoRevisi, input);
    const h = await db.$transaction((tx) => setujuiRevisiDalam(tx, pengguna.id, no));
    segarkan();
    const jurnal = [h.jurnalPembalikNo && `jurnal lama dibalik lewat ${h.jurnalPembalikNo}`, h.jurnalBaruNo && `jurnal baru ${h.jurnalBaruNo}`].filter(Boolean).join(", ");
    return { pesan: `Revisi ${no} disetujui${jurnal ? `: ${jurnal}` : ""}.` };
  });
}

export async function kembalikanRevisiNilaiSisa(input: unknown): Promise<HasilAksi> {
  return aksiAman(async () => {
    const pengguna = await wajibPeran(IZIN["jurnal-penyesuaian.putuskan"]);
    const { no, alasan } = validasi(skemaKembalikanRevisi, input);
    await db.$transaction((tx) => kembalikanRevisiDalam(tx, pengguna.id, no, alasan));
    segarkan();
    return { pesan: `Revisi ${no} dikembalikan ke Admin.` };
  });
}
