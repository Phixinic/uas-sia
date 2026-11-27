"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { ajukanSettingGaji } from "@/lib/aksi/master/setting-gaji";
import { useAksi } from "@/komponen/ui/useAksi";
import { useFokusGalat } from "@/komponen/ui/useFokusGalat";
import Kartu from "@/komponen/ui/Kartu";
import Tombol from "@/komponen/ui/Tombol";
import Peringatan from "@/komponen/ui/Peringatan";
import { AreaTeks, Bidang, Pilihan } from "@/komponen/ui/Isian";
import { kunciPenutup, labelBulanTahun, labelPeriode, NAMA_BULAN, periodeDariBulanTahun, tambahBulan, bulanDari, tahunDari } from "@/lib/inti/tanggal";
import { LABEL_JENIS_PERUBAHAN, pengamanBerlaku, type JenisPerubahan } from "@/lib/inti/setting-gaji";
import { rupiah } from "@/lib/format";
import type { OpsiPilihan } from "@/lib/skema/master";
import type { BahanFormSetting } from "@/lib/data/master/setting-gaji";

type Nilai = {
  karyawanKode: string;
  jenisPerubahan: JenisPerubahan | "";
  jabatanKode: string;
  golonganKode: string;
  tunjanganKodes: string[];
  bulan: string;
  tahun: string;
  alasan: string;
};

/** Nilai awal form untuk satu karyawan: isi versi berlaku sekarang, jenis menurut riwayatnya, bulan berlaku paling awal yang wajar. */
function awalUntuk(kode: string, bahan: BahanFormSetting, sekarang: string): Nilai {
  const b = bahan[kode];
  const adaDisetujui = !!b?.versi.some((v) => v.status === "DISETUJUI");
  const palingAwal = b ? pengamanBerlaku(sekarang, b.slip, b.versi).palingAwal : null;
  // Setting awal bawaannya berlaku bulan ini; perubahan bawaannya bulan depan. Tidak pernah sebelum slip terakhir yang dibekukan.
  let berlaku = adaDisetujui ? tambahBulan(sekarang, 1) : sekarang;
  if (palingAwal && palingAwal > berlaku) berlaku = palingAwal;
  const v = b?.aktifSekarang;
  return {
    karyawanKode: kode,
    jenisPerubahan: kode ? (adaDisetujui ? "PROMOSI" : "SETTING_AWAL") : "",
    jabatanKode: v?.jabatanKode ?? "",
    golonganKode: v?.golonganKode ?? "",
    tunjanganKodes: v?.tunjanganKodes ?? [],
    bulan: String(bulanDari(berlaku)),
    tahun: String(tahunDari(berlaku)),
    alasan: "",
  };
}

