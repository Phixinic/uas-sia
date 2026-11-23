"use client";

/*
 * Form catat setoran modal pemilik (Investasi Kas). Pratinjau jurnalnya memakai barisInvestasiKas yang sama dengan server.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { catatInvestasiKas } from "@/lib/aksi/modal/investasi-kas";
import { useAksi } from "@/komponen/ui/useAksi";
import { useFokusGalat } from "@/komponen/ui/useFokusGalat";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tombol, { TautanTombol } from "@/komponen/ui/Tombol";
import { Bidang, Isian, IsianRupiah } from "@/komponen/ui/Isian";
import TabelJurnal from "@/komponen/ui/TabelJurnal";
import { barisInvestasiKas } from "@/lib/inti/modal";

export default function FormInvestasiKas({ tanggalAwal, namaAkun, alamatKembali, owner }: { tanggalAwal: string; namaAkun: Record<string, string>; alamatKembali: string; owner: boolean }) {
  const router = useRouter();
  const { jalankan, memuat } = useAksi();
  const [tanggal, setTanggal] = useState(tanggalAwal);
  const [jumlah, setJumlah] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [galat, setGalat] = useState<Record<string, string>>({});
  const akar = useRef<HTMLFormElement>(null);
  useFokusGalat(akar, galat);

  const kirim = () =>
    jalankan(() => catatInvestasiKas({ tanggal, jumlah, keterangan }), { setelahBerhasil: () => router.push(alamatKembali) }).then((h) => setGalat(h.ok ? {} : h.galatIsian ?? {}));

  return (
    <Kartu rapat>
      <KepalaKartu
        judul="Catat setoran modal"
        keterangan={owner ? "Setoran dicatat dulu, lalu kamu setujui di daftar di bawah supaya jurnalnya dibuat." : "Setoran dicatat lalu menunggu keputusan Owner. Jurnal baru dibuat saat Owner menyetujui."}
      />
      <form ref={akar} aria-label="Catat setoran modal" className="space-y-5 p-5" noValidate onSubmit={(e) => { e.preventDefault(); kirim(); }}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Bidang label="Tanggal setoran" htmlFor="tanggal" wajib galat={galat.tanggal}>
            <Isian id="tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} galat={!!galat.tanggal} />
          </Bidang>
          <Bidang label="Jumlah (Rp)" htmlFor="jumlah" wajib galat={galat.jumlah}>
            <IsianRupiah id="jumlah" nilai={jumlah} saatUbah={setJumlah} galat={!!galat.jumlah} />
          </Bidang>
          <Bidang label="Keterangan atau sumber dana" htmlFor="keterangan" wajib galat={galat.keterangan} petunjuk="Contoh: Setoran pemilik dari rekening pribadi" className="sm:col-span-2">
            <Isian id="keterangan" value={keterangan} maxLength={200} onChange={(e) => setKeterangan(e.target.value)} galat={!!galat.keterangan} />
          </Bidang>
        </div>
        <details open>
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">Jurnal setoran (dibuat saat disetujui Owner)</summary>
          <div className="mt-3">
            {Number(jumlah) > 0 ? <TabelJurnal baris={barisInvestasiKas(Number(jumlah))} namaAkun={namaAkun} /> : <p className="teks-redup">Isi jumlah untuk melihat jurnalnya: Debit Kas, Kredit Modal Pemilik.</p>}
          </div>
        </details>
        <div className="flex flex-wrap gap-2">
          <Tombol type="submit" varian="utama" ikon={<Send className="size-4" />} memuat={memuat}>{owner ? "Catat setoran" : "Ajukan ke Owner"}</Tombol>
          <TautanTombol href={alamatKembali} varian="hantu">Batal</TautanTombol>
        </div>
      </form>
    </Kartu>
  );
}
