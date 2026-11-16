"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

type JenisToast = "sukses" | "galat" | "info";
type ItemToast = { id: number; jenis: JenisToast; pesan: string };

const KonteksToast = createContext<(pesan: string, jenis?: JenisToast) => void>(() => {});

/** Pasang sekali di layout. Panggil useToast() di komponen klien untuk menampilkan pesan. */
export function PenyediaToast({ children }: { children: ReactNode }) {
  const [daftar, setDaftar] = useState<ItemToast[]>([]);
  const tutup = useCallback((id: number) => setDaftar((d) => d.filter((t) => t.id !== id)), []);
  const tampilkan = useCallback(
    (pesan: string, jenis: JenisToast = "sukses") => {
      const id = Date.now() + Math.random();
      setDaftar((d) => [...d.slice(-3), { id, jenis, pesan }]);
      setTimeout(() => tutup(id), jenis === "galat" ? 7000 : 4500);
    },
    [tutup],
  );
  return (
    <KonteksToast.Provider value={tampilkan}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
        {daftar.map((t) => {
          const Ikon = t.jenis === "sukses" ? CircleCheck : t.jenis === "galat" ? CircleAlert : Info;
          const warna = t.jenis === "sukses" ? "border-emerald-200 text-emerald-900" : t.jenis === "galat" ? "border-rose-200 text-rose-900" : "border-sky-200 text-sky-900";
          return (
            <div key={t.id} className={`animasi-muncul pointer-events-auto flex items-start gap-2 rounded-xl border bg-white px-3.5 py-3 text-[13px] ${warna}`} style={{ boxShadow: "var(--shadow-melayang)" }}>
              <Ikon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1">{t.pesan}</p>
              <button type="button" onClick={() => tutup(t.id)} className="rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Tutup pesan">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </KonteksToast.Provider>
  );
}

export const useToast = () => useContext(KonteksToast);