export default function FormSettingGaji({ opsi, bahan, terkunci, sekarang, periodeBerlaku, karyawanAwal, alamatKembali }: {
  opsi: { karyawan: OpsiPilihan[]; jabatan: OpsiPilihan[]; golongan: OpsiPilihan[]; tunjangan: OpsiPilihan[] };
  bahan: BahanFormSetting;
  terkunci: string[];
  sekarang: string;
  /** Periode yang bisa dipilih sebagai bulan berlaku (semua baris periode dan 12 bulan ke depan). */
  periodeBerlaku: string[];
  karyawanAwal: string | null;
  alamatKembali: string;
}) {
  const router = useRouter();
  const id = useId();
  const { jalankan, memuat } = useAksi();
  const [nilai, setNilai] = useState<Nilai>(() => awalUntuk(karyawanAwal ?? "", bahan, sekarang));
  const [galat, setGalat] = useState<Record<string, string>>({});
  const akar = useRef<HTMLFormElement>(null);
  useFokusGalat(akar, galat);
  const ubah = <K extends keyof Nilai>(k: K, v: Nilai[K]) => setNilai((n) => ({ ...n, [k]: v }));

  const milik = nilai.karyawanKode ? bahan[nilai.karyawanKode] : undefined;
  const adaDisetujui = !!milik?.versi.some((v) => v.status === "DISETUJUI");
  const berlaku = periodeDariBulanTahun(nilai.bulan, nilai.tahun);
  // Tahun tampil sendiri; bulan mengikuti tahun yang dipilih (hanya bulan yang ada di daftar periode).
  const opsiTahun = [...new Set(periodeBerlaku.map(tahunDari))].sort((a, b) => a - b);
  const bulanDiTahun = periodeBerlaku.filter((p) => tahunDari(p) === Number(nilai.tahun)).map(bulanDari);
  const gantiTahun = (t: string) => {
    const ada = periodeBerlaku.filter((p) => tahunDari(p) === Number(t)).map(bulanDari);
    setNilai((n) => ({ ...n, tahun: t, bulan: ada.includes(Number(n.bulan)) ? n.bulan : String(ada[0] ?? n.bulan) }));
  };

  // Pratinjau pengaman yang sama dengan server: periode tertutup, slip yang sudah diajukan atau dibayar, slip draf terdampak.
  const cek = useMemo(() => {
    if (!berlaku || !milik) return null;
    const penutup = kunciPenutup(berlaku, terkunci);
    const p = pengamanBerlaku(berlaku, milik.slip, milik.versi);
    const kembar = milik.versi.find((v) => v.status === "DIAJUKAN" && v.berlakuMulai === berlaku);
    return { penutup, p, kembar };
  }, [berlaku, milik, terkunci]);

  const pilihKaryawan = (kode: string) => {
    setGalat({});
    setNilai({ ...awalUntuk(kode, bahan, sekarang), alasan: nilai.alasan });
  };

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat({});
    const h = await jalankan(() => ajukanSettingGaji({ ...nilai }), { setelahBerhasil: () => router.push(alamatKembali) });
    if (!h.ok && h.galatIsian) setGalat(h.galatIsian);
  };

  const jenisOpsi: JenisPerubahan[] = !nilai.karyawanKode ? [] : adaDisetujui ? ["PROMOSI", "DEMOSI", "PENYESUAIAN"] : ["SETTING_AWAL"];
  const pilihanAktif = (daftar: OpsiPilihan[], terpilih: string | string[]) =>
    daftar.filter((o) => !o.nonaktif || (Array.isArray(terpilih) ? terpilih.includes(o.nilai) : o.nilai === terpilih));
  const sekarangV = milik?.aktifSekarang ?? null;

  return (
    <Kartu>
      <form ref={akar} onSubmit={kirim} className="space-y-4" aria-label="Form pengajuan setting gaji" noValidate>
        <div>
          <h2 className="judul-kartu">Ajukan setting gaji</h2>
          <p className="mt-0.5 text-sm text-slate-600">Setting lama tidak ditimpa. Pengajuan ini menjadi versi baru yang berlaku mulai bulan yang dipilih setelah Owner menyetujuinya.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Bidang label="Karyawan" htmlFor={`${id}-karyawan`} wajib galat={galat.karyawanKode}>
            <Pilihan id={`${id}-karyawan`} value={nilai.karyawanKode} galat={!!galat.karyawanKode} onChange={(e) => pilihKaryawan(e.target.value)}>
              <option value="">Pilih</option>
              {pilihanAktif(opsi.karyawan, nilai.karyawanKode).map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
            </Pilihan>
          </Bidang>
          <Bidang
            label="Jenis perubahan"
            htmlFor={`${id}-jenis`}
            wajib
            galat={galat.jenisPerubahan}
            petunjuk={nilai.karyawanKode && !adaDisetujui ? "Karyawan ini belum punya setting gaji yang disetujui." : undefined}
          >
            <Pilihan id={`${id}-jenis`} value={nilai.jenisPerubahan} galat={!!galat.jenisPerubahan} onChange={(e) => ubah("jenisPerubahan", e.target.value as JenisPerubahan)} disabled={!nilai.karyawanKode}>
              {!nilai.karyawanKode && <option value="">Pilih karyawan dulu</option>}
              {jenisOpsi.map((j) => <option key={j} value={j}>{LABEL_JENIS_PERUBAHAN[j]}</option>)}
            </Pilihan>
          </Bidang>
        </div>

        {sekarangV && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
            Berlaku sekarang ({sekarangV.kode}, mulai {labelPeriode(sekarangV.berlakuMulai)}): {sekarangV.jabatan}, {sekarangV.golongan} {rupiah(sekarangV.gajiPokok)}, estimasi bruto {rupiah(sekarangV.estimasiBruto)}.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Bidang label="Jabatan" htmlFor={`${id}-jabatan`} wajib galat={galat.jabatanKode}>
            <Pilihan id={`${id}-jabatan`} value={nilai.jabatanKode} galat={!!galat.jabatanKode} onChange={(e) => ubah("jabatanKode", e.target.value)}>
              <option value="">Pilih</option>
              {pilihanAktif(opsi.jabatan, nilai.jabatanKode).map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
            </Pilihan>
          </Bidang>
          <Bidang label="Gaji pokok" htmlFor={`${id}-golongan`} wajib galat={galat.golonganKode}>
            <Pilihan id={`${id}-golongan`} value={nilai.golonganKode} galat={!!galat.golonganKode} onChange={(e) => ubah("golonganKode", e.target.value)}>
              <option value="">Pilih</option>
              {pilihanAktif(opsi.golongan, nilai.golonganKode).map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
            </Pilihan>
          </Bidang>
          <Bidang label="Tunjangan" htmlFor={`${id}-tunjangan`} galat={galat.tunjanganKodes} className="sm:col-span-2">
            <div id={`${id}-tunjangan`} className="flex flex-wrap gap-x-5 gap-y-2" role="group" aria-label="Tunjangan">
              {pilihanAktif(opsi.tunjangan, nilai.tunjanganKodes).map((o) => (
                <label key={o.nilai} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-aksen"
                    checked={nilai.tunjanganKodes.includes(o.nilai)}
                    onChange={(e) => ubah("tunjanganKodes", e.target.checked ? [...nilai.tunjanganKodes, o.nilai] : nilai.tunjanganKodes.filter((x) => x !== o.nilai))}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </Bidang>
        </div>

        <fieldset className="space-y-2">
          <legend className="label">Berlaku mulai<span className="text-rose-600"> *</span></legend>
          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <Bidang label="Tahun" htmlFor={`${id}-tahun`} galat={galat.tahun && galat.tahun !== galat.bulan ? galat.tahun : undefined}>
              <Pilihan id={`${id}-tahun`} value={nilai.tahun} galat={!!galat.tahun} onChange={(e) => gantiTahun(e.target.value)}>
                {opsiTahun.map((t) => <option key={t} value={String(t)}>{t}</option>)}
              </Pilihan>
            </Bidang>
            <Bidang label="Bulan" htmlFor={`${id}-bulan`} galat={galat.bulan}>
              <Pilihan id={`${id}-bulan`} value={nilai.bulan} galat={!!galat.bulan} onChange={(e) => ubah("bulan", e.target.value)}>
                {NAMA_BULAN.map((b, i) => (bulanDiTahun.includes(i + 1) || String(i + 1) === nilai.bulan ? <option key={b} value={String(i + 1)}>{b}</option> : null))}
              </Pilihan>
            </Bidang>
          </div>
        </fieldset>

        {cek && berlaku && (
          <div className="space-y-2" aria-live="polite">
            {cek.penutup ? (
              <Peringatan jenis="galat">{labelBulanTahun(berlaku)} sudah tertutup ({labelPeriode(cek.penutup)} dikunci). Bulan berlaku harus periode yang masih terbuka.</Peringatan>
            ) : cek.p.galat ? (
              <Peringatan jenis="galat">{cek.p.galat}</Peringatan>
            ) : cek.kembar ? (
              <Peringatan jenis="galat">Sudah ada pengajuan {cek.kembar.kode} berlaku {labelPeriode(berlaku)} yang menunggu Owner.</Peringatan>
            ) : cek.p.drafTerdampak.length ? (
              <Peringatan jenis="awas">
                Slip draf {cek.p.drafTerdampak.map((s) => s.no).join(", ")} ada di bulan berlaku atau sesudahnya. Slip itu tidak dihapus, tetapi setelah Owner menyetujui, HRD wajib menghitung ulang sebelum gajinya bisa diajukan.
              </Peringatan>
            ) : (
              <Peringatan>
                Setelah disetujui, slip {labelPeriode(berlaku)} dan sesudahnya memakai setting ini. Slip bulan sebelumnya tetap memakai setting lama, termasuk bila dihitung ulang.
              </Peringatan>
            )}
          </div>
        )}

        <Bidang label="Alasan pengajuan" htmlFor={`${id}-alasan`} wajib galat={galat.alasan} petunjuk="Contoh: promosi menjadi Operator Sound & Lighting sesuai SK Direktur 12/2026.">
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
