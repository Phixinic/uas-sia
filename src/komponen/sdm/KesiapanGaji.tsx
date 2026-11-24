/*
 * Penjelasan gaji inhouse sebagai biaya tetap dan status kesiapan per karyawan di halaman Hitung Gaji (komponen server).
 * Komponen tetap (jabatan, golongan atau gaji pokok, tunjangan) diatur sekali di Master SDM, Setting Gaji; tiap bulan
 * HRD hanya mengisi presensi lalu menghitung. Rumus tidak berubah (src/lib/inti/penggajian.ts).
 */
import Link from "next/link";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import { DaftarHP, KartuHP, RincianHP, TabelLebar } from "@/komponen/fee-event/Ringkas";
import { denganPeriode, labelBulanTahun } from "@/lib/inti/tanggal";
import type { BarisGaji, KesiapanGaji as DataKesiapan } from "@/lib/data/sdm/gaji";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import { alamatPresensi, StatusSlipKaryawan, TandaStatus } from "./StatusGaji";

const ALAMAT_SETTING = "/sdm/setting-gaji";

export function PanelBiayaTetap() {
  return (
    <Kartu>
      <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
        <div>
          <h2 className="font-semibold text-slate-900">Komponen tetap, diatur sekali</h2>
          <p className="mt-1 text-slate-600">
            Jabatan, golongan (gaji pokok), tunjangan jabatan, tunjangan keluarga, dan tunjangan lain diambil dari{" "}
            <Link className="font-medium underline" href={ALAMAT_SETTING}>Setting Gaji</Link> versi yang berlaku di bulan itu. Setting ini tidak perlu dibuat ulang tiap bulan, jadi gaji inhouse adalah biaya tetap. Promosi, demosi, atau penyesuaian menjadi versi baru dengan bulan berlaku setelah disetujui Owner.
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
  if (k.adaSetting) return <TandaStatus warna="hijau">Berlaku</TandaStatus>;
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <TandaStatus warna="merah">Belum ada setting gaji berlaku</TandaStatus>
      {k.catatanSetting && <span className="text-[11px] text-slate-500">{k.catatanSetting}</span>}
    </span>
  );
}

function Presensi({ k, periode }: { k: DataKesiapan; periode: string }) {
  if (!k.presensi) return <TandaStatus warna="kuning" href={alamatPresensi(periode, k.karyawanKode)}>Belum diisi</TandaStatus>;
  const lengkap = k.hariKerja !== null && k.presensi >= k.hariKerja;
  return <TandaStatus warna={lengkap ? "hijau" : "kuning"}>{k.hariKerja !== null ? `${k.presensi} dari ${k.hariKerja} hari` : `${k.presensi} hari`}</TandaStatus>;
}

function Slip({ k, periode }: { k: DataKesiapan; periode: string }) {
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <StatusSlipKaryawan slipStatus={k.slipStatus} jumlahPresensi={k.presensi} periode={periode} karyawanKode={k.karyawanKode} />
      {k.perluHitungUlang && <span className="text-[11px] font-medium text-amber-700">{k.settingBerubah ? "Setting berubah, hitung ulang" : k.nominalBerubah ? "Nominal berubah, hitung ulang" : "Hitung ulang"}</span>}
    </span>
  );
}

function TindakLanjut({ k, periode }: { k: DataKesiapan; periode: string }) {
  const presensi = `${denganPeriode("/sdm/presensi", periode)}&tab=harian&karyawan=${k.karyawanKode}`;
  if (!k.adaSetting) return <Link className="font-medium underline" href={`${ALAMAT_SETTING}?form=baru&karyawan=${k.karyawanKode}`}>{k.catatanSetting ? "Lihat setting gaji" : "Ajukan setting gaji"}</Link>;
  // Slip yang sudah diajukan atau dibayar mengunci presensi periodenya, jadi tidak ada lagi yang perlu dilengkapi.
  if (k.slipStatus === "DISETUJUI") return <span className="text-emerald-700">Selesai, gaji dibayar</span>;
  if (k.slipStatus === "DIAJUKAN") return <span className="text-slate-600">Menunggu keputusan Owner</span>;
  if (!k.presensi) return <Link className="font-medium underline" href={presensi}>Isi presensi</Link>;
  if (k.hariKerja !== null && k.presensi < k.hariKerja) return <Link className="font-medium underline" href={presensi}>Lengkapi presensi</Link>;
  if (k.nominalKurang.length) return <Link className="font-medium underline" href="/master/sdm?tab=struktur">Nominal {k.nominalKurang.join(", ")} belum berlaku</Link>;
  if (!k.slipStatus) return <span className="text-slate-600">Siap dihitung</span>;
  if (k.perluHitungUlang) return <span className="text-amber-700">Hitung ulang slip</span>;
  return <span className="text-emerald-700">Siap</span>;
}

