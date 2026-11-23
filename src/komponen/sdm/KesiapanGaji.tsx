/*
 * Penjelasan gaji inhouse sebagai biaya tetap dan status kesiapan per karyawan di halaman Hitung Gaji (komponen server).
 * Komponen tetap (jabatan, golongan atau gaji pokok, tunjangan) diatur sekali di Master SDM, Setting Gaji; tiap bulan
 * HRD hanya mengisi presensi lalu menghitung. Rumus tidak berubah (src/lib/inti/penggajian.ts).
 */
import Link from "next/link";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Lencana, { LencanaStatus } from "@/komponen/ui/Lencana";
import Tabel from "@/komponen/ui/Tabel";
import { DaftarHP, KartuHP, RincianHP, TabelLebar } from "@/komponen/fee-event/Ringkas";
import { labelPeriode } from "@/lib/inti/tanggal";
import type { KesiapanGaji as DataKesiapan } from "@/lib/data/sdm/gaji";

const ALAMAT_SETTING = "/master/sdm?tab=setgaji";

export function PanelBiayaTetap() {
  return (
    <Kartu>
      <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
        <div>
          <h2 className="font-semibold text-slate-900">Komponen tetap, diatur sekali</h2>
          <p className="mt-1 text-slate-600">
            Jabatan, golongan (gaji pokok), tunjangan jabatan, tunjangan keluarga, dan tunjangan lain diambil dari{" "}
            <Link className="font-medium underline" href={ALAMAT_SETTING}>Setting Gaji di Master SDM</Link>. Setting ini tidak perlu dibuat ulang tiap bulan, jadi gaji inhouse adalah biaya tetap.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Diisi tiap bulan</h2>
          <p className="mt-1 text-slate-600">
            HRD cukup mengisi presensi lalu menekan Hitung. Yang berubah hanya potongan absen (gaji pokok dibagi hari kerja, dikali alpa), lalu PPh 21 dan THP ikut menyesuaikan.
          </p>
        </div>
      </div>
    </Kartu>
  );
}

function Setting({ k }: { k: DataKesiapan }) {
  return k.adaSetting ? <Lencana warna="hijau">Ada</Lencana> : <Lencana warna="merah">Belum ada</Lencana>;
}

function Presensi({ k }: { k: DataKesiapan }) {
  if (!k.presensi) return <Lencana warna="kuning">Belum diisi</Lencana>;
  const lengkap = k.hariKerja !== null && k.presensi >= k.hariKerja;
  return <Lencana warna={lengkap ? "hijau" : "kuning"}>{k.hariKerja !== null ? `${k.presensi} dari ${k.hariKerja} hari` : `${k.presensi} hari`}</Lencana>;
}

function Slip({ k }: { k: DataKesiapan }) {
  if (!k.slipStatus) return <Lencana warna="abu">Belum dihitung</Lencana>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <LencanaStatus jenis="slip" status={k.slipStatus} />
      {k.perluHitungUlang && <Lencana warna="kuning">hitung ulang</Lencana>}
    </span>
  );
}

function TindakLanjut({ k, periode }: { k: DataKesiapan; periode: string }) {
  const presensi = `/sdm/presensi?periode=${periode}&tab=harian&karyawan=${k.karyawanKode}`;
  if (!k.adaSetting) return <Link className="font-medium underline" href={ALAMAT_SETTING}>Buat setting gaji</Link>;
  // Slip yang sudah diajukan atau dibayar mengunci presensi periodenya, jadi tidak ada lagi yang perlu dilengkapi.
  if (k.slipStatus === "DISETUJUI") return <span className="text-emerald-700">Selesai, gaji dibayar</span>;
  if (k.slipStatus === "DIAJUKAN") return <span className="text-slate-600">Menunggu keputusan Owner</span>;
  if (!k.presensi) return <Link className="font-medium underline" href={presensi}>Isi presensi</Link>;
  if (k.hariKerja !== null && k.presensi < k.hariKerja) return <Link className="font-medium underline" href={presensi}>Lengkapi presensi</Link>;
  if (!k.slipStatus) return <span className="text-slate-600">Siap dihitung</span>;
  if (k.perluHitungUlang) return <span className="text-amber-700">Hitung ulang slip</span>;
  return <span className="text-emerald-700">Siap</span>;
}

export function KesiapanGaji({ daftar, periode }: { daftar: DataKesiapan[]; periode: string }) {
  const siap = daftar.filter((k) => k.adaSetting && k.presensi > 0).length;
  return (
    <Kartu rapat>
      <KepalaKartu judul={`Kesiapan gaji ${labelPeriode(periode)}`} keterangan={`${siap} dari ${daftar.length} karyawan inhouse punya setting gaji dan presensi`} />
      <DaftarHP label="Kesiapan gaji per karyawan">
        {daftar.map((k) => (
          <KartuHP key={k.karyawanKode} judul={k.nama} sub={`${k.karyawanKode}${k.jabatan ? ` · ${k.jabatan}` : ""}`} kanan={<Slip k={k} />}>
            <RincianHP isi={[["Setting gaji", <Setting key="s" k={k} />], ["Presensi", <Presensi key="p" k={k} />]]} />
            <div className="text-[13px]"><TindakLanjut k={k} periode={periode} /></div>
          </KartuHP>
        ))}
      </DaftarHP>
      <TabelLebar>
        <Tabel label="Kesiapan gaji per karyawan">
          <thead>
            <tr>
              <th>Karyawan</th>
              <th>Setting gaji (komponen tetap)</th>
              <th>Presensi bulan ini</th>
              <th>Slip</th>
              <th>Tindak lanjut</th>
            </tr>
          </thead>
          <tbody>
            {daftar.map((k) => (
              <tr key={k.karyawanKode}>
                <td>
                  <div className="font-medium text-slate-900">{k.nama}</div>
                  <div className="text-[11px] text-slate-500">{k.karyawanKode}{k.jabatan ? ` · ${k.jabatan}` : ""}</div>
                </td>
                <td><Setting k={k} /></td>
                <td><Presensi k={k} /></td>
                <td><Slip k={k} /></td>
                <td className="text-sm"><TindakLanjut k={k} periode={periode} /></td>
              </tr>
            ))}
          </tbody>
        </Tabel>
      </TabelLebar>
    </Kartu>
  );
}
