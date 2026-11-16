"use client";

import { useState, type ReactNode } from "react";
import Tombol, { type VarianTombol } from "@/komponen/ui/Tombol";
import DialogKonfirmasi from "@/komponen/ui/DialogKonfirmasi";
import { useAksi } from "@/komponen/ui/useAksi";
import type { HasilAksi } from "@/lib/server/aksi";

/**
 * Tombol yang menjalankan satu server action, dengan dialog konfirmasi opsional.
 *   <TombolAksi aksi={() => postingPembelian({ no })} konfirmasi={{ judul: "Posting BP-2026-0007?" }}>Posting</TombolAksi>
 *   <TombolAksi aksi={(alasan) => tolakJurnal({ no, alasan })} varian="bahaya" konfirmasi={{ judul: "Tolak jurnal", perluAlasan: true }}>Tolak</TombolAksi>
 */
export default function TombolAksi({ aksi, konfirmasi, varian = "garis", kecil = true, ikon, children, disabled, judul }: {
  aksi: (alasan: string) => Promise<HasilAksi<unknown>>;
  konfirmasi?: { judul: string; pesan?: ReactNode; labelKonfirmasi?: string; perluAlasan?: boolean; labelAlasan?: string; bahaya?: boolean };
  varian?: VarianTombol;
  kecil?: boolean;
  ikon?: ReactNode;
  disabled?: boolean;
  /** Teks bantu dan nama aksesibel bila label tampil dipersingkat. */
  judul?: string;
  children: ReactNode;
}) {
  const { jalankan, memuat } = useAksi();
  const [buka, setBuka] = useState(false);
  const kerjakan = async (alasan: string) => {
    const h = await jalankan(() => aksi(alasan));
    if (h.ok) setBuka(false);
  };
  return (
    <>
      <Tombol varian={varian} kecil={kecil} ikon={ikon} memuat={memuat && !buka} disabled={disabled} title={judul} aria-label={judul} onClick={() => (konfirmasi ? setBuka(true) : kerjakan(""))}>
        {children}
      </Tombol>
      {konfirmasi && (
        <DialogKonfirmasi
          terbuka={buka}
          judul={konfirmasi.judul}
          pesan={konfirmasi.pesan}
          labelKonfirmasi={konfirmasi.labelKonfirmasi ?? (typeof children === "string" ? children : "Lanjutkan")}
          perluAlasan={konfirmasi.perluAlasan}
          labelAlasan={konfirmasi.labelAlasan}
          bahaya={konfirmasi.bahaya ?? varian === "bahaya"}
          memuat={memuat}
          saatTutup={() => setBuka(false)}
          saatKonfirmasi={kerjakan}
        />
      )}
    </>
  );
}
