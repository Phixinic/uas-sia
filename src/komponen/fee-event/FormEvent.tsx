"use client";

/*
 * Form pencatatan event untuk HRD dan Owner: event, sesi, penugasan, dan kehadiran.
 * Validasi akhir ada di server action (src/lib/aksi/fee-event/event.ts); form hanya menampilkan galat per isian.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { simpanEvent, simpanKehadiran, simpanPenugasan, simpanSesi } from "@/lib/aksi/fee-event/event";
import { useAksi } from "@/komponen/ui/useAksi";
import { useFokusGalat } from "@/komponen/ui/useFokusGalat";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tombol, { TautanTombol } from "@/komponen/ui/Tombol";
import { AreaTeks, Bidang, Isian, Pilihan } from "@/komponen/ui/Isian";
import { LABEL_PERAN_EVENT, LABEL_SATUAN_TARIF, rupiah } from "@/lib/format";
import { labelDurasi, menitTercatat } from "@/lib/inti/fee-event";
import type { HasilAksi } from "@/lib/server/aksi";
import type { OpsiCrew, OpsiJabatanEvent } from "@/lib/data/fee-event/daftar";

/** Kerangka bersama: kartu, form, tombol Simpan dan Batal, galat per isian, fokus ke isian salah. */
function useForm<T extends object>(awal: T) {
  const [f, setF] = useState(awal);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const akar = useRef<HTMLFormElement>(null);
  useFokusGalat(akar, galat);
  return { f, ubah: (p: Partial<T>) => setF((x) => ({ ...x, ...p })), galat, setGalat, akar };
}

function BingkaiForm({ judul, keterangan, akar, memuat, alamatKembali, kirim, children }: {
  judul: string;
  keterangan?: string;
  akar: React.RefObject<HTMLFormElement | null>;
  memuat: boolean;
  alamatKembali: string;
  kirim: () => void;
  children: React.ReactNode;
}) {
  return (
    <Kartu rapat>
      <KepalaKartu judul={judul} keterangan={keterangan} />
      <form
        ref={akar}
        className="space-y-4 p-5"
        noValidate
        aria-label={judul}
        onSubmit={(e) => {
          e.preventDefault();
          kirim();
        }}
      >
        {children}
        <div className="flex flex-wrap gap-2">
          <Tombol type="submit" varian="utama" memuat={memuat} ikon={<Save className="size-4" />}>Simpan</Tombol>
          <TautanTombol href={alamatKembali} varian="hantu">Batal</TautanTombol>
        </div>
      </form>
    </Kartu>
  );
}

function useKirim(alamatKembali: string, setGalat: (g: Record<string, string>) => void) {
  const router = useRouter();
  const { jalankan, memuat } = useAksi();
  const kirim = <D,>(fn: () => Promise<HasilAksi<D>>, tujuan?: (h: D | undefined) => string) =>
    jalankan(fn, { setelahBerhasil: (h) => router.push(tujuan ? tujuan(h.data) : alamatKembali) }).then((h) => setGalat(h.ok ? {} : (h.galatIsian ?? {})));
  return { kirim, memuat };
}

// ---------------------------------------------------------------- Event

export type NilaiFormEvent = { kode: string | null; nama: string; klien: string; tanggalMulai: string; tanggalSelesai: string };

export function FormEvent({ awal, alamatKembali }: { awal: NilaiFormEvent; alamatKembali: string }) {
  const { f, ubah, galat, setGalat, akar } = useForm(awal);
  const { kirim, memuat } = useKirim(alamatKembali, setGalat);
  return (
    <BingkaiForm
      judul={f.kode ? `Ubah ${f.kode}` : "Event baru"}
      keterangan="Sesudah event disimpan, tambahkan sesi, penugasan crew (minimal satu kapten), lalu kehadiran per sesi."
      akar={akar}
      memuat={memuat}
      alamatKembali={alamatKembali}
      kirim={() => kirim(() => simpanEvent(f), (d) => `/fee-event/event?lihat=${d?.kode ?? ""}`)}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Bidang label="Nama event" htmlFor="ev-nama" wajib galat={galat.nama} className="sm:col-span-2">
          <Isian id="ev-nama" value={f.nama} galat={!!galat.nama} onChange={(e) => ubah({ nama: e.target.value })} />
        </Bidang>
        <Bidang label="Klien" htmlFor="ev-klien" galat={galat.klien} className="sm:col-span-2">
          <Isian id="ev-klien" value={f.klien} galat={!!galat.klien} onChange={(e) => ubah({ klien: e.target.value })} />
        </Bidang>
        <Bidang label="Tanggal mulai" htmlFor="ev-mulai" wajib galat={galat.tanggalMulai}>
          <Isian id="ev-mulai" type="date" value={f.tanggalMulai} galat={!!galat.tanggalMulai} onChange={(e) => ubah({ tanggalMulai: e.target.value })} />
        </Bidang>
        <Bidang label="Tanggal selesai" htmlFor="ev-selesai" wajib galat={galat.tanggalSelesai} petunjuk="Jurnal fee memakai tanggal ini.">
          <Isian id="ev-selesai" type="date" value={f.tanggalSelesai} galat={!!galat.tanggalSelesai} onChange={(e) => ubah({ tanggalSelesai: e.target.value })} />
        </Bidang>
      </div>
    </BingkaiForm>
  );
}

