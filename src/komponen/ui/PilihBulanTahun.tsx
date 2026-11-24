"use client";

/*
 * Dua kontrol periode terpisah, Bulan (Januari sampai Desember) dan Tahun, yang disimpan di query string
 * (?bulan=11&tahun=2026). Dipakai semua halaman berperiode. Pilihan Bulan selalu berisi 12 bulan; bulan tanpa data
 * ditangani halamannya dengan keadaan kosong. Pilihan Tahun diturunkan dari `tersedia` (periode, jurnal, pembelian)
 * ditambah tahun berjalan dan tahun yang sedang dipilih. Mengganti tahun mempertahankan bulan yang dipilih.
 * `semua` menambah pilihan "Semua" di Tahun (?tahun=semua), dan Bulan dinonaktifkan selama pilihan itu aktif.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NAMA_BULAN, bulanDari, periodeIni, tahunDari } from "@/lib/inti/tanggal";

export default function PilihBulanTahun({ periode, tersedia, semua, labelBulan = "Bulan", labelTahun = "Tahun", pertahankan = true, idAwalan = "pilih", keteranganTahun }: {
  /** "YYYY-MM" atau "semua". */
  periode: string;
  /** Periode yang punya data ("YYYY-MM"); dipakai hanya untuk menurunkan daftar Tahun. */
  tersedia: string[];
  /** Label pilihan semua periode di Tahun, misalnya "Semua periode". Kosong = tidak ada pilihan itu. */
  semua?: string;
  labelBulan?: string;
  labelTahun?: string;
  /** true = parameter lain di URL dipertahankan; false = dibuang (halaman SDM dan konversi). */
  pertahankan?: boolean;
  /** Awalan id kontrol: `${idAwalan}-bulan` dan `${idAwalan}-tahun`. */
  idAwalan?: string;
  /** Teks kecil sesudah angka tahun, misalnya penanda tahun berjalan. */
  keteranganTahun?: Record<number, string>;
}) {
  const router = useRouter();
  const jalur = usePathname();
  const cari = useSearchParams();
  const adaSemua = !!semua;
  const pilihSemua = periode === "semua";
  const tahun = pilihSemua ? null : tahunDari(periode);
  const bulan = pilihSemua ? null : bulanDari(periode);
  const tahunData = new Set([...tersedia.map(tahunDari), tahunDari(periodeIni())]);
  if (tahun !== null) tahunData.add(tahun);
  const daftarTahun = [...tahunData].sort((a, b) => b - a);

  const pergi = (b: number | null, t: number | "semua") => {
    const p = new URLSearchParams(pertahankan ? cari.toString() : "");
    p.delete("periode");
    if (t === "semua") {
      p.set("tahun", "semua");
      p.delete("bulan");
    } else {
      p.set("bulan", String(b));
      p.set("tahun", String(t));
    }
    router.push(`${jalur}?${p.toString()}`);
  };

  const gantiTahun = (nilai: string) => {
    if (nilai === "semua") return pergi(null, "semua");
    pergi(bulan ?? bulanDari(periodeIni()), Number(nilai));
  };

  return (
    <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Periode">
      <div className="bidang min-w-36">
        <label className="label" htmlFor={`${idAwalan}-bulan`}>{labelBulan}</label>
        <select
          id={`${idAwalan}-bulan`}
          className="isian"
          value={bulan === null ? "" : String(bulan)}
          disabled={pilihSemua}
          onChange={(e) => tahun !== null && pergi(Number(e.target.value), tahun)}
        >
          {pilihSemua && <option value="">Semua bulan</option>}
          {NAMA_BULAN.map((nama, i) => (
            <option key={nama} value={String(i + 1)}>
              {nama}
            </option>
          ))}
        </select>
      </div>
      <div className="bidang min-w-28">
        <label className="label" htmlFor={`${idAwalan}-tahun`}>{labelTahun}</label>
        <select id={`${idAwalan}-tahun`} className="isian" value={pilihSemua ? "semua" : String(tahun)} onChange={(e) => gantiTahun(e.target.value)}>
          {adaSemua && <option value="semua">{semua}</option>}
          {daftarTahun.map((t) => (
            <option key={t} value={String(t)}>
              {t}{keteranganTahun?.[t] ? ` ${keteranganTahun[t]}` : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
