"use client";

/* Tombol hapus dan ubah per baris di halaman Event & Kehadiran. Visibilitas dijaga pemanggil; server action memeriksa peran sendiri. */
import { Pencil, Trash2 } from "lucide-react";
import { hapusEvent, hapusKehadiran, hapusPenugasan, hapusSesi } from "@/lib/aksi/fee-event/event";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { TautanTombol } from "@/komponen/ui/Tombol";
import { useRouter } from "next/navigation";
import { useAksi } from "@/komponen/ui/useAksi";
import Tombol from "@/komponen/ui/Tombol";
import DialogKonfirmasi from "@/komponen/ui/DialogKonfirmasi";
import { useState } from "react";

type Jenis = "sesi" | "penugasan" | "kehadiran";
const AKSI_HAPUS: Record<Jenis, (input: { id: number }) => ReturnType<typeof hapusSesi>> = { sesi: hapusSesi, penugasan: hapusPenugasan, kehadiran: hapusKehadiran };

export function AksiBaris({ jenis, id, ubahHref, judulHapus, pesanHapus, labelUbah = "Ubah", kiri }: {
  jenis: Jenis;
  id: number;
  ubahHref: string;
  judulHapus: string;
  pesanHapus?: string;
  labelUbah?: string;
  /** Rata kiri (di kartu layar sempit); bawaannya rata kanan seperti kolom aksi tabel. */
  kiri?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${kiri ? "" : "justify-end"}`}>
      <TautanTombol href={ubahHref} kecil ikon={<Pencil className="size-4" />}>{labelUbah}</TautanTombol>
      <TombolAksi aksi={() => AKSI_HAPUS[jenis]({ id })} varian="bahaya" ikon={<Trash2 className="size-4" />} judul={judulHapus} konfirmasi={{ judul: judulHapus, pesan: pesanHapus }}>
        Hapus
      </TombolAksi>
    </div>
  );
}

/** Hapus event (hanya bila belum ada kehadiran dan belum pernah dilaporkan), lalu kembali ke daftar. */
export function TombolHapusEvent({ kode, nama }: { kode: string; nama: string }) {
  const router = useRouter();
  const { jalankan, memuat } = useAksi();
  const [buka, setBuka] = useState(false);
  return (
    <>
      <Tombol varian="bahaya" kecil ikon={<Trash2 className="size-4" />} onClick={() => setBuka(true)}>Hapus event</Tombol>
      <DialogKonfirmasi
        terbuka={buka}
        judul={`Hapus ${kode}?`}
        pesan={`${nama} beserta sesi dan penugasannya dihapus. Event yang sudah punya kehadiran atau pernah dilaporkan tidak bisa dihapus.`}
        labelKonfirmasi="Hapus event"
        bahaya
        memuat={memuat}
        saatTutup={() => setBuka(false)}
        saatKonfirmasi={async () => {
          const h = await jalankan(() => hapusEvent({ eventKode: kode }), { setelahBerhasil: () => router.push("/fee-event/event") });
          if (h.ok) setBuka(false);
        }}
      />
    </>
  );
}