// ---------------------------------------------------------------- Sesi

export type NilaiFormSesi = { id: number | null; eventKode: string; nama: string; tanggal: string; jamMulai: string; jamSelesai: string };
const NAMA_SESI = ["Meeting", "Loading in", "Hari H", "Loading out"];

export function FormSesi({ awal, alamatKembali, adaPenilaian }: { awal: NilaiFormSesi; alamatKembali: string; adaPenilaian: boolean }) {
  const { f, ubah, galat, setGalat, akar } = useForm(awal);
  const { kirim, memuat } = useKirim(alamatKembali, setGalat);
  return (
    <BingkaiForm
      judul={f.id ? `Ubah sesi ${awal.nama}` : "Sesi baru"}
      keterangan={adaPenilaian ? "Mengubah jam sesi menghapus penilaian kehadiran di sesi ini, jadi kapten perlu menilai ulang." : "Jam kerja crew dipotong ke jadwal sesi ini."}
      akar={akar}
      memuat={memuat}
      alamatKembali={alamatKembali}
      kirim={() => kirim(() => simpanSesi(f))}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Bidang label="Nama sesi" htmlFor="ss-nama" wajib galat={galat.nama} petunjuk="Contoh: Meeting, Loading in, Hari H, Loading out.">
          <Isian id="ss-nama" list="ss-nama-saran" value={f.nama} galat={!!galat.nama} onChange={(e) => ubah({ nama: e.target.value })} />
          <datalist id="ss-nama-saran">{NAMA_SESI.map((n) => <option key={n} value={n} />)}</datalist>
        </Bidang>
        <Bidang label="Tanggal" htmlFor="ss-tanggal" wajib galat={galat.tanggal}>
          <Isian id="ss-tanggal" type="date" value={f.tanggal} galat={!!galat.tanggal} onChange={(e) => ubah({ tanggal: e.target.value })} />
        </Bidang>
        <Bidang label="Jam mulai" htmlFor="ss-mulai" wajib galat={galat.jamMulai}>
          <Isian id="ss-mulai" type="time" value={f.jamMulai} galat={!!galat.jamMulai} onChange={(e) => ubah({ jamMulai: e.target.value })} />
        </Bidang>
        <Bidang label="Jam selesai" htmlFor="ss-selesai" wajib galat={galat.jamSelesai}>
          <Isian id="ss-selesai" type="time" value={f.jamSelesai} galat={!!galat.jamSelesai} onChange={(e) => ubah({ jamSelesai: e.target.value })} />
        </Bidang>
      </div>
    </BingkaiForm>
  );
}

// ---------------------------------------------------------------- Penugasan

export type NilaiFormPenugasan = { id: number | null; eventKode: string; karyawanKode: string; jabatanKode: string };

export function FormPenugasan({ awal, alamatKembali, crew, jabatan, punyaKehadiran }: {
  awal: NilaiFormPenugasan;
  alamatKembali: string;
  crew: OpsiCrew[];
  jabatan: OpsiJabatanEvent[];
  punyaKehadiran: boolean;
}) {
  const { f, ubah, galat, setGalat, akar } = useForm(awal);
  const { kirim, memuat } = useKirim(alamatKembali, setGalat);
  const pilihCrew = crew.filter((c) => c.aktif || c.kode === awal.karyawanKode);
  const pilihJabatan = jabatan.filter((j) => j.aktif || j.kode === awal.jabatanKode);
  return (
    <BingkaiForm
      judul={f.id ? "Ubah penugasan" : "Tugaskan crew"}
      keterangan={f.id ? "Ganti jabatan untuk mengganti kapten. Bila peran berubah (kapten jadi crew atau sebaliknya), penilaian kehadiran orang ini dihapus." : "Crew freelance (jenis Event) dibayar lewat slip fee. Karyawan inhouse boleh ikut sebagai crew; upah eventnya dibayar lewat Gaji Bulanan. Satu event boleh punya lebih dari satu kapten."}
      akar={akar}
      memuat={memuat}
      alamatKembali={alamatKembali}
      kirim={() => kirim(() => simpanPenugasan(f))}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Bidang label="Crew" htmlFor="tg-crew" wajib galat={galat.karyawanKode} petunjuk={punyaKehadiran ? "Orang ini sudah punya kehadiran, jadi tidak bisa diganti." : undefined}>
          <Pilihan id="tg-crew" value={f.karyawanKode} disabled={punyaKehadiran} galat={!!galat.karyawanKode} onChange={(e) => ubah({ karyawanKode: e.target.value })}>
            <option value="">Pilih crew</option>
            {pilihCrew.filter((c) => c.jenis === "EVENT").length > 0 && (
              <optgroup label="Crew freelance (slip fee)">
                {pilihCrew.filter((c) => c.jenis === "EVENT").map((c) => <option key={c.kode} value={c.kode}>{c.kode} · {c.nama}</option>)}
              </optgroup>
            )}
            {pilihCrew.filter((c) => c.jenis === "INHOUSE").length > 0 && (
              <optgroup label="Karyawan inhouse (lewat Gaji Bulanan, hanya sebagai crew)">
                {pilihCrew.filter((c) => c.jenis === "INHOUSE").map((c) => <option key={c.kode} value={c.kode}>{c.kode} · {c.nama} (inhouse)</option>)}
              </optgroup>
            )}
          </Pilihan>
        </Bidang>
        <Bidang label="Jabatan event" htmlFor="tg-jabatan" wajib galat={galat.jabatanKode}>
          <Pilihan id="tg-jabatan" value={f.jabatanKode} galat={!!galat.jabatanKode} onChange={(e) => ubah({ jabatanKode: e.target.value })}>
            <option value="">Pilih jabatan</option>
            {pilihJabatan.map((j) => (
              <option key={j.kode} value={j.kode}>{j.nama} ({LABEL_PERAN_EVENT[j.peranEvent]}, {rupiah(j.tarif)} {LABEL_SATUAN_TARIF[j.satuanTarif]})</option>
            ))}
          </Pilihan>
        </Bidang>
      </div>
      {pilihCrew.length === 0 && <p className="text-sm text-amber-700">Belum ada karyawan berjenis Event. Tambahkan di Master SDM, tab Karyawan, dengan jenis Event.</p>}
    </BingkaiForm>
  );
}

