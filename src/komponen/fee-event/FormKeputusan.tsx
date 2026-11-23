"use client";

/*
 * Keputusan Owner atas laporan kapten: fee akhir per orang (awal = usulan sistem), alasan wajib bila berbeda,
 * pratinjau PPh 21 bukan pegawai dan yang dibayar, lalu Setujui dan bayar atau Tolak (kembali ke kapten).
 * Angka akhir dihitung ulang di server (src/lib/aksi/fee-event/keputusan.ts).
 */
import { useId, useRef, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { setujuiFee, tolakFee } from "@/lib/aksi/fee-event/keputusan";
import { useAksi } from "@/komponen/ui/useAksi";
import { useFokusGalat } from "@/komponen/ui/useFokusGalat";
import Tombol from "@/komponen/ui/Tombol";
import TombolAksi from "@/komponen/ui/TombolAksi";
import DialogKonfirmasi from "@/komponen/ui/DialogKonfirmasi";
import Lencana from "@/komponen/ui/Lencana";
import { Bidang, Isian, IsianRupiah } from "@/komponen/ui/Isian";
import { pph21BukanPegawai } from "@/lib/inti/fee-event";
import { rupiah } from "@/lib/format";

export type BarisKeputusan = {
  karyawanKode: string;
  nama: string;
  jabatan: string;
  peran: "Kapten" | "Crew";
  dasar: string;
  jumlahKurang: number;
  usulan: number;
};

export default function FormKeputusan({ no, baris, saldoKas }: { no: string; baris: BarisKeputusan[]; saldoKas: number }) {
  const awalan = useId();
  const { jalankan, memuat } = useAksi();
  const [fee, setFee] = useState(() => baris.map((b) => ({ karyawanKode: b.karyawanKode, feeAkhir: String(b.usulan), alasan: "" })));
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [buka, setBuka] = useState(false);
  const akar = useRef<HTMLDivElement>(null);
  useFokusGalat(akar, galat);
  const ubah = (i: number, p: Partial<(typeof fee)[number]>) => setFee((f) => f.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const pajak = fee.map((f) => pph21BukanPegawai(Number(f.feeAkhir || 0)));
  const total = { fee: pajak.reduce((s, p) => s + p.bruto, 0), pph: pajak.reduce((s, p) => s + p.pph21, 0), dibayar: pajak.reduce((s, p) => s + p.dibayar, 0) };
  const totalUsulan = baris.reduce((s, b) => s + b.usulan, 0);
  const diubah = fee.filter((f, i) => Number(f.feeAkhir || 0) !== baris[i].usulan).length;
  const kasKurang = total.dibayar > saldoKas;

  const setujui = async () => {
    const h = await jalankan(() => setujuiFee({ no, fee: fee.map((f) => ({ ...f, feeAkhir: Number(f.feeAkhir || 0) })) }));
    setGalat(h.ok ? {} : (h.galatIsian ?? {}));
    if (h.ok || h.galatIsian) setBuka(false);
  };

  return (
    <div ref={akar} className="space-y-4">
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200" aria-label="Fee per orang">
        {baris.map((b, i) => {
          const berubah = Number(fee[i].feeAkhir || 0) !== b.usulan;
          const gAlasan = galat[`fee.${i}.alasan`];
          const gFee = galat[`fee.${i}.feeAkhir`];
          return (
            <li key={b.karyawanKode} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)] md:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                  {b.nama}
                  <Lencana warna={b.peran === "Kapten" ? "teal" : "abu"}>{b.peran}</Lencana>
                  {b.jumlahKurang > 0 && <Lencana warna="merah">{b.jumlahKurang} kurang</Lencana>}
                </div>
                <div className="text-xs text-slate-500">{b.karyawanKode} · {b.jabatan}</div>
                <div className="mt-1 text-[13px] text-slate-600">{b.dasar}</div>
                <div className="mt-1 text-[13px]">Usulan sistem: <span className="angka font-semibold">{rupiah(b.usulan)}</span></div>
              </div>
              <Bidang label={`Fee akhir ${b.nama}`} htmlFor={`${awalan}-fee-${i}`} galat={gFee} petunjuk={`PPh 21 ${rupiah(pajak[i].pph21)}, dibayar ${rupiah(pajak[i].dibayar)}`}>
                <IsianRupiah id={`${awalan}-fee-${i}`} nilai={fee[i].feeAkhir} galat={!!gFee} saatUbah={(v) => ubah(i, { feeAkhir: v })} />
              </Bidang>
              {berubah ? (
                <Bidang label="Alasan perubahan" htmlFor={`${awalan}-alasan-${i}`} wajib galat={gAlasan}>
                  <Isian id={`${awalan}-alasan-${i}`} value={fee[i].alasan} galat={!!gAlasan} onChange={(e) => ubah(i, { alasan: e.target.value })} />
                </Bidang>
              ) : (
                <p className="text-[13px] text-slate-500 md:pt-7">Sama dengan usulan.</p>
              )}
            </li>
          );
        })}
      </ul>

      <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
        <div><dt className="text-xs text-slate-500">Total usulan</dt><dd className="angka font-semibold">{rupiah(totalUsulan)}</dd></div>
        <div><dt className="text-xs text-slate-500">Total fee akhir (beban)</dt><dd className="angka font-semibold">{rupiah(total.fee)}</dd></div>
        <div><dt className="text-xs text-slate-500">PPh 21 (utang)</dt><dd className="angka font-semibold">{rupiah(total.pph)}</dd></div>
        <div><dt className="text-xs text-slate-500">Dibayar dari kas</dt><dd className={`angka font-semibold ${kasKurang ? "text-rose-700" : ""}`}>{rupiah(total.dibayar)}</dd></div>
      </dl>
      {kasKurang && (
        <p className="text-sm text-rose-700">
          Saldo kas {rupiah(saldoKas)} tidak cukup, kurang {rupiah(total.dibayar - saldoKas)}. Persetujuan akan ditolak sistem.{" "}
          <Link className="font-medium underline" href="/modal/investasi-kas?form=baru">Catat setoran modal di menu Investasi Kas</Link>.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Tombol varian="utama" ikon={<Check className="size-4" />} onClick={() => setBuka(true)} disabled={memuat}>Setujui dan bayar</Tombol>
        <TombolAksi
          aksi={(alasan) => tolakFee({ no, alasan })}
          varian="bahaya"
          kecil={false}
          ikon={<X className="size-4" />}
          konfirmasi={{ judul: `Tolak ${no}`, pesan: "Laporan kembali ke kapten. Kapten menilai ulang lalu mengirim laporan baru.", perluAlasan: true, labelAlasan: "Alasan penolakan (dibaca kapten)", labelKonfirmasi: "Tolak laporan" }}
        >
          Tolak
        </TombolAksi>
      </div>
      <DialogKonfirmasi
        terbuka={buka}
        judul={`Setujui ${no}?`}
        pesan={`Jurnal umum dibuat: beban fee ${rupiah(total.fee)}, utang PPh 21 ${rupiah(total.pph)}, kas berkurang ${rupiah(total.dibayar)}. ${diubah ? `${diubah} fee berbeda dari usulan. ` : ""}Slip fee dibuat untuk ${baris.length} orang.`}
        labelKonfirmasi="Setujui dan bayar"
        memuat={memuat}
        saatTutup={() => setBuka(false)}
        saatKonfirmasi={setujui}
      />
    </div>
  );
}
