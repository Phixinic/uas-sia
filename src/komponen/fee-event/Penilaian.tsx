/*
 * Tampilan baca penilaian satu kehadiran (lencana, jam diakui, catatan, penilai). Dipakai halaman HRD, kapten, dan Owner.
 */
import Lencana from "@/komponen/ui/Lencana";
import { labelDurasi } from "@/lib/inti/fee-event";
import type { KehadiranBahan } from "@/lib/data/fee-event/bahan";

export function LencanaPenilaian({ k, peran }: { k: Pick<KehadiranBahan, "penilaian">; peran: "KAPTEN" | "CREW" }) {
  if (k.penilaian === "SESUAI") return <Lencana warna="hijau">Sesuai</Lencana>;
  if (k.penilaian === "KURANG") return <Lencana warna="merah">Kurang</Lencana>;
  return <Lencana warna="kuning">{peran === "KAPTEN" ? "Dinilai Owner" : "Belum dinilai"}</Lencana>;
}

export function KeteranganPenilaian({ k }: { k: KehadiranBahan }) {
  if (!k.penilaian) return null;
  return (
    <div className="mt-1 space-y-0.5 text-[12px] text-slate-600">
      {k.penilaian === "KURANG" && (
        <div>
          Diakui <span className="font-semibold text-rose-700">{labelDurasi(k.menitDiakui ?? 0)}</span> dari {labelDurasi(k.menitTercatat)}
        </div>
      )}
      {k.catatanNilai && <div className={k.penilaian === "KURANG" ? "text-rose-700" : ""}>&ldquo;{k.catatanNilai}&rdquo;</div>}
      {k.dinilaiOleh && <div className="text-slate-400">oleh {k.dinilaiOleh}</div>}
    </div>
  );
}
