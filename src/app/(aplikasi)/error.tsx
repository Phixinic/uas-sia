"use client";

import Kartu from "@/komponen/ui/Kartu";
import Tombol from "@/komponen/ui/Tombol";

export default function GalatHalaman({ reset }: { error: Error; reset: () => void }) {
  return (
    <Kartu className="mx-auto max-w-lg space-y-3 text-center">
      <h1 className="text-lg font-semibold">Halaman gagal dimuat</h1>
      <p className="teks-redup">Coba muat ulang. Kalau masih gagal, periksa koneksi database.</p>
      <Tombol varian="utama" onClick={reset}>Coba lagi</Tombol>
    </Kartu>
  );
}
