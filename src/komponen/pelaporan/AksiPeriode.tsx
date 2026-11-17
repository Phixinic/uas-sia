"use client";

import { Lock, LockOpen } from "lucide-react";
import { bukaKunciPeriode, kunciPeriode } from "@/lib/aksi/pelaporan/periode";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { labelPeriode } from "@/lib/inti/tanggal";

export function TombolKunci({ periode }: { periode: string }) {
  return (
    <TombolAksi aksi={() => kunciPeriode({ periode })} varian="utama" kecil={false} ikon={<Lock className="size-4" />} konfirmasi={{ judul: `Kunci ${labelPeriode(periode)}?`, pesan: "Periode yang dikunci menolak jurnal dan dokumen baru bertanggal di dalamnya atau di bulan sebelumnya. Owner bisa membukanya lagi dengan alasan, mulai dari periode terkunci yang paling akhir.", labelKonfirmasi: "Kunci periode" }}>
      Kunci periode
    </TombolAksi>
  );
}

export function TombolBukaKunci({ periode }: { periode: string }) {
  return (
    <TombolAksi aksi={(alasan) => bukaKunciPeriode({ periode, alasan })} varian="garis" ikon={<LockOpen className="size-4" />} konfirmasi={{ judul: `Buka kunci ${labelPeriode(periode)}`, pesan: "Alasan dicatat di riwayat periode.", perluAlasan: true, labelAlasan: `Alasan membuka kunci ${labelPeriode(periode)}`, labelKonfirmasi: "Buka kunci" }}>
      Buka kunci
    </TombolAksi>
  );
}
