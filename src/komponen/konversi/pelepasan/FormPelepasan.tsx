"use client";

/*
 * Form ajukan pelepasan. Nilai buku, laba/rugi, dan jurnal dihitung di browser dengan fungsi yang sama dengan server
 * (hitungPelepasan, barisPelepasan di src/lib/inti/jurnal.ts).
 */
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { ajukanPelepasan } from "@/lib/aksi/konversi/pelepasan";
import { useAksi } from "@/komponen/ui/useAksi";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tombol, { TautanTombol } from "@/komponen/ui/Tombol";
import { Bidang, Isian, IsianRupiah, Pilihan } from "@/komponen/ui/Isian";
import Peringatan from "@/komponen/ui/Peringatan";
import TabelJurnal from "@/komponen/ui/TabelJurnal";
import Rupiah from "@/komponen/ui/Rupiah";
import { barisPelepasan, hitungPelepasan } from "@/lib/inti/jurnal";
import { LABEL_ALASAN_PELEPASAN } from "@/lib/format";
import type { AlasanPelepasan } from "@/generated/prisma/enums";
import { cekJadwalPelepasan, KEBIJAKAN_BULAN_PELEPASAN } from "@/lib/data/konversi/hitung";
import type { DataPelepasan } from "@/lib/data/konversi/aset";
import { useFokusGalat } from "@/komponen/ui/useFokusGalat";

export default function FormPelepasan({ aset, namaAkun, asetAwal, tanggalAwal, alamatKembali }: {
  aset: DataPelepasan["aset"];
  namaAkun: Record<string, string>;
  asetAwal: string;
  tanggalAwal: string;
  alamatKembali: string;
}) {
  const router = useRouter();
  const { jalankan, memuat } = useAksi();
  const [asetKode, setAsetKode] = useState(asetAwal);
  const [tanggal, setTanggal] = useState(tanggalAwal);
  const [alasan, setAlasan] = useState<AlasanPelepasan>("DIJUAL");
  const [hargaJual, setHargaJual] = useState("");
  const [galat, setGalat] = useState<Record<string, string>>({});
  const akar = useRef<HTMLFormElement>(null);
  useFokusGalat(akar, galat);

  const a = aset.find((x) => x.kode === asetKode);
  const harga = alasan === "DIJUAL" && hargaJual !== "" ? Number(hargaJual) : 0;
  const hitung = useMemo(() => {
    if (!a) return null;
    const h = hitungPelepasan(a.nilaiPerolehan, a.akumulasi, harga);
    let jurnal: ReturnType<typeof barisPelepasan> = [];
    try {
      jurnal = barisPelepasan({ nilaiPerolehan: a.nilaiPerolehan, akumulasi: h.akumulasi, hargaJual: harga, akunAset: a.akunAset, akunAkumulasi: a.akunAkumulasi });
    } catch {}
    return { ...h, jurnal };
  }, [a, harga]);
  const tahanJadwal = a && tanggal ? cekJadwalPelepasan(a.jadwal, tanggal) : null;
  const tertahan = !!a && (a.sudahDiajukan || !!tahanJadwal);

  const kirim = () =>
    jalankan(() => ajukanPelepasan({ asetKode, tanggal, alasan, hargaJual: alasan === "DIJUAL" ? hargaJual : "" }), { setelahBerhasil: (h) => router.push(`${alamatKembali}?lihat=${h.data?.no}`) }).then((h) => setGalat(h.ok ? {} : h.galatIsian ?? {}));

  return (
    <Kartu rapat>
      <KepalaKartu judul="Ajukan pelepasan" keterangan="Ajukan pelepasan peralatan untuk disetujui Owner." />
      <form ref={akar} className="space-y-5 p-5" noValidate onSubmit={(e) => { e.preventDefault(); kirim(); }}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Bidang label="Peralatan" htmlFor="asetKode" wajib galat={galat.asetKode} className="sm:col-span-2">
            <Pilihan id="asetKode" value={asetKode} onChange={(e) => setAsetKode(e.target.value)} galat={!!galat.asetKode}>
              <option value="">Pilih aset aktif</option>
              {aset.map((x) => (
                <option key={x.kode} value={x.kode}>{x.kode} · {x.nama}{x.sudahDiajukan ? " (sudah diajukan)" : ""}</option>
              ))}
            </Pilihan>
          </Bidang>
          <Bidang label="Tanggal" htmlFor="tanggal" wajib galat={galat.tanggal} petunjuk={a ? `Perolehan ${a.tglPerolehan.split("-").reverse().join("/")}` : undefined}>
            <Isian id="tanggal" type="date" value={tanggal} min={a?.tglPerolehan} onChange={(e) => setTanggal(e.target.value)} galat={!!galat.tanggal} />
          </Bidang>
          <Bidang label="Alasan" htmlFor="alasan" wajib>
            <Pilihan id="alasan" value={alasan} onChange={(e) => setAlasan(e.target.value as AlasanPelepasan)}>
              {(Object.keys(LABEL_ALASAN_PELEPASAN) as AlasanPelepasan[]).map((k) => (
                <option key={k} value={k}>{LABEL_ALASAN_PELEPASAN[k]}</option>
              ))}
            </Pilihan>
          </Bidang>
          {alasan === "DIJUAL" && (
            <Bidang label="Harga jual (Rp)" htmlFor="hargaJual" wajib galat={galat.hargaJual}>
              <IsianRupiah id="hargaJual" nilai={hargaJual} saatUbah={setHargaJual} galat={!!galat.hargaJual} />
            </Bidang>
          )}
        </div>

        {!a ? (
          <p className="teks-redup">Pilih peralatan untuk melihat nilai buku dan jurnalnya.</p>
        ) : (
          <div className="space-y-4 rounded-xl border border-slate-200 p-4">
            {a.sudahDiajukan && <Peringatan jenis="awas">Aset ini sudah punya pengajuan yang menunggu keputusan Owner.</Peringatan>}
            {tahanJadwal && <Peringatan jenis="awas">{tahanJadwal}</Peringatan>}
            <p className="teks-redup">{KEBIJAKAN_BULAN_PELEPASAN}</p>
            {hitung && (
              <>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div><div className="teks-label">Perolehan</div><div className="font-semibold"><Rupiah nilai={a.nilaiPerolehan} /></div></div>
                  <div><div className="teks-label">Akumulasi disetujui</div><div className="font-semibold"><Rupiah nilai={hitung.akumulasi} /></div></div>
                  <div><div className="teks-label">Nilai buku</div><div className="font-semibold"><Rupiah nilai={hitung.nilaiBuku} /></div></div>
                  <div>
                    <div className="teks-label">{hitung.labaRugi < 0 ? "Rugi" : hitung.labaRugi > 0 ? "Laba" : "Laba/rugi"}</div>
                    <div className={`font-semibold ${hitung.labaRugi < 0 ? "text-rose-600" : ""}`}><Rupiah nilai={Math.abs(hitung.labaRugi)} /></div>
                  </div>
                </div>
                <details open>
                  <summary className="cursor-pointer text-sm font-semibold text-slate-800">Jurnal pelepasan (dibuat saat disetujui Owner)</summary>
                  <div className="mt-3"><TabelJurnal baris={hitung.jurnal} namaAkun={namaAkun} /></div>
                </details>
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Tombol type="submit" varian="utama" ikon={<Send className="size-4" />} memuat={memuat} disabled={!a || tertahan}>Ajukan ke Owner</Tombol>
          <TautanTombol href={alamatKembali} varian="hantu">Batal</TautanTombol>
        </div>
      </form>
    </Kartu>
  );
}
