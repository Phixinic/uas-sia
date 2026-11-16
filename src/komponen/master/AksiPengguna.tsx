"use client";

import { KeyRound, Pencil, Power, PowerOff } from "lucide-react";
import { ubahStatusPengguna } from "@/lib/aksi/pengguna/pengguna";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { TautanTombol } from "@/komponen/ui/Tombol";

export default function AksiPengguna({ id, aktif, dirinyaSendiri, namaPengguna }: { id: number; aktif: boolean; dirinyaSendiri: boolean; namaPengguna: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <TautanTombol href={`/pengguna?ubah=${id}`} kecil ikon={<Pencil className="size-4" />}>Ubah</TautanTombol>
      <TautanTombol href={`/pengguna?sandi=${id}`} kecil ikon={<KeyRound className="size-4" />}>Ganti sandi</TautanTombol>
      {!dirinyaSendiri && (
        <TombolAksi
          aksi={() => ubahStatusPengguna({ id, aktif: !aktif })}
          varian={aktif ? "garis" : "utama"}
          ikon={aktif ? <PowerOff className="size-4" /> : <Power className="size-4" />}
          konfirmasi={{
            judul: `${aktif ? "Nonaktifkan" : "Aktifkan"} ${namaPengguna}?`,
            pesan: aktif ? "Semua sesi login pengguna ini langsung diputus dan dia tidak bisa masuk lagi sampai diaktifkan." : "Pengguna bisa masuk lagi dengan kata sandinya.",
          }}
        >
          {aktif ? "Nonaktifkan" : "Aktifkan"}
        </TombolAksi>
      )}
    </div>
  );
}
