"use client";

import { useEffect, type RefObject } from "react";

/**
 * Sesudah form gagal dikirim, fokuskan isian pertama yang salah (aria-invalid) di dalam `akar`, supaya pengguna papan
 * ketik dan pembaca layar langsung sampai ke isian itu beserta pesan galatnya (lihat aria-describedby di Isian.tsx).
 * `galat` = peta galat per isian dari server action; efek berjalan setiap kali peta galat baru dipasang.
 */
export function useFokusGalat(akar: RefObject<HTMLElement | null>, galat: Record<string, string>) {
  useEffect(() => {
    if (Object.keys(galat).length === 0) return;
    akar.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [akar, galat]);
}
