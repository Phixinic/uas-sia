"use client";

import { useId, useRef, useState } from "react";
import { Save } from "lucide-react";
import { simpanProfil } from "@/lib/aksi/master/master";
import { useAksi } from "@/komponen/ui/useAksi";
import Kartu from "@/komponen/ui/Kartu";
import Tombol from "@/komponen/ui/Tombol";
import { Bidang, Isian } from "@/komponen/ui/Isian";
import { useFokusGalat } from "@/komponen/ui/useFokusGalat";

/** Profil usaha (Owner): nama dan keterangan di sidebar. */
export default function FormProfil({ awal }: { awal: { nama: string; keterangan: string } }) {
  const id = useId();
  const { jalankan, memuat } = useAksi();
  const [nilai, setNilai] = useState(awal);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const akar = useRef<HTMLFormElement>(null);
  useFokusGalat(akar, galat);
  return (
    <Kartu>
      <form
        ref={akar}
        className="space-y-4"
        aria-label="Profil usaha"
        onSubmit={async (e) => {
          e.preventDefault();
          setGalat({});
          const h = await jalankan(() => simpanProfil(nilai));
          if (!h.ok && h.galatIsian) setGalat(h.galatIsian);
        }}
      >
        <div>
          <h2 className="judul-kartu">Profil usaha (studi kasus)</h2>
          <p className="mt-0.5 text-xs text-slate-500">Nama ini tampil di sidebar. Kalau studi kasusnya berganti, ubah di sini lalu sesuaikan data master.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Bidang label="Nama usaha" htmlFor={`${id}-nama`} galat={galat.nama} wajib>
            <Isian id={`${id}-nama`} value={nilai.nama} galat={!!galat.nama} onChange={(e) => setNilai({ ...nilai, nama: e.target.value })} />
          </Bidang>
          <Bidang label="Keterangan singkat" htmlFor={`${id}-ket`} galat={galat.keterangan}>
            <Isian id={`${id}-ket`} value={nilai.keterangan} galat={!!galat.keterangan} onChange={(e) => setNilai({ ...nilai, keterangan: e.target.value })} />
          </Bidang>
        </div>
        <Tombol type="submit" varian="utama" memuat={memuat} ikon={<Save className="size-4" />}>Simpan profil</Tombol>
      </form>
    </Kartu>
  );
}
