"use client";

import { Bidang, Pilihan } from "@/komponen/ui/Isian";
import { NAMA_BULAN, bulanDari, tahunDari } from "@/lib/inti/tanggal";

/**
 * Pilihan "Berlaku mulai" berupa Tahun lalu Bulan terpisah (sama dengan form setting gaji). Tahun tampil sendiri; pilihan
 * bulan mengikuti tahun yang dipilih dan hanya berisi bulan di daftar periodeBerlaku.
 */
export default function PilihBerlaku({ id, bulan, tahun, periodeBerlaku, galat, onChange, label = "Berlaku mulai" }: {
  id: string;
  bulan: string;
  tahun: string;
  periodeBerlaku: string[];
  galat: Record<string, string>;
  onChange: (v: { bulan: string; tahun: string }) => void;
  label?: string;
}) {
  const opsiTahun = [...new Set(periodeBerlaku.map(tahunDari))].sort((a, b) => a - b);
  const bulanDiTahun = periodeBerlaku.filter((p) => tahunDari(p) === Number(tahun)).map(bulanDari);
  const gantiTahun = (t: string) => {
    const ada = periodeBerlaku.filter((p) => tahunDari(p) === Number(t)).map(bulanDari);
    onChange({ tahun: t, bulan: ada.includes(Number(bulan)) ? bulan : String(ada[0] ?? bulan) });
  };
  return (
    <fieldset className="space-y-2">
      <legend className="label">{label}<span className="text-rose-600"> *</span></legend>
      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <Bidang label="Tahun" htmlFor={`${id}-tahun`} galat={galat.tahun && galat.tahun !== galat.bulan ? galat.tahun : undefined}>
          <Pilihan id={`${id}-tahun`} value={tahun} galat={!!galat.tahun} onChange={(e) => gantiTahun(e.target.value)}>
            {opsiTahun.map((t) => <option key={t} value={String(t)}>{t}</option>)}
          </Pilihan>
        </Bidang>
        <Bidang label="Bulan" htmlFor={`${id}-bulan`} galat={galat.bulan}>
          <Pilihan id={`${id}-bulan`} value={bulan} galat={!!galat.bulan} onChange={(e) => onChange({ bulan: e.target.value, tahun })}>
            {NAMA_BULAN.map((b, i) => (bulanDiTahun.includes(i + 1) || String(i + 1) === bulan ? <option key={b} value={String(i + 1)}>{b}</option> : null))}
          </Pilihan>
        </Bidang>
      </div>
    </fieldset>
  );
}
