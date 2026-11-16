import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { wajibPeranHalaman } from "@/lib/server/auth";
import { IZIN, LABEL_PERAN } from "@/lib/peran";
import { daftarPengguna } from "@/lib/data/master/pengguna";
import { labelWaktu } from "@/lib/format";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import Lencana from "@/komponen/ui/Lencana";
import { TautanTombol } from "@/komponen/ui/Tombol";
import Peringatan from "@/komponen/ui/Peringatan";
import FormPengguna from "@/komponen/master/FormPengguna";
import AksiPengguna from "@/komponen/master/AksiPengguna";

export const metadata: Metadata = { title: "Pengguna" };

export default async function Halaman({ searchParams }: { searchParams: Promise<{ form?: string; ubah?: string; sandi?: string }> }) {
  const saya = await wajibPeranHalaman(IZIN["pengguna.kelola"]);
  const cari = await searchParams;
  const daftar = await daftarPengguna();
  const cariId = (s?: string) => daftar.find((p) => String(p.id) === s);

  let form: React.ReactNode = null;
  if (cari.form === "baru") form = <FormPengguna key="baru" mode="baru" />;
  else if (cari.ubah) {
    const p = cariId(cari.ubah);
    form = p ? <FormPengguna key={`ubah-${p.id}`} mode="ubah" id={p.id} namaPengguna={p.namaPengguna} nama={p.nama} peran={p.peran} dirinyaSendiri={p.id === saya.id} /> : <Peringatan jenis="galat">Pengguna tidak ditemukan.</Peringatan>;
  } else if (cari.sandi) {
    const p = cariId(cari.sandi);
    form = p ? <FormPengguna key={`sandi-${p.id}`} mode="sandi" id={p.id} namaPengguna={p.namaPengguna} /> : <Peringatan jenis="galat">Pengguna tidak ditemukan.</Peringatan>;
  }

  return (
    <>
      <KepalaHalaman
        judul="Pengguna"
        keterangan="Kelola akun Admin, HRD, dan Owner. Menonaktifkan akun atau mengganti kata sandinya langsung memutus sesi login akun itu."
        aksi={!form ? <TautanTombol href="/pengguna?form=baru" varian="utama" ikon={<Plus className="size-4" />}>Pengguna baru</TautanTombol> : null}
      />
      {form}
      <Kartu rapat>
        <KepalaKartu judul="Daftar pengguna" keterangan={`${daftar.length} akun, ${daftar.filter((p) => p.aktif).length} aktif`} />
        <Tabel label="Daftar pengguna">
          <thead>
            <tr>
              <th>Nama pengguna</th>
              <th>Nama</th>
              <th>Peran</th>
              <th>Dibuat</th>
              <th>Sesi aktif</th>
              <th>Status</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {daftar.map((p) => (
              <tr key={p.id} className={p.aktif ? "" : "text-slate-400"}>
                <td className="kode">@{p.namaPengguna}{p.id === saya.id && <span className="ml-1.5 text-[11px] text-aksen">(kamu)</span>}</td>
                <td className="font-medium">{p.nama}</td>
                <td><Lencana warna={p.peran === "OWNER" ? "teal" : p.peran === "ADMIN" ? "biru" : "kuning"}>{LABEL_PERAN[p.peran]}</Lencana></td>
                <td className="whitespace-nowrap">{labelWaktu(p.dibuatPada)}</td>
                <td className="angka">{p.sesiAktif}</td>
                <td><Lencana warna={p.aktif ? "hijau" : "abu"}>{p.aktif ? "Aktif" : "Nonaktif"}</Lencana></td>
                <td><AksiPengguna id={p.id} aktif={p.aktif} dirinyaSendiri={p.id === saya.id} namaPengguna={p.namaPengguna} /></td>
              </tr>
            ))}
          </tbody>
        </Tabel>
      </Kartu>
    </>
  );
}
