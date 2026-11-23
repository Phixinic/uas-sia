"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { ajukanNominal } from "@/lib/aksi/master/nominal";
import { useAksi } from "@/komponen/ui/useAksi";
import { useFokusGalat } from "@/komponen/ui/useFokusGalat";
import Kartu from "@/komponen/ui/Kartu";
import Tombol from "@/komponen/ui/Tombol";
import Peringatan from "@/komponen/ui/Peringatan";
import { AreaTeks, Bidang, IsianRupiah } from "@/komponen/ui/Isian";
import { bulanDari, kunciPenutup, labelBulanTahun, labelPeriode, periodeDariBulanTahun, tahunDari, tambahBulan } from "@/lib/inti/tanggal";
import { LABEL_JENIS_NOMINAL, type JenisNominal } from "@/lib/inti/nominal";
import { rupiah } from "@/lib/format";
import PilihBerlaku from "./PilihBerlaku";

export type BahanFormNominal = {
  jenis: JenisNominal;
  itemKode: string;
  item: string;
  /** "per hari" atau "per jam" untuk tarif event. */
  satuan: string | null;
  /** Versi yang berlaku bulan ini (nilai awal form), versi berikutnya, dan pengajuan menunggu. */
  berlaku: { kode: string; teks: string; berlakuMulai: string; nominal: number; tunjJabatan: number; tunjKeluarga: number } | null;
  berikutnya: { kode: string; teks: string; berlakuMulai: string } | null;
  menunggu: { kode: string; teks: string; berlakuMulai: string }[];
  /** Bulan berlaku paling awal yang masih boleh (sesudah slip atau laporan fee terkunci terakhir). */
  palingAwal: string | null;
};

/**
 * Form "Ajukan perubahan nominal" satu item master: nominal baru, bulan dan tahun berlaku, alasan. Pengajuan menjadi
 * versi baru yang berlaku mulai bulan itu sesudah Owner menyetujui; versi lama tetap tersimpan di riwayat.
 */
