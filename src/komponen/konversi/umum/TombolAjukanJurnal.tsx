"use client";

import { Send } from "lucide-react";
import { ajukanJurnalKonversi } from "@/lib/aksi/konversi/penyusutan";
import TombolAksi from "@/komponen/ui/TombolAksi";

/** Mengajukan draf jurnal penyesuaian ke Owner. Hanya ditampilkan untuk peran yang punya izin jurnal-penyesuaian.ajukan. */
export default function TombolAjukanJurnal({ no, varian = "utama" }: { no: string; varian?: "utama" | "garis" }) {
  return (
    <TombolAksi
      aksi={() => ajukanJurnalKonversi({ no })}
      varian={varian}
      ikon={<Send className="size-4" />}
      konfirmasi={{ judul: `Ajukan ${no} ke Owner?`, pesan: "Setelah diajukan, jurnal menunggu keputusan Owner dan belum masuk buku besar.", labelKonfirmasi: "Ajukan" }}
    >
      Ajukan ke Owner
    </TombolAksi>
  );
}
