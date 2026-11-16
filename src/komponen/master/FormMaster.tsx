"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { simpanMaster } from "@/lib/aksi/master/master";
import { useAksi } from "@/komponen/ui/useAksi";
import Kartu from "@/komponen/ui/Kartu";
import Tombol from "@/komponen/ui/Tombol";
import { Bidang, Isian, Pilihan } from "@/komponen/ui/Isian";
import type { DefMaster, OpsiMaster } from "@/lib/skema/master";

type Nilai = Record<string, string | string[]>;

/** Form tambah atau ubah satu data master, dibentuk dari definisinya (src/lib/skema/master.ts). */
export default function FormMaster({ def, opsi, kode, awal, alamatKembali }: {
  def: DefMaster;
  opsi: OpsiMaster;
  /** null = data baru. */
  kode: string | null;
  awal: Nilai;
  alamatKembali: string;
}) {
  const router = useRouter();
  const awalan = useId();
  const { jalankan, memuat } = useAksi();
  const [nilai, setNilai] = useState<Nilai>(awal);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const ubah = (k: string, v: string | string[]) => setNilai((n) => ({ ...n, [k]: v }));

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat({});
    const h = await jalankan(() => simpanMaster({ jenis: def.jenis, kode, nilai }), { setelahBerhasil: () => router.push(alamatKembali) });
    if (!h.ok && h.galatIsian) setGalat(h.galatIsian);
  };

  return (
    <Kartu>
      <form onSubmit={kirim} className="space-y-4" aria-label={`Form ${def.label}`} noValidate>
        <h2 className="judul-kartu">{kode ? `Ubah ${kode}` : `${def.label} baru`}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {def.isian.map((d) => {
            const id = `${awalan}-${d.kunci}`;
            const v = nilai[d.kunci] ?? (d.tipe === "banyak" ? [] : "");
            const g = galat[d.kunci];
            const terkunci = !!d.tetap && !!kode;
            const pilihan = (d.sumber ? opsi[d.sumber] ?? [] : []).filter((o) => !o.nonaktif || (Array.isArray(v) ? v.includes(o.nilai) : o.nilai === v));
            return (
              <Bidang key={d.kunci} label={d.label} htmlFor={id} wajib={d.wajib} galat={g} petunjuk={d.petunjuk} className={d.tipe === "banyak" ? "sm:col-span-2" : ""}>
                {d.tipe === "pilih" ? (
                  <Pilihan id={id} value={String(v)} galat={!!g} onChange={(e) => ubah(d.kunci, e.target.value)} aria-describedby={g ? `${id}-galat` : undefined}>
                    <option value="">Pilih</option>
                    {pilihan.map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
                  </Pilihan>
                ) : d.tipe === "banyak" ? (
                  <div id={id} className="flex flex-wrap gap-x-5 gap-y-2" role="group" aria-label={d.label}>
                    {pilihan.length === 0 && <span className="text-sm text-slate-400">Belum ada data.</span>}
                    {pilihan.map((o) => {
                      const arr = Array.isArray(v) ? v : [];
                      return (
                        <label key={o.nilai} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" className="size-4 accent-aksen" checked={arr.includes(o.nilai)} onChange={(e) => ubah(d.kunci, e.target.checked ? [...arr, o.nilai] : arr.filter((x) => x !== o.nilai))} />
                          {o.label}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <Isian
                    id={id}
                    type={d.tipe === "angka" ? "number" : d.tipe === "waktu" ? "time" : d.tipe === "email" ? "email" : "text"}
                    inputMode={d.tipe === "angka" ? "numeric" : undefined}
                    min={d.tipe === "angka" ? 0 : undefined}
                    step={d.tipe === "angka" ? 1 : undefined}
                    value={String(v)}
                    readOnly={terkunci}
                    galat={!!g}
                    onChange={(e) => ubah(d.kunci, e.target.value)}
                    aria-describedby={g ? `${id}-galat` : undefined}
                  />
                )}
              </Bidang>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Tombol type="submit" varian="utama" memuat={memuat} ikon={<Save className="size-4" />}>Simpan</Tombol>
          <Tombol varian="garis" onClick={() => router.push(alamatKembali)} disabled={memuat}>Batal</Tombol>
        </div>
      </form>
    </Kartu>
  );
}
