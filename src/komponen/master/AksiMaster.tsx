"use client";

import { Pencil, Power, PowerOff } from "lucide-react";
import { ubahStatusMaster } from "@/lib/aksi/master/master";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { TautanTombol } from "@/komponen/ui/Tombol";
import type { JenisMaster } from "@/lib/skema/master";

/** Ubah (bila izin) dan aktif/nonaktif (Owner) per baris master. Server action tetap memeriksa peran. */
export default function AksiMaster({ jenis, kode, aktif, alamatUbah, bolehUbah, bolehNonaktifkan }: {
  jenis: JenisMaster;
  kode: string;
  aktif: boolean;
  alamatUbah: string;
  bolehUbah: boolean;
  bolehNonaktifkan: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {bolehUbah && <TautanTombol href={alamatUbah} kecil ikon={<Pencil className="size-4" />}>Ubah</TautanTombol>}
      {bolehNonaktifkan && (
        <TombolAksi
          aksi={() => ubahStatusMaster({ jenis, kode, aktif: !aktif })}
          varian={aktif ? "garis" : "utama"}
          ikon={aktif ? <PowerOff className="size-4" /> : <Power className="size-4" />}
          konfirmasi={{
            judul: `${aktif ? "Nonaktifkan" : "Aktifkan"} ${kode}?`,
            pesan: aktif ? "Data tidak dihapus. Transaksi lama tetap terbaca, tetapi data ini tidak bisa dipilih untuk transaksi baru." : "Data bisa dipilih lagi untuk transaksi baru.",
          }}
        >
          {aktif ? "Nonaktifkan" : "Aktifkan"}
        </TombolAksi>
      )}
    </div>
  );
}
