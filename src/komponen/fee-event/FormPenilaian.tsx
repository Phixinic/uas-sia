"use client";

/*
 * Penilaian progres satu kehadiran (kapten untuk crew, Owner untuk kapten).
 * "Sesuai" langsung disimpan. "Kurang" membuka isian jam diakui dan catatan (keduanya wajib).
 * Server action memeriksa ulang peran, kepemilikan event, dan batas jam diakui.
 */
import { useId, useRef, useState } from "react";
import { Check, Send, TriangleAlert } from "lucide-react";
import { kirimLaporan, nilaiKehadiran } from "@/lib/aksi/fee-event/penilaian";
import { useAksi } from "@/komponen/ui/useAksi";
import { useFokusGalat } from "@/komponen/ui/useFokusGalat";
import Tombol from "@/komponen/ui/Tombol";
import { AreaTeks, Bidang, Isian } from "@/komponen/ui/Isian";
import DialogKonfirmasi from "@/komponen/ui/DialogKonfirmasi";
import { labelDurasi, menitKeDurasi } from "@/lib/inti/fee-event";

export function FormPenilaian({ id, nama, penilaian, menitDiakui, catatan, batasMenit }: {
  id: number;
  nama: string;
  penilaian: "SESUAI" | "KURANG" | null;
  menitDiakui: number | null;
  catatan: string | null;
  /** Menit tercatat yang dipotong ke jadwal sesi. */
  batasMenit: number;
}) {
  const awalan = useId();
  const { jalankan, memuat } = useAksi();
  const [kurang, setKurang] = useState(penilaian === "KURANG");
  const [jam, setJam] = useState(penilaian === "KURANG" && menitDiakui !== null ? menitKeDurasi(menitDiakui) : "");
  const [teks, setTeks] = useState(catatan ?? "");
  const [galat, setGalat] = useState<Record<string, string>>({});
  const akar = useRef<HTMLDivElement>(null);
  useFokusGalat(akar, galat);

  const simpan = (p: "SESUAI" | "KURANG") =>
    jalankan(() => nilaiKehadiran({ id, penilaian: p, jamDiakui: p === "KURANG" ? jam : "", catatan: teks })).then((h) => {
      setGalat(h.ok ? {} : (h.galatIsian ?? {}));
      if (h.ok && p === "SESUAI") setKurang(false);
    });

  return (
    <div ref={akar} className="space-y-3" role="group" aria-label={`Penilaian ${nama}`}>
      <div className="flex flex-wrap gap-2">
        <Tombol kecil varian={penilaian === "SESUAI" && !kurang ? "utama" : "garis"} ikon={<Check className="size-4" />} memuat={memuat && !kurang} onClick={() => simpan("SESUAI")} aria-pressed={penilaian === "SESUAI" && !kurang}>
          Sesuai
        </Tombol>
        <Tombol kecil varian={kurang ? "bahaya" : "garis"} ikon={<TriangleAlert className="size-4" />} onClick={() => setKurang(true)} aria-pressed={kurang} aria-expanded={kurang}>
          Kurang
        </Tombol>
      </div>
      {kurang && (
        <div className="grid gap-3 rounded-lg border border-rose-200 bg-rose-50/60 p-3 sm:grid-cols-[9rem_1fr]">
          <Bidang label="Jam diakui" htmlFor={`${awalan}-jam`} wajib galat={galat.jamDiakui} petunjuk={`Maks ${menitKeDurasi(batasMenit)} (${labelDurasi(batasMenit)})`}>
            <Isian id={`${awalan}-jam`} inputMode="numeric" placeholder="4:30" value={jam} galat={!!galat.jamDiakui} onChange={(e) => setJam(e.target.value)} />
          </Bidang>
          <Bidang label="Catatan untuk Owner" htmlFor={`${awalan}-catatan`} wajib galat={galat.catatan} petunjuk="Apa yang kurang dari progresnya.">
            <AreaTeks id={`${awalan}-catatan`} rows={2} value={teks} galat={!!galat.catatan} onChange={(e) => setTeks(e.target.value)} />
          </Bidang>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Tombol kecil varian="bahaya" memuat={memuat} onClick={() => simpan("KURANG")}>Simpan penilaian kurang</Tombol>
            {penilaian !== "KURANG" && (
              <Tombol kecil varian="hantu" onClick={() => { setKurang(false); setGalat({}); }} disabled={memuat}>Batal</Tombol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Kapten mengirim laporan progres ke Owner, dengan catatan umum opsional. */
export function TombolKirimLaporan({ eventKode, jumlahKurang, siap }: { eventKode: string; jumlahKurang: number; siap: boolean }) {
  const { jalankan, memuat } = useAksi();
  const [buka, setBuka] = useState(false);
  const [catatan, setCatatan] = useState("");
  const id = useId();
  return (
    <>
      <Tombol varian="utama" ikon={<Send className="size-4" />} disabled={!siap} onClick={() => setBuka(true)}>Kirim laporan ke Owner</Tombol>
      <DialogKonfirmasi
        terbuka={buka}
        judul="Kirim laporan ke Owner?"
        pesan={
          <div className="space-y-3">
            <p>{jumlahKurang ? `${jumlahKurang} kehadiran dinilai kurang dan catatannya ikut terkirim.` : "Semua kehadiran crew dinilai sesuai."} Sesudah dikirim, penilaian terkunci sampai Owner memutuskan.</p>
            <div className="bidang">
              <label className="label" htmlFor={id}>Catatan umum (opsional)</label>
              <AreaTeks id={id} rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
            </div>
          </div>
        }
        labelKonfirmasi="Kirim laporan"
        memuat={memuat}
        saatTutup={() => setBuka(false)}
        saatKonfirmasi={async () => {
          const h = await jalankan(() => kirimLaporan({ eventKode, catatan }));
          if (h.ok) setBuka(false);
        }}
      />
    </>
  );
}
