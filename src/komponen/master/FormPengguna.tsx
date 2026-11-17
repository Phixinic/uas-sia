"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { buatPengguna, resetKataSandi, ubahPengguna } from "@/lib/aksi/pengguna/pengguna";
import { useAksi } from "@/komponen/ui/useAksi";
import Kartu from "@/komponen/ui/Kartu";
import Tombol from "@/komponen/ui/Tombol";
import { Bidang, Isian, Pilihan } from "@/komponen/ui/Isian";
import { LABEL_PERAN, type Peran } from "@/lib/peran";
import { useFokusGalat } from "@/komponen/ui/useFokusGalat";

const PERAN: Peran[] = ["ADMIN", "HRD", "OWNER"];

type Props = { mode: "baru" } | { mode: "ubah"; id: number; namaPengguna: string; nama: string; peran: Peran; dirinyaSendiri: boolean } | { mode: "sandi"; id: number; namaPengguna: string };

/** Form kelola pengguna: akun baru, ubah nama/peran, atau ganti kata sandi. */
export default function FormPengguna(p: Props) {
  const router = useRouter();
  const awalan = useId();
  const { jalankan, memuat } = useAksi();
  const [nilai, setNilai] = useState({ namaPengguna: "", nama: p.mode === "ubah" ? p.nama : "", peran: (p.mode === "ubah" ? p.peran : "ADMIN") as Peran, kataSandi: "" });
  const [galat, setGalat] = useState<Record<string, string>>({});
  const akar = useRef<HTMLFormElement>(null);
  useFokusGalat(akar, galat);
  const kembali = "/pengguna";
  const ubah = (k: keyof typeof nilai, v: string) => setNilai((n) => ({ ...n, [k]: v }));
  const id = (k: string) => `${awalan}-${k}`;

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat({});
    const aksi =
      p.mode === "baru" ? () => buatPengguna(nilai)
      : p.mode === "ubah" ? () => ubahPengguna({ id: p.id, nama: nilai.nama, peran: nilai.peran })
      : () => resetKataSandi({ id: p.id, kataSandi: nilai.kataSandi });
    const h = await jalankan(aksi, { setelahBerhasil: () => router.push(kembali) });
    if (!h.ok && h.galatIsian) setGalat(h.galatIsian);
  };

  const judul = p.mode === "baru" ? "Pengguna baru" : p.mode === "ubah" ? `Ubah ${p.namaPengguna}` : `Ganti kata sandi ${p.namaPengguna}`;
  return (
    <Kartu>
      <form ref={akar} onSubmit={kirim} className="space-y-4" aria-label={judul} noValidate autoComplete="off">
        <h2 className="judul-kartu">{judul}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {p.mode === "baru" && (
            <Bidang label="Nama pengguna" htmlFor={id("np")} wajib galat={galat.namaPengguna} petunjuk="Dipakai untuk masuk. Huruf kecil, angka, titik, garis bawah, atau minus.">
              <Isian id={id("np")} value={nilai.namaPengguna} galat={!!galat.namaPengguna} onChange={(e) => ubah("namaPengguna", e.target.value)} autoComplete="off" />
            </Bidang>
          )}
          {p.mode !== "sandi" && (
            <Bidang label="Nama lengkap" htmlFor={id("nama")} wajib galat={galat.nama}>
              <Isian id={id("nama")} value={nilai.nama} galat={!!galat.nama} onChange={(e) => ubah("nama", e.target.value)} />
            </Bidang>
          )}
          {p.mode !== "sandi" && (
            <Bidang label="Peran" htmlFor={id("peran")} wajib galat={galat.peran} petunjuk={p.mode === "ubah" && p.dirinyaSendiri ? "Peran akunmu sendiri tidak bisa diubah." : undefined}>
              <Pilihan id={id("peran")} value={nilai.peran} galat={!!galat.peran} disabled={p.mode === "ubah" && p.dirinyaSendiri} onChange={(e) => ubah("peran", e.target.value)}>
                {PERAN.map((x) => <option key={x} value={x}>{LABEL_PERAN[x]}</option>)}
              </Pilihan>
            </Bidang>
          )}
          {p.mode !== "ubah" && (
            <Bidang label={p.mode === "baru" ? "Kata sandi" : "Kata sandi baru"} htmlFor={id("sandi")} wajib galat={galat.kataSandi} petunjuk="Minimal 8 karakter. Bagikan ke pemilik akun lewat jalur yang aman.">
              <Isian id={id("sandi")} type="password" value={nilai.kataSandi} galat={!!galat.kataSandi} onChange={(e) => ubah("kataSandi", e.target.value)} autoComplete="new-password" />
            </Bidang>
          )}
        </div>
        <div className="flex gap-2">
          <Tombol type="submit" varian="utama" memuat={memuat} ikon={<Save className="size-4" />}>Simpan</Tombol>
          <Tombol varian="garis" onClick={() => router.push(kembali)} disabled={memuat}>Batal</Tombol>
        </div>
      </form>
    </Kartu>
  );
}
