"use client";

/*
 * Tambah cepat master dari form pembelian (Admin): supplier atau barang baru tanpa meninggalkan form.
 * Panel ini berada di dalam <form> pembelian, jadi tidak memakai <form> sendiri dan Enter ditangani manual.
 */
import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { tambahBarangCepat, tambahSupplierCepat } from "@/lib/aksi/konversi/master-cepat";
import { useAksi } from "@/komponen/ui/useAksi";
import Tombol from "@/komponen/ui/Tombol";
import { Bidang, Isian, Pilihan } from "@/komponen/ui/Isian";
import type { BarangForm } from "@/lib/data/konversi/pembelian";
import type { JenisPembelian } from "@/generated/prisma/enums";
import { useFokusGalat } from "@/komponen/ui/useFokusGalat";

export type KategoriForm = { kode: string; nama: string; masaManfaatBulan: number; persenResidu: number; akunAset: string };

const tekanEnter = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === "Enter") {
    e.preventDefault();
    fn();
  }
};

export function TambahSupplierCepat({ saatSelesai }: { saatSelesai: (s: { kode: string; nama: string }) => void }) {
  const { jalankan, memuat } = useAksi();
  const [buka, setBuka] = useState(false);
  const [nama, setNama] = useState("");
  const [telepon, setTelepon] = useState("");
  const [galat, setGalat] = useState<Record<string, string>>({});
  const akar = useRef<HTMLDivElement>(null);
  useFokusGalat(akar, galat);
  const simpan = () =>
    jalankan(() => tambahSupplierCepat({ nama, telepon }), {
      setelahBerhasil: (h) => {
        if (h.data) saatSelesai(h.data);
        setBuka(false);
        setNama("");
        setTelepon("");
        setGalat({});
      },
    }).then((h) => !h.ok && setGalat(h.galatIsian ?? {}));
  if (!buka) {
    return (
      <Tombol kecil varian="hantu" ikon={<Plus className="size-4" />} onClick={() => setBuka(true)}>
        Supplier baru
      </Tombol>
    );
  }
  return (
    <div ref={akar} className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-white p-3 sm:col-span-2 lg:col-span-3" role="group" aria-label="Tambah supplier cepat">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Bidang label="Nama supplier baru" htmlFor="cepat-sup-nama" wajib galat={galat.nama}>
          <Isian id="cepat-sup-nama" value={nama} onChange={(e) => setNama(e.target.value)} onKeyDown={tekanEnter(simpan)} galat={!!galat.nama} autoFocus />
        </Bidang>
        <Bidang label="Telepon" htmlFor="cepat-sup-telp" galat={galat.telepon}>
          <Isian id="cepat-sup-telp" value={telepon} onChange={(e) => setTelepon(e.target.value)} onKeyDown={tekanEnter(simpan)} placeholder="opsional" />
        </Bidang>
      </div>
      <div className="flex gap-2">
        <Tombol kecil varian="utama" memuat={memuat} onClick={simpan}>Simpan supplier</Tombol>
        <Tombol kecil varian="hantu" onClick={() => setBuka(false)} disabled={memuat}>Batal</Tombol>
      </div>
    </div>
  );
}

export function TambahBarangCepat({ jenis, kategori, saatSelesai }: { jenis: JenisPembelian; kategori: KategoriForm[]; saatSelesai: (b: BarangForm) => void }) {
  const { jalankan, memuat } = useAksi();
  const peralatan = jenis === "PERALATAN";
  const label = peralatan ? "peralatan" : "perlengkapan";
  const [buka, setBuka] = useState(false);
  const [nama, setNama] = useState("");
  const [satuan, setSatuan] = useState("");
  const [kategoriKode, setKategoriKode] = useState("");
  const [galat, setGalat] = useState<Record<string, string>>({});
  const akar = useRef<HTMLDivElement>(null);
  useFokusGalat(akar, galat);
  const simpan = () =>
    jalankan(() => tambahBarangCepat({ jenis, nama, satuan, kategoriKode }), {
      setelahBerhasil: (h) => {
        const kat = kategori.find((k) => k.kode === kategoriKode);
        if (h.data) {
          saatSelesai({
            kode: h.data.kode,
            nama: nama.trim(),
            satuan: satuan.trim(),
            kategori: peralatan && kat ? { nama: kat.nama, masaManfaatBulan: kat.masaManfaatBulan, persenResidu: kat.persenResidu, akunAset: kat.akunAset } : null,
          } as BarangForm);
        }
        setBuka(false);
        setNama("");
        setSatuan("");
        setKategoriKode("");
        setGalat({});
      },
    }).then((h) => !h.ok && setGalat(h.galatIsian ?? {}));
  if (!buka) {
    return (
      <Tombol kecil varian="hantu" ikon={<Plus className="size-4" />} onClick={() => setBuka(true)}>
        {peralatan ? "Peralatan" : "Perlengkapan"} baru di master
      </Tombol>
    );
  }
  return (
    <div ref={akar} className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-white p-3" role="group" aria-label={`Tambah ${label} cepat`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Bidang label={`Nama ${label} baru`} htmlFor="cepat-brg-nama" wajib galat={galat.nama}>
          <Isian id="cepat-brg-nama" value={nama} onChange={(e) => setNama(e.target.value)} onKeyDown={tekanEnter(simpan)} galat={!!galat.nama} autoFocus />
        </Bidang>
        <Bidang label="Satuan" htmlFor="cepat-brg-satuan" wajib galat={galat.satuan}>
          <Isian id="cepat-brg-satuan" value={satuan} onChange={(e) => setSatuan(e.target.value)} onKeyDown={tekanEnter(simpan)} placeholder="unit, pcs, roll" galat={!!galat.satuan} />
        </Bidang>
        {peralatan && (
          <Bidang label="Kategori aset" htmlFor="cepat-brg-kat" wajib galat={galat.kategoriKode}>
            <Pilihan id="cepat-brg-kat" value={kategoriKode} onChange={(e) => setKategoriKode(e.target.value)} galat={!!galat.kategoriKode}>
              <option value="">Pilih kategori</option>
              {kategori.map((k) => (
                <option key={k.kode} value={k.kode}>{k.nama}</option>
              ))}
            </Pilihan>
          </Bidang>
        )}
      </div>
      <div className="flex gap-2">
        <Tombol kecil varian="utama" memuat={memuat} onClick={simpan}>Simpan ke master</Tombol>
        <Tombol kecil varian="hantu" onClick={() => setBuka(false)} disabled={memuat}>Batal</Tombol>
      </div>
    </div>
  );
}
