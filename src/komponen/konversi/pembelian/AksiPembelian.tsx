"use client";

/*
 * Tombol aksi per baris pembelian. Visibilitas tombol mengikuti IZIN (src/lib/peran.ts);
 * server action tetap memeriksa peran sendiri, jadi menyembunyikan tombol hanya soal tampilan.
 */
import { Eye, Pencil, RotateCcw, Send, Trash2 } from "lucide-react";
import { balikPembelian, hapusPembelian, postingPembelian } from "@/lib/aksi/konversi/pembelian";
import TombolAksi from "@/komponen/ui/TombolAksi";
import { TautanTombol } from "@/komponen/ui/Tombol";
import { boleh, type Peran } from "@/lib/peran";
import { rupiah } from "@/lib/format";
import type { StatusPembelian } from "@/generated/prisma/enums";

export default function AksiPembelian({ no, status, total, peralatan, peran, alamat }: {
  no: string;
  status: StatusPembelian;
  total: number;
  peralatan: boolean;
  peran: Peran;
  alamat: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <TautanTombol href={`${alamat}?lihat=${no}`} kecil varian="hantu" ikon={<Eye className="size-4" />}>Lihat</TautanTombol>
      {status === "DRAFT" && boleh(peran, "pembelian.kelola-draf") && (
        <>
          <TautanTombol href={`${alamat}?form=${no}`} kecil ikon={<Pencil className="size-4" />}>Ubah</TautanTombol>
          <TombolAksi aksi={() => hapusPembelian({ no })} varian="bahaya" ikon={<Trash2 className="size-4" />} konfirmasi={{ judul: `Hapus draf ${no}?`, pesan: "Draf yang dihapus tidak bisa dikembalikan." }}>
            Hapus
          </TombolAksi>
        </>
      )}
      {status === "DRAFT" && boleh(peran, "pembelian.posting") && (
        <TombolAksi
          aksi={() => postingPembelian({ no })}
          varian="utama"
          ikon={<Send className="size-4" />}
          konfirmasi={{ judul: `Posting ${no}?`, pesan: `Jurnal umum ${rupiah(total)} langsung berlaku${peralatan ? " dan kartu aset beserta jadwal penyusutannya dibuat" : ""}.` }}
        >
          Posting
        </TombolAksi>
      )}
      {status === "DISETUJUI" && boleh(peran, "pembelian.balik") && (
        <TombolAksi
          aksi={(alasan) => balikPembelian({ no, alasan })}
          varian="bahaya"
          ikon={<RotateCcw className="size-4" />}
          konfirmasi={{
            judul: `Balik pembelian ${no}`,
            pesan: `Jurnal asli tetap ada. Sistem membuat jurnal pembalik bertanggal hari ini${peralatan ? " dan membatalkan kartu asetnya" : ""}.`,
            perluAlasan: true,
            labelAlasan: "Alasan membalik",
            labelKonfirmasi: "Balik pembelian",
          }}
        >
          Balik
        </TombolAksi>
      )}
    </div>
  );
}