export default function FormNominal({ bahan, sekarang, periodeBerlaku, terkunci, alamatKembali }: {
  bahan: BahanFormNominal;
  sekarang: string;
  periodeBerlaku: string[];
  terkunci: string[];
  alamatKembali: string;
}) {
  const router = useRouter();
  const id = useId();
  const { jalankan, memuat } = useAksi();
  const akar = useRef<HTMLFormElement>(null);
  const [galat, setGalat] = useState<Record<string, string>>({});
  useFokusGalat(akar, galat);
  // Bawaan berlaku bulan depan, tidak pernah sebelum dokumen terkunci terakhir yang memakai item ini.
  let awalBerlaku = tambahBulan(sekarang, 1);
  if (bahan.palingAwal && bahan.palingAwal > awalBerlaku) awalBerlaku = bahan.palingAwal;
  const v = bahan.berlaku;
  const [nilai, setNilai] = useState({
    nominal: v && bahan.jenis !== "JABATAN" ? String(v.nominal) : "",
    tunjJabatan: v ? String(v.tunjJabatan) : "",
    tunjKeluarga: v ? String(v.tunjKeluarga) : "",
    bulan: String(bulanDari(awalBerlaku)),
    tahun: String(tahunDari(awalBerlaku)),
    alasan: "",
  });
  const ubah = (k: keyof typeof nilai, x: string) => setNilai((n) => ({ ...n, [k]: x }));
  const berlaku = periodeDariBulanTahun(nilai.bulan, nilai.tahun);
  const penutup = berlaku ? kunciPenutup(berlaku, terkunci) : null;
  const kembar = berlaku ? bahan.menunggu.find((m) => m.berlakuMulai === berlaku) : undefined;
  const terlaluAwal = !!(berlaku && bahan.palingAwal && berlaku < bahan.palingAwal);
  const jabatan = bahan.jenis === "JABATAN";
  const label = bahan.jenis === "JABATAN_EVENT" ? `Tarif ${bahan.satuan ?? ""} (Rp)`.replace("  ", " ") : bahan.jenis === "GOLONGAN" ? "Gaji pokok per bulan (Rp)" : "Nominal per bulan (Rp)";

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat({});
    const h = await jalankan(() => ajukanNominal({ jenis: bahan.jenis, itemKode: bahan.itemKode, ...nilai }), { setelahBerhasil: () => router.push(alamatKembali) });
    if (!h.ok && h.galatIsian) setGalat(h.galatIsian);
  };

  return (
    <Kartu>
      <form ref={akar} onSubmit={kirim} className="space-y-4" aria-label={`Form ajukan perubahan nominal ${bahan.item}`} noValidate>
        <div>
          <h2 className="judul-kartu">Ajukan perubahan nominal · {bahan.item}</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {LABEL_JENIS_NOMINAL[bahan.jenis]} tidak ditimpa. Pengajuan ini menjadi versi baru yang berlaku mulai bulan yang dipilih setelah Owner menyetujuinya.
            Slip dan fee bulan sebelumnya tetap memakai nominal lama.
          </p>
        </div>

        <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
          <p>{v ? <>Berlaku {labelPeriode(sekarang)}: <span className="font-medium">{v.teks}</span> ({v.kode}, mulai {labelPeriode(v.berlakuMulai)}).</> : <>Belum ada nominal yang berlaku {labelPeriode(sekarang)}.</>}</p>
          {bahan.berikutnya && <p>Sudah disetujui, belum berlaku: {bahan.berikutnya.teks} mulai {labelPeriode(bahan.berikutnya.berlakuMulai)} ({bahan.berikutnya.kode}).</p>}
          {bahan.menunggu.map((m) => <p key={m.kode}>Menunggu Owner: {m.teks} mulai {labelPeriode(m.berlakuMulai)} ({m.kode}).</p>)}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {jabatan ? (
            <>
              <Bidang label="Tunjangan jabatan (Rp)" htmlFor={`${id}-tj`} galat={galat.tunjJabatan}>
                <IsianRupiah id={`${id}-tj`} nilai={nilai.tunjJabatan} saatUbah={(x) => ubah("tunjJabatan", x)} galat={!!galat.tunjJabatan} placeholder="0" />
              </Bidang>
              <Bidang label="Tunj. istri/anak (Rp)" htmlFor={`${id}-tk`} galat={galat.tunjKeluarga} petunjuk="Hanya dibayar ke karyawan berstatus PTKP K/*.">
                <IsianRupiah id={`${id}-tk`} nilai={nilai.tunjKeluarga} saatUbah={(x) => ubah("tunjKeluarga", x)} galat={!!galat.tunjKeluarga} placeholder="0" />
              </Bidang>
            </>
          ) : (
            <Bidang label={label} htmlFor={`${id}-nominal`} wajib galat={galat.nominal}>
              <IsianRupiah id={`${id}-nominal`} nilai={nilai.nominal} saatUbah={(x) => ubah("nominal", x)} galat={!!galat.nominal} placeholder="0" />
            </Bidang>
          )}
        </div>

        <PilihBerlaku id={id} bulan={nilai.bulan} tahun={nilai.tahun} periodeBerlaku={periodeBerlaku} galat={galat} onChange={(x) => setNilai((n) => ({ ...n, ...x }))} />

        {berlaku && (
          <div aria-live="polite">
            {penutup ? (
              <Peringatan jenis="galat">{labelBulanTahun(berlaku)} sudah tertutup ({labelPeriode(penutup)} dikunci). Bulan berlaku harus periode yang masih terbuka.</Peringatan>
            ) : terlaluAwal ? (
              <Peringatan jenis="galat">Sudah ada {bahan.jenis === "JABATAN_EVENT" ? "laporan fee" : "slip gaji"} terkunci yang memakai nominal ini, jadi perubahan paling awal berlaku {labelPeriode(bahan.palingAwal)}.</Peringatan>
            ) : kembar ? (
              <Peringatan jenis="galat">Sudah ada pengajuan {kembar.kode} berlaku {labelPeriode(berlaku)} yang menunggu Owner.</Peringatan>
            ) : (
              <Peringatan>
                {bahan.jenis === "JABATAN_EVENT"
                  ? `Bila disetujui, fee event yang selesai mulai ${labelPeriode(berlaku)} memakai tarif baru (usulan yang belum dikirim kapten ikut berubah).`
                  : `Bila disetujui, slip gaji mulai ${labelPeriode(berlaku)} memakai nominal baru. Slip draf di bulan itu perlu dihitung ulang.`}
                {v && !jabatan && nilai.nominal && Number(nilai.nominal) !== v.nominal ? ` Perubahan: ${rupiah(v.nominal)} menjadi ${rupiah(Number(nilai.nominal))}.` : ""}
              </Peringatan>
            )}
          </div>
        )}

        <Bidang label="Alasan perubahan" htmlFor={`${id}-alasan`} wajib galat={galat.alasan} petunjuk="Contoh: penyesuaian UMK 2027, kenaikan tarif crew musim akhir tahun.">
          <AreaTeks id={`${id}-alasan`} rows={2} value={nilai.alasan} galat={!!galat.alasan} onChange={(e) => ubah("alasan", e.target.value)} />
        </Bidang>

        <div className="flex flex-wrap gap-2">
          <Tombol type="submit" varian="utama" memuat={memuat} ikon={<Send className="size-4" />}>Ajukan ke Owner</Tombol>
          <Tombol varian="garis" onClick={() => router.push(alamatKembali)} disabled={memuat}>Batal</Tombol>
        </div>
      </form>
    </Kartu>
  );
}
