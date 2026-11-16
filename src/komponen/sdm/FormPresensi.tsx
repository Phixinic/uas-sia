"use client";

/* Form input atau ubah presensi harian. Terlambat dihitung server dari jadwal kerja jabatan karyawan. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { simpanPresensi } from "@/lib/aksi/sdm/presensi";
import { useAksi } from "@/komponen/ui/useAksi";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tombol, { TautanTombol } from "@/komponen/ui/Tombol";
import { Bidang, Isian, Pilihan } from "@/komponen/ui/Isian";
import { LABEL_ABSENSI } from "@/lib/format";
import { hitungTerlambat } from "@/lib/inti/penggajian";
import type { Absensi } from "@/generated/prisma/enums";

export type NilaiFormPresensi = { id: number | null; karyawanKode: string; tanggal: string; absensi: Absensi; jamMasuk: string; jamKeluar: string };
export type OpsiKaryawan = { kode: string; nama: string; siapInput: boolean; jamMasuk: string; jamKeluar: string };

export default function FormPresensi({ awal, karyawan, alamatKembali }: { awal: NilaiFormPresensi; karyawan: OpsiKaryawan[]; alamatKembali: string }) {
  const router = useRouter();
  const { jalankan, memuat } = useAksi();
  const [f, setF] = useState(awal);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const ubah = (p: Partial<NilaiFormPresensi>) => setF((x) => ({ ...x, ...p }));
  const hadir = f.absensi === "HADIR";
  const pilih = karyawan.find((k) => k.kode === f.karyawanKode);
  const telat = pilih && hadir && f.jamMasuk ? hitungTerlambat("HADIR", f.jamMasuk, pilih.jamMasuk) : 0;

  const kirim = () =>
    jalankan(() => simpanPresensi(f), { setelahBerhasil: () => router.push(alamatKembali) }).then((h) => setGalat(h.ok ? {} : (h.galatIsian ?? {})));

  return (
    <Kartu rapat>
      <KepalaKartu judul={f.id ? "Ubah presensi" : "Input presensi"} keterangan="Keterlambatan dihitung otomatis dari jadwal kerja jabatan." />
      <form
        className="space-y-4 p-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          kirim();
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Bidang label="Karyawan" htmlFor="pr-karyawan" wajib galat={galat.karyawanKode}>
            <Pilihan id="pr-karyawan" value={f.karyawanKode} galat={!!galat.karyawanKode} onChange={(e) => ubah({ karyawanKode: e.target.value })}>
              <option value="">Pilih karyawan</option>
              {karyawan.map((k) => (
                <option key={k.kode} value={k.kode} disabled={!k.siapInput}>
                  {k.kode} · {k.nama}
                  {k.siapInput ? "" : " (belum ada setting gaji)"}
                </option>
              ))}
            </Pilihan>
          </Bidang>
          <Bidang label="Tanggal" htmlFor="pr-tanggal" wajib galat={galat.tanggal}>
            <Isian id="pr-tanggal" type="date" value={f.tanggal} galat={!!galat.tanggal} onChange={(e) => ubah({ tanggal: e.target.value })} />
          </Bidang>
          <Bidang label="Absensi" htmlFor="pr-absensi" wajib galat={galat.absensi}>
            <Pilihan id="pr-absensi" value={f.absensi} onChange={(e) => ubah({ absensi: e.target.value as Absensi })}>
              {(Object.keys(LABEL_ABSENSI) as Absensi[]).map((a) => (
                <option key={a} value={a}>
                  {LABEL_ABSENSI[a]}
                </option>
              ))}
            </Pilihan>
          </Bidang>
          {hadir && (
            <>
              <Bidang label="Jam masuk" htmlFor="pr-masuk" wajib galat={galat.jamMasuk} petunjuk={pilih?.jamMasuk ? `Jadwal ${pilih.jamMasuk} sampai ${pilih.jamKeluar}${telat ? `, terlambat ${telat} menit` : ""}` : undefined}>
                <Isian id="pr-masuk" type="time" value={f.jamMasuk} galat={!!galat.jamMasuk} onChange={(e) => ubah({ jamMasuk: e.target.value })} />
              </Bidang>
              <Bidang label="Jam keluar" htmlFor="pr-keluar" wajib galat={galat.jamKeluar}>
                <Isian id="pr-keluar" type="time" value={f.jamKeluar} galat={!!galat.jamKeluar} onChange={(e) => ubah({ jamKeluar: e.target.value })} />
              </Bidang>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Tombol type="submit" varian="utama" memuat={memuat} ikon={<Save className="size-4" />}>
            Simpan
          </Tombol>
          <TautanTombol href={alamatKembali} varian="hantu">
            Batal
          </TautanTombol>
        </div>
      </form>
    </Kartu>
  );
}
