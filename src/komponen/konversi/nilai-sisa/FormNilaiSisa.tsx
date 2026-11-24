"use client";

/*
 * Form hitung fisik perlengkapan. Biaya dan jurnal draf dihitung langsung di browser memakai fungsi
 * yang sama dengan server (src/lib/inti), jadi pratinjau pasti sama dengan hasil simpan.
 * `awal` mengisi nilai sebelumnya (draf, dikembalikan Owner, atau revisi). Mode `revisi` dipakai sesudah nilai sisa
 * disetujui: alasan wajib dan tombolnya mengajukan revisi ke Owner.
 */
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Send } from "lucide-react";
import { ajukanRevisiNilaiSisa, simpanNilaiSisa } from "@/lib/aksi/konversi/nilai-sisa";
import { useAksi } from "@/komponen/ui/useAksi";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import Tombol, { TautanTombol } from "@/komponen/ui/Tombol";
import { AreaTeks, Bidang, IsianRupiah } from "@/komponen/ui/Isian";
import Peringatan from "@/komponen/ui/Peringatan";
import TabelJurnal from "@/komponen/ui/TabelJurnal";
import { barisOpname } from "@/lib/inti/jurnal";
import { labelBulanTahun } from "@/lib/inti/tanggal";
import { rupiah } from "@/lib/format";
import { useFokusGalat } from "@/komponen/ui/useFokusGalat";

type Baris = { kode: string; nama: string; satuan: string; saldoBuku: number };

