"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Tombol from "@/komponen/ui/Tombol";
import { AreaTeks } from "@/komponen/ui/Isian";

/**
 * Dialog konfirmasi modal (elemen <dialog> bawaan: fokus terkunci, Esc menutup).
 * `perluAlasan` menampilkan kotak alasan wajib (untuk tolak, balik, buka kunci periode).
 * `saatKonfirmasi` boleh async; dialog tertutup sesudah fungsi selesai tanpa melempar galat.
 */
export default function DialogKonfirmasi({ terbuka, judul, pesan, labelKonfirmasi = "Lanjutkan", bahaya, perluAlasan, labelAlasan = "Alasan", memuat, saatTutup, saatKonfirmasi }: {
  terbuka: boolean;
  judul: string;
  pesan?: ReactNode;
  labelKonfirmasi?: string;
  bahaya?: boolean;
  perluAlasan?: boolean;
  labelAlasan?: string;
  memuat?: boolean;
  saatTutup: () => void;
  saatKonfirmasi: (alasan: string) => void | Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [alasan, setAlasan] = useState("");
  const idAlasan = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (terbuka && !d.open) {
      setAlasan("");
      d.showModal();
    }
    if (!terbuka && d.open) d.close();
  }, [terbuka]);

  const bisaKirim = !perluAlasan || alasan.trim().length > 0;

  return (
    <dialog
      ref={ref}
      onClose={saatTutup}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 backdrop:bg-slate-900/40"
      style={{ boxShadow: "var(--shadow-melayang)" }}
    >
      <form
        method="dialog"
        className="flex flex-col gap-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (bisaKirim) await saatKonfirmasi(alasan.trim());
        }}
      >
        <h2 className="text-base font-semibold text-slate-900">{judul}</h2>
        {pesan && <div className="text-sm text-slate-600">{pesan}</div>}
        {perluAlasan && (
          <div className="bidang">
            <label className="label" htmlFor={idAlasan}>
              {labelAlasan} <span className="text-rose-600">*</span>
            </label>
            <AreaTeks id={idAlasan} value={alasan} onChange={(e) => setAlasan(e.target.value)} required autoFocus />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Tombol varian="garis" onClick={saatTutup} disabled={memuat}>
            Batal
          </Tombol>
          <Tombol type="submit" varian={bahaya ? "bahaya" : "utama"} memuat={memuat} disabled={!bisaKirim}>
            {labelKonfirmasi}
          </Tombol>
        </div>
      </form>
    </dialog>
  );
}