export function KesiapanGaji({ daftar, periode }: { daftar: DataKesiapan[]; periode: string }) {
  const siap = daftar.filter((k) => k.adaSetting && k.presensi > 0).length;
  return (
    <Kartu rapat>
      <KepalaKartu judul={`Kesiapan gaji · ${labelBulanTahun(periode)}`} keterangan={`${siap} dari ${daftar.length} karyawan inhouse punya setting gaji berlaku dan presensi`} />
      <DaftarHP label="Kesiapan gaji per karyawan">
        {daftar.map((k) => (
          <KartuHP key={k.karyawanKode} judul={k.nama} sub={`${k.karyawanKode}${k.jabatan ? ` · ${k.jabatan}` : ""}`} kanan={<Slip k={k} periode={periode} />}>
            <RincianHP isi={[["Setting gaji", <Setting key="s" k={k} />], ["Presensi", <Presensi key="p" k={k} periode={periode} />]]} />
            <div className="text-[13px]"><TindakLanjut k={k} periode={periode} /></div>
          </KartuHP>
        ))}
      </DaftarHP>
      <TabelLebar>
        <Tabel label="Kesiapan gaji per karyawan">
          <thead>
            <tr>
              <th>Karyawan</th>
              <th>Setting gaji berlaku (komponen tetap)</th>
              <th>Presensi bulan ini</th>
              <th>Status gaji</th>
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
                <td><Presensi k={k} periode={periode} /></td>
                <td><Slip k={k} periode={periode} /></td>
                <td className="text-sm"><TindakLanjut k={k} periode={periode} /></td>
              </tr>
            ))}
          </tbody>
        </Tabel>
      </TabelLebar>
    </Kartu>
  );
}

/**
 * Versi nominal komponen yang dipakai Hitung Gaji bulan ini: tiap gaji pokok, tunjangan jabatan, dan tunjangan lain
 * disebut dengan versi dan bulan berlakunya. Slip terkunci (diajukan atau dibayar) memakai versi yang tersimpan di slip.
 */
export function PanelVersiNominal({ baris, periode }: { baris: BarisGaji[]; periode: string }) {
  const sumber = new Map<string, Set<string>>();
  for (const b of baris) {
    const t = b.tampil;
    for (const x of [t.sumberGajiPokok, t.sumberJabatan, ...t.tunjLain.map((l) => l.sumber)]) {
      sumber.set(x, new Set([...(sumber.get(x) ?? []), b.nama]));
    }
  }
  const daftar = [...sumber.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return (
    <Kartu rapat>
      <KepalaKartu
        judul={`Versi nominal komponen · ${labelBulanTahun(periode)}`}
        keterangan="Nominal gaji pokok, tunjangan jabatan, dan tunjangan lain diambil dari versi yang berlaku di bulan slip (Master SDM, tab Struktur gaji). Kenaikan yang baru berlaku bulan depan tidak mengubah slip bulan ini walau dihitung ulang."
      />
      {daftar.length === 0 ? (
        <KeadaanKosong judul="Belum ada komponen yang dipakai" />
      ) : (
        <ul className="divide-y divide-slate-100 text-[13px]" aria-label="Versi nominal komponen">
          {daftar.map(([teks, orang]) => (
            <li key={teks} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2 sm:px-5">
              <span className="min-w-0 font-medium text-slate-800">{teks}</span>
              <span className="text-xs text-slate-500">{orang.size} karyawan</span>
            </li>
          ))}
        </ul>
      )}
    </Kartu>
  );
}