export default function FormNilaiSisa({ periode, baris, bolehInput, namaAkun, tertahan, awal, revisi, judul, keterangan, batalHref }: {
  periode: string;
  baris: Baris[];
  bolehInput: boolean;
  namaAkun: Record<string, string>;
  tertahan?: boolean;
  /** Nilai sisa yang sudah ada per kode perlengkapan, untuk diubah. */
  awal?: Record<string, number>;
  /** Mode revisi sesudah disetujui: alasan wajib, tombol mengajukan revisi. */
  revisi?: boolean;
  judul?: string;
  keterangan?: string;
  /** Tautan "Batal" (mode revisi). */
  batalHref?: string;
}) {
  const { jalankan, memuat } = useAksi();
  const router = useRouter();
  const nilaiAwal = () => Object.fromEntries(Object.entries(awal ?? {}).filter(([k]) => baris.some((b) => b.kode === k)).map(([k, v]) => [k, String(v)]));
  const [nilai, setNilai] = useState<Record<string, string>>(nilaiAwal);
  const [alasan, setAlasan] = useState("");
  const [galat, setGalat] = useState<Record<string, string>>({});
  const akar = useRef<HTMLDivElement>(null);
  useFokusGalat(akar, galat);

  const hitung = useMemo(() => {
    const kosong: string[] = [];
    const salah: Record<string, string> = {};
    let total = 0;
    for (const b of baris) {
      const v = nilai[b.kode];
      if (v === undefined || v === "") {
        kosong.push(b.nama);
        continue;
      }
      const n = Number(v);
      if (n < 0 || n > b.saldoBuku) salah[b.kode] = `Harus 0 sampai ${rupiah(b.saldoBuku)}.`;
      else total += b.saldoBuku - n;
    }
    return { kosong, salah, total };
  }, [nilai, baris]);

  const siap = bolehInput && hitung.kosong.length === 0 && Object.keys(hitung.salah).length === 0 && (!revisi || alasan.trim().length > 0);
  const kirimNilai = baris.map((b) => ({ perlengkapanKode: b.kode, nilaiSisa: nilai[b.kode] ?? "" }));
  const simpan = () =>
    jalankan(() => (revisi ? ajukanRevisiNilaiSisa({ periode, nilai: kirimNilai, alasan }) : simpanNilaiSisa({ periode, nilai: kirimNilai }))).then((h) => {
      setGalat(h.ok ? {} : h.galatIsian ?? {});
      if (h.ok && revisi && batalHref) router.push(batalHref);
    });

  return (
    <div ref={akar}>
      <Kartu rapat>
        <KepalaKartu judul={judul ?? `Hitung fisik · ${labelBulanTahun(periode)}`} keterangan={keterangan ?? "Input nilai sisa perlengkapan dari hitung fisik akhir bulan."} />
        <Tabel label="Hitung fisik perlengkapan">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Perlengkapan</th>
              <th className="kolom-angka">Saldo buku (Rp)</th>
              <th className="min-w-44 kolom-angka">Nilai sisa hasil hitung (Rp)</th>
              <th className="kolom-angka">Biaya (Rp)</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => {
              const pesan = hitung.salah[b.kode] ?? galat[`nilai.${b.kode}`];
              const v = nilai[b.kode];
              return (
                <tr key={b.kode}>
                  <td className="kode">{b.kode}</td>
                  <td>{b.nama} <span className="text-xs text-slate-500">({b.satuan})</span></td>
                  <td className="kolom-angka"><Rupiah nilai={b.saldoBuku} polos /></td>
                  <td>
                    {bolehInput ? (
                      <>
                        <label className="sr-only" htmlFor={`sisa-${b.kode}`}>Nilai sisa {b.nama}</label>
                        <IsianRupiah id={`sisa-${b.kode}`} nilai={v ?? ""} saatUbah={(x) => setNilai((s) => ({ ...s, [b.kode]: x }))} galat={!!pesan} placeholder="0" aria-describedby={pesan ? `sisa-${b.kode}-galat` : undefined} />
                        {pesan && <span className="galat-isian" id={`sisa-${b.kode}-galat`}>{pesan}</span>}
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">{tertahan ? "Menunggu bulan sebelumnya" : "Diisi Admin"}</span>
                    )}
                  </td>
                  <td className="kolom-angka">{v !== undefined && v !== "" && !hitung.salah[b.kode] ? <Rupiah nilai={b.saldoBuku - Number(v)} polos /> : <span className="text-slate-300">-</span>}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total</td>
              <td className="kolom-angka"><Rupiah nilai={baris.reduce((s, b) => s + b.saldoBuku, 0)} polos /></td>
              <td />
              <td className="kolom-angka"><Rupiah nilai={hitung.total} polos /></td>
            </tr>
          </tfoot>
        </Tabel>
        {bolehInput && (
          <div className="space-y-4 p-5">
            {hitung.kosong.length > 0 && Object.keys(nilai).length > 0 && (
              <Peringatan jenis="awas">Belum dihitung: {hitung.kosong.join(", ")}. Semua perlengkapan wajib diisi sebelum disimpan.</Peringatan>
            )}
            <details className="rounded-lg border border-slate-200 p-3" open={siap}>
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">{revisi ? "Jurnal penyesuaian baru bila revisi disetujui" : "Jurnal penyesuaian (draf)"}</summary>
              <div className="mt-3">
                {hitung.total > 0 ? <TabelJurnal baris={barisOpname(hitung.total)} namaAkun={namaAkun} /> : <p className="teks-redup">{siap ? "Biaya perlengkapan 0, jadi tidak ada jurnal yang dibuat." : "Isi nilai sisa untuk melihat jurnalnya."}</p>}
              </div>
            </details>
            {revisi && (
              <Bidang label="Alasan revisi" htmlFor="alasan" wajib galat={galat.alasan}>
                <AreaTeks id="alasan" rows={2} value={alasan} onChange={(e) => setAlasan(e.target.value)} galat={!!galat.alasan} placeholder="Contoh: hitung ulang gudang, ada dus kabel yang belum terhitung" />
              </Bidang>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {revisi ? (
                <Tombol varian="utama" ikon={<Send className="size-4" />} onClick={simpan} memuat={memuat} disabled={!siap}>
                  Ajukan revisi ke Owner
                </Tombol>
              ) : (
                <Tombol varian="utama" ikon={<Save className="size-4" />} onClick={simpan} memuat={memuat} disabled={!siap}>
                  Simpan nilai sisa
                </Tombol>
              )}
              {batalHref && <TautanTombol href={batalHref}>Batal</TautanTombol>}
            </div>
          </div>
        )}
      </Kartu>
    </div>
  );
}