// ---------------------------------------------------------------- Kehadiran

export type NilaiFormKehadiran = { id: number | null; sesiId: number; karyawanKode: string; jamMasuk: string; jamPulang: string; catatanProgres: string };

export function FormKehadiran({ awal, alamatKembali, sesi, orang, sudahDinilai }: {
  awal: NilaiFormKehadiran;
  alamatKembali: string;
  sesi: { id: number; nama: string; tanggal: string; jamMulai: string; jamSelesai: string };
  orang: { kode: string; nama: string; peran: string; sudahAda: boolean }[];
  sudahDinilai: boolean;
}) {
  const { f, ubah, galat, setGalat, akar } = useForm(awal);
  const { kirim, memuat } = useKirim(alamatKembali, setGalat);
  const jamValid = /^\d\d:\d\d$/.test(f.jamMasuk) && /^\d\d:\d\d$/.test(f.jamPulang) && f.jamPulang > f.jamMasuk;
  const tercatat = jamValid ? menitTercatat(sesi, f) : null;
  return (
    <BingkaiForm
      judul={`${f.id ? "Ubah kehadiran" : "Catat kehadiran"}: ${sesi.nama}`}
      keterangan={`Jadwal sesi ${sesi.jamMulai} sampai ${sesi.jamSelesai}. Jam di luar jadwal tidak dihitung.${sudahDinilai ? " Mengubah data ini menghapus penilaian yang sudah ada." : ""}`}
      akar={akar}
      memuat={memuat}
      alamatKembali={alamatKembali}
      kirim={() => kirim(() => simpanKehadiran(f))}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Bidang label="Crew" htmlFor="kh-orang" wajib galat={galat.karyawanKode}>
          <Pilihan id="kh-orang" value={f.karyawanKode} galat={!!galat.karyawanKode} onChange={(e) => ubah({ karyawanKode: e.target.value })}>
            <option value="">Pilih orang yang ditugaskan</option>
            {orang.map((o) => (
              <option key={o.kode} value={o.kode} disabled={o.sudahAda && o.kode !== awal.karyawanKode}>
                {o.nama} ({o.peran}){o.sudahAda && o.kode !== awal.karyawanKode ? ", sudah dicatat" : ""}
              </option>
            ))}
          </Pilihan>
        </Bidang>
        <Bidang label="Jam masuk" htmlFor="kh-masuk" wajib galat={galat.jamMasuk}>
          <Isian id="kh-masuk" type="time" value={f.jamMasuk} galat={!!galat.jamMasuk} onChange={(e) => ubah({ jamMasuk: e.target.value })} />
        </Bidang>
        <Bidang label="Jam pulang" htmlFor="kh-pulang" wajib galat={galat.jamPulang} petunjuk={tercatat !== null ? `Tercatat di dalam jadwal: ${labelDurasi(tercatat)}` : undefined}>
          <Isian id="kh-pulang" type="time" value={f.jamPulang} galat={!!galat.jamPulang} onChange={(e) => ubah({ jamPulang: e.target.value })} />
        </Bidang>
        <Bidang label="Catatan progres" htmlFor="kh-catatan" galat={galat.catatanProgres} className="sm:col-span-2 lg:col-span-3" petunjuk="Apa yang dikerjakan di sesi ini. Dibaca kapten saat menilai.">
          <AreaTeks id="kh-catatan" rows={2} value={f.catatanProgres} galat={!!galat.catatanProgres} onChange={(e) => ubah({ catatanProgres: e.target.value })} />
        </Bidang>
      </div>
    </BingkaiForm>
  );
}
