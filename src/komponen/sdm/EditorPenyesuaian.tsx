"use client";

/*
 * Editor potongan dan bonus satu karyawan di Gaji Bulanan (HRD). Baris yang tersimpan bisa dihapus; baris baru diketik
 * (nominal dan keterangan wajib). Pratinjau gaji dihitung langsung di browser dengan hitungGaji (rumus yang sama dengan
 * server) dari bahan terbaru ditambah baris yang sedang diketik, jadi HRD melihat bruto, PPh 21, dan THP sebelum menyimpan.
 */
import { useMemo, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { hapusPenyesuaianGaji, simpanPenyesuaianGaji } from "@/lib/aksi/sdm/gaji-bulanan";
import { hitungGaji, type InputGaji } from "@/lib/inti/penggajian";
import { rupiah } from "@/lib/format";
import { useAksi } from "@/komponen/ui/useAksi";
import { useFokusGalat } from "@/komponen/ui/useFokusGalat";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tombol, { TautanTombol } from "@/komponen/ui/Tombol";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { Bidang, Isian, IsianRupiah, Pilihan } from "@/komponen/ui/Isian";

type Baris = { id: number; keterangan: string; nominal: number };

export default function EditorPenyesuaian({ periode, karyawanKode, nama, input, bonus, potongan, alamatTutup }: {
  periode: string;
  karyawanKode: string;
  nama: string;
  input: InputGaji;
  bonus: Baris[];
  potongan: Baris[];
  alamatTutup: string;
}) {
  const { jalankan, memuat } = useAksi();
  const [jenis, setJenis] = useState<"POTONGAN" | "BONUS">("POTONGAN");
  const [nominal, setNominal] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [galat, setGalat] = useState<Record<string, string>>({});
  const akar = useRef<HTMLDivElement>(null);
  useFokusGalat(akar, galat);

  // Pratinjau: bahan tersimpan + baris yang sedang diketik (belum disimpan).
  const pratinjau = useMemo(() => {
    const n = Number(nominal || 0);
    const baru = n > 0 ? [{ keterangan: keterangan || "(belum disimpan)", nominal: n }] : [];
    return hitungGaji({
      ...input,
      bonus: [...bonus.map((b) => ({ keterangan: b.keterangan, nominal: b.nominal })), ...(jenis === "BONUS" ? baru : [])],
      potongan: [...potongan.map((b) => ({ keterangan: b.keterangan, nominal: b.nominal })), ...(jenis === "POTONGAN" ? baru : [])],
    });
  }, [input, bonus, potongan, jenis, nominal, keterangan]);

  const simpan = async () => {
    const h = await jalankan(() => simpanPenyesuaianGaji({ periode, karyawanKode, jenis, nominal: Number(nominal || 0), keterangan }));
    setGalat(h.ok ? {} : (h.galatIsian ?? {}));
    if (h.ok) {
      setNominal("");
      setKeterangan("");
    }
  };

  const daftar = [...potongan.map((b) => ({ ...b, jenis: "Potongan" as const })), ...bonus.map((b) => ({ ...b, jenis: "Bonus" as const }))];
  return (
    <div ref={akar}>
      <Kartu rapat label={`Potongan dan bonus ${nama}`}>
        <KepalaKartu
          judul={`Potongan dan bonus · ${nama}`}
          keterangan="Potongan (misalnya denda merusak alat) mengurangi THP dan dicatat sebagai pendapatan lain-lain. Bonus menambah bruto dan ikut PPh 21."
          aksi={<TautanTombol href={alamatTutup} kecil ikon={<X className="size-4" />}>Tutup</TautanTombol>}
        />
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            {daftar.length ? (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200" aria-label="Potongan dan bonus tersimpan">
                {daftar.map((b) => (
                  <li key={`${b.jenis}-${b.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className={`font-medium ${b.jenis === "Potongan" ? "text-rose-700" : "text-emerald-700"}`}>{b.jenis}</span> {b.keterangan}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="angka font-semibold">{b.jenis === "Potongan" ? "−" : ""}{rupiah(b.nominal)}</span>
                      <TombolAksi aksi={() => hapusPenyesuaianGaji({ id: b.id })} varian="hantu" ikon={<Trash2 className="size-4" />} judul={`Hapus ${b.jenis.toLowerCase()} ${b.keterangan}`} konfirmasi={{ judul: `Hapus ${b.jenis.toLowerCase()} ini?`, pesan: `${b.keterangan}, ${rupiah(b.nominal)}.`, labelKonfirmasi: "Hapus" }}>
                        Hapus
                      </TombolAksi>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="teks-redup">Belum ada potongan atau bonus bulan ini.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-[9rem_10rem_minmax(0,1fr)]">
              <Bidang label="Jenis" htmlFor="peny-jenis">
                <Pilihan id="peny-jenis" value={jenis} onChange={(e) => setJenis(e.target.value as "POTONGAN" | "BONUS")}>
                  <option value="POTONGAN">Potongan</option>
                  <option value="BONUS">Bonus</option>
                </Pilihan>
              </Bidang>
              <Bidang label="Nominal (Rp)" htmlFor="peny-nominal" wajib galat={galat.nominal}>
                <IsianRupiah id="peny-nominal" nilai={nominal} galat={!!galat.nominal} saatUbah={setNominal} placeholder="0" />
              </Bidang>
              <Bidang label="Keterangan" htmlFor="peny-keterangan" wajib galat={galat.keterangan}>
                <Isian id="peny-keterangan" value={keterangan} galat={!!galat.keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder={jenis === "POTONGAN" ? "Contoh: denda merusak kabel XLR" : "Contoh: bonus target pameran"} />
              </Bidang>
            </div>
            <Tombol varian="utama" ikon={<Plus className="size-4" />} onClick={simpan} memuat={memuat} disabled={!Number(nominal) || !keterangan.trim()}>
              Simpan {jenis === "POTONGAN" ? "potongan" : "bonus"}
            </Tombol>
          </div>
          <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-sm" aria-label="Pratinjau gaji" aria-live="polite">
            <h3 className="mb-2 font-semibold text-slate-800">Pratinjau gaji <span className="text-xs font-normal text-slate-500">(estimasi, ikut baris yang sedang diketik)</span></h3>
            <dl className="space-y-1">
              {(
                [
                  ["Gaji tetap", pratinjau.gajiTetap],
                  ["Upah event", pratinjau.totalUpahEvent],
                  ["Bonus", pratinjau.totalBonus],
                  ["Bruto", pratinjau.bruto],
                  ["PPh 21", -pratinjau.pph21],
                  ["Potongan", -pratinjau.totalPotongan],
                ] as [string, number][]
              ).map(([k, v]) => (
                <div key={k} className={`flex justify-between gap-3 ${k === "Bruto" ? "border-t border-slate-200 pt-1 font-semibold" : ""}`}>
                  <dt className="text-slate-600">{k}</dt>
                  <dd className="angka">{v < 0 ? `−${rupiah(-v)}` : rupiah(v)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-slate-300 pt-1 text-base font-bold text-slate-900">
                <dt>THP</dt>
                <dd className={`angka ${pratinjau.thp < 0 ? "text-rose-700" : ""}`}>{rupiah(pratinjau.thp)}</dd>
              </div>
            </dl>
            {pratinjau.thp < 0 && <p className="mt-2 text-xs text-rose-700">Potongan lebih besar dari gaji yang diterima. Pengajuan akan ditolak sistem.</p>}
          </section>
        </div>
      </Kartu>
    </div>
  );
}
