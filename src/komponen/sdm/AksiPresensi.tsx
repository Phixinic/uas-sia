"use client";

import { Pencil, Trash2 } from "lucide-react";
import { hapusPresensi } from "@/lib/aksi/sdm/presensi";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { TautanTombol } from "@/komponen/ui/Tombol";
import { labelTanggal } from "@/lib/format";

/** Ubah dan hapus satu presensi (hanya dipakai HRD, dan hanya bila belum terkunci oleh slip). */
export default function AksiPresensi({ id, ubahHref, nama, tanggal }: { id: number; ubahHref: string; nama: string; tanggal: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <TautanTombol href={ubahHref} kecil ikon={<Pencil className="size-4" />}>
        Ubah
      </TautanTombol>
      <TombolAksi
        aksi={() => hapusPresensi({ id })}
        varian="bahaya"
        ikon={<Trash2 className="size-4" />}
        konfirmasi={{ judul: `Hapus presensi ${nama}?`, pesan: `Presensi tanggal ${labelTanggal(tanggal)} dihapus dan tidak bisa dikembalikan.` }}
      >
        Hapus
      </TombolAksi>
    </div>
  );
}
