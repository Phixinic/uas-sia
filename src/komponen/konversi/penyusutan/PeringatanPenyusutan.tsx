/*
 * Peringatan (komponen server) bila ada bulan sampai periode laporan yang penyusutannya belum diproses, jadi beban
 * penyusutan bulan itu belum masuk buku besar. Dipakai dashboard, Buku Besar, dan Neraca Saldo.
 */
import Link from "next/link";
import { bulanPenyusutanBelum } from "@/lib/data/konversi/penyusutan";
import { denganPeriode, labelPeriode } from "@/lib/inti/tanggal";
import Peringatan from "@/komponen/ui/Peringatan";

export default async function PeringatanPenyusutan({ sampai }: { sampai: string }) {
  const belum = await bulanPenyusutanBelum(sampai);
  if (!belum.length) return null;
  const daftar = belum.length > 3 ? `${belum.slice(0, 3).map(labelPeriode).join(", ")}, dan ${belum.length - 3} bulan lain` : belum.map(labelPeriode).join(", ");
  return (
    <Peringatan jenis="awas">
      Penyusutan {daftar} belum diproses, jadi bebannya belum masuk buku besar dan angka di sini belum lengkap.{" "}
      <Link className="font-medium underline" href={denganPeriode("/konversi/penyusutan", belum[0])}>Buka Proses Penyusutan</Link>
    </Peringatan>
  );
}
