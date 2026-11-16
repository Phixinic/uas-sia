"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/komponen/ui/Toast";
import type { HasilAksi } from "@/lib/server/aksi";

/**
 * Menjalankan server action dari komponen klien: status memuat, toast sukses/galat, lalu segarkan halaman.
 *   const { jalankan, memuat } = useAksi();
 *   jalankan(() => postingPembelian({ no }), { setelahBerhasil: () => router.push("...") });
 * Mengembalikan hasil aksi supaya pemanggil bisa membaca galatIsian.
 */
export function useAksi() {
  const [memuat, mulai] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const jalankan = useCallback(
    <T,>(fn: () => Promise<HasilAksi<T>>, opsi?: { setelahBerhasil?: (h: Extract<HasilAksi<T>, { ok: true }>) => void; tanpaToastSukses?: boolean }) =>
      new Promise<HasilAksi<T>>((selesai) => {
        mulai(async () => {
          let h: HasilAksi<T>;
          try {
            h = await fn();
          } catch {
            h = { ok: false, galat: "Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi." };
          }
          if (h.ok) {
            if (!opsi?.tanpaToastSukses) toast(h.pesan, "sukses");
            opsi?.setelahBerhasil?.(h);
            router.refresh();
          } else toast(h.galat, "galat");
          selesai(h);
        });
      }),
    [toast, router],
  );
  return { jalankan, memuat };
}
