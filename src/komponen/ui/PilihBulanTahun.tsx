"use client";

/*
 * Dua kontrol periode terpisah, Bulan (Januari sampai Desember) dan Tahun, yang disimpan di query string
 * (?bulan=11&tahun=2026). Dipakai semua halaman berperiode. Tahun tampil sebagai pilihan sendiri, dan pilihan Bulan hanya
 * berisi bulan yang tersedia di tahun terpilih; saat tahun diganti dan bulannya tidak tersedia, dipilih bulan tersedia
 * terakhir di tahun itu.
 * `semua` menambah pilihan "Semua" di Tahun (?tahun=semua), dan Bulan dinonaktifkan selama pilihan itu aktif.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NAMA_BULAN, bulanDari, tahunDari } from "@/lib/inti/tanggal";

const pad = (n: number) => String(n).padStart(2, "0");

export default function PilihBulanTahun({ periode, tersedia, semua, labelBulan = "Bulan", labelTahun = "Tahun", pertahankan = true, idAwalan = "pilih", keteranganTahun }: {
  /** "YYYY-MM" atau "semua". */
  periode: string;
  /** Periode yang boleh dipilih ("YYYY-MM"). */
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
  const ada = new Set(tersedia);
  const daftarTahun = [...new Set(tersedia.map(tahunDari))].sort((a, b) => b - a);
  const tahun = pilihSemua ? null : tahunDari(periode);
  const bulan = pilihSemua ? null : bulanDari(periode);
  if (tahun !== null && !daftarTahun.includes(tahun)) daftarTahun.unshift(tahun);

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
    const t = Number(nilai);
    const b = bulan ?? 12;
    if (ada.has(`${t}-${pad(b)}`)) return pergi(b, t);
    const diTahun = tersedia.filter((x) => tahunDari(x) === t).sort();
    pergi(diTahun.length ? bulanDari(diTahun[diTahun.length - 1]) : b, t);
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
          {NAMA_BULAN.map((nama, i) => {
            const b = i + 1;
            const bisa = tahun !== null && (ada.has(`${tahun}-${pad(b)}`) || b === bulan);
            return bisa ? (
              <option key={nama} value={String(b)}>
                {nama}
              </option>
            ) : null;
          })}
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
