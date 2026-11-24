/*
 * Halaman Presensi (komponen server). Keadaan di URL: ?bulan=10&tahun=2026&tab=rekap|harian&karyawan=KRY-01&form=baru|<id>.
 * Tombol input, ubah, dan hapus hanya untuk HRD; presensi terkunci bila slip periodenya sudah diajukan atau dibayar.
 */
import LencanaBiaya from "@/komponen/sdm/LencanaBiaya";
import { Plus } from "lucide-react";
import { wajibMasuk } from "@/lib/server/auth";
import { boleh } from "@/lib/peran";
import { denganPeriode, hariIni, labelBulanTahun, labelPeriode, periodeDari } from "@/lib/inti/tanggal";
import { LABEL_ABSENSI } from "@/lib/format";
import { opsiPeriodeSdm, periodeDipilih, type CariPeriode } from "@/lib/data/sdm/umum";
import LencanaPeriode from "@/komponen/ui/LencanaPeriode";
import { ambilPresensi, opsiKaryawanPresensi, presensiHarian, rekapBulanan } from "@/lib/data/sdm/presensi";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Tabel from "@/komponen/ui/Tabel";
import Lencana from "@/komponen/ui/Lencana";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import { TautanTombol } from "@/komponen/ui/Tombol";
import { labelTanggal } from "@/lib/format";
import PilihPeriode from "./PilihPeriode";
import FormPresensi, { type NilaiFormPresensi } from "./FormPresensi";
import AksiPresensi from "./AksiPresensi";
import type { Absensi } from "@/generated/prisma/enums";

const ALAMAT = "/sdm/presensi";
const WARNA_ABSENSI: Record<Absensi, "hijau" | "merah" | "kuning" | "biru"> = { HADIR: "hijau", ALPA: "merah", SAKIT: "kuning", IZIN: "kuning", CUTI: "biru" };
const jumlah = (n: number) => (n ? String(n) : "0");

export type CariPresensi = CariPeriode & { tab?: string; karyawan?: string; form?: string };

export default async function HalamanPresensi({ cari }: { cari: CariPresensi }) {
  const pengguna = await wajibMasuk();
  const periode = periodeDipilih(cari);
  const tab = cari.tab === "harian" ? "harian" : "rekap";
  const bolehKelola = boleh(pengguna.peran, "presensi.kelola");
  const dasar = denganPeriode(ALAMAT, periode);
  const alamatTab = (t: string, kar?: string) => `${dasar}&tab=${t}${kar ? `&karyawan=${kar}` : ""}`;

  const [opsiPeriode, rekap, harian, karyawan] = await Promise.all([
    opsiPeriodeSdm(periode),
    rekapBulanan(periode),
    presensiHarian(periode, cari.karyawan || undefined),
    opsiKaryawanPresensi(periode),
  ]);

  // ----- Form -----
  let form: React.ReactNode = null;
  if (cari.form && bolehKelola) {
    const kembali = alamatTab(tab, cari.karyawan);
    if (cari.form === "baru") {
      const sekarang = hariIni();
      const awal: NilaiFormPresensi = { id: null, karyawanKode: cari.karyawan ?? "", tanggal: periodeDari(sekarang) === periode ? sekarang : `${periode}-01`, absensi: "HADIR", jamMasuk: "", jamKeluar: "" };
      form = <FormPresensi key="baru" awal={awal} karyawan={karyawan} alamatKembali={kembali} />;
    } else {
      const p = Number(cari.form) ? await ambilPresensi(Number(cari.form)) : null;
      form = p
        ? <FormPresensi key={cari.form} awal={{ ...p, id: p.id }} karyawan={karyawan} alamatKembali={kembali} />
        : <Peringatan jenis="galat">Presensi tidak ditemukan.</Peringatan>;
    }
  }

  const total = (f: (r: (typeof rekap)[number]["rekap"]) => number) => rekap.reduce((s, r) => s + f(r.rekap), 0);
  const filter = cari.karyawan ? rekap.find((r) => r.kode === cari.karyawan) : null;

  return (
    <>
      <KepalaHalaman
        judul="Presensi"
        lencana={<><LencanaBiaya jenis="tetap" /><LencanaPeriode periode={periode} /></>}
        keterangan="Catatan kehadiran harian karyawan inhouse dan rekapnya per periode. Kehadiran crew event dicatat di menu Event & Kehadiran. Jam kerja dikurangi istirahat 1 jam. Presensi terkunci setelah gaji periodenya diajukan."
        aksi={
          <>
            <PilihPeriode terpilih={periode} opsi={opsiPeriode} />
            {bolehKelola && !form && (
              <TautanTombol href={`${alamatTab(tab, cari.karyawan)}&form=baru`} varian="utama" ikon={<Plus className="size-4" />}>
                Input presensi
              </TautanTombol>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KartuRingkasan judul="Karyawan aktif" nilai={String(rekap.length)} bukanUang keterangan={labelPeriode(periode)} />
        <KartuRingkasan judul="Hadir (hari)" nilai={String(total((r) => r.hadir))} bukanUang nada="hijau" keterangan={`${total((r) => r.izin + r.sakit + r.cuti)} hari izin, sakit, atau cuti`} />
        <KartuRingkasan judul="Alpa (hari)" nilai={String(total((r) => r.alpa))} bukanUang nada={total((r) => r.alpa) ? "merah" : "netral"} keterangan="Dipotong dari gaji pokok" />
        <KartuRingkasan judul="Terlambat" nilai={`${total((r) => r.terlambatMenit)} mnt`} bukanUang nada={total((r) => r.terlambatMenit) ? "kuning" : "netral"} keterangan={`${total((r) => r.terlambatKali)} kali`} />
      </div>

      {!bolehKelola && <Peringatan>Presensi diinput oleh HRD. Kamu masuk sebagai {pengguna.peran === "OWNER" ? "Owner" : "Admin"} dan hanya bisa melihat.</Peringatan>}
      {form}

      <div role="tablist" aria-label="Tampilan presensi" className="flex flex-wrap gap-2">
        <TautanTombol href={alamatTab("rekap")} varian={tab === "rekap" ? "gelap" : "garis"} kecil>Rekap bulanan</TautanTombol>
        <TautanTombol href={alamatTab("harian")} varian={tab === "harian" ? "gelap" : "garis"} kecil>Presensi harian</TautanTombol>
      </div>

      {tab === "rekap" ? (
        <Kartu rapat>
          <KepalaKartu judul={`Rekap presensi · ${labelBulanTahun(periode)}`} keterangan="Angka ini dipakai saat hitung gaji" />
          {rekap.length === 0 ? (
            <KeadaanKosong judul="Belum ada karyawan aktif" keterangan="Tambahkan karyawan di Master SDM." />
          ) : (
            <Tabel label="Rekap presensi per karyawan">
              <thead>
                <tr>
                  <th>Karyawan</th>
                  <th>Jabatan</th>
                  <th className="kolom-angka">Hari kerja</th>
                  <th className="kolom-angka">Hadir</th>
                  <th className="kolom-angka">Izin</th>
                  <th className="kolom-angka">Sakit</th>
                  <th className="kolom-angka">Cuti</th>
                  <th className="kolom-angka">Alpa</th>
                  <th className="kolom-angka">Terlambat</th>
                  <th className="kolom-angka">Jam kerja</th>
                  <th className="text-right">Rincian</th>
                </tr>
              </thead>
              <tbody>
                {rekap.map((r) => (
                  <tr key={r.kode}>
                    <td>
                      {r.nama} <span className="kode">{r.kode}</span>
                      {r.terkunci && <span className="ml-1.5"><Lencana warna="abu">terkunci</Lencana></span>}
                    </td>
                    <td>{r.jabatan ?? <Lencana warna="kuning">Belum di-setting</Lencana>}</td>
                    <td className="kolom-angka">{r.hariKerja ?? "-"}</td>
                    <td className="kolom-angka">{jumlah(r.rekap.hadir)}</td>
                    <td className="kolom-angka">{jumlah(r.rekap.izin)}</td>
                    <td className="kolom-angka">{jumlah(r.rekap.sakit)}</td>
                    <td className="kolom-angka">{jumlah(r.rekap.cuti)}</td>
                    <td className="kolom-angka">{r.rekap.alpa ? <Lencana warna="merah">{r.rekap.alpa}</Lencana> : "0"}</td>
                    <td className="kolom-angka">{r.rekap.terlambatKali ? `${r.rekap.terlambatKali}x · ${r.rekap.terlambatMenit} mnt` : "-"}</td>
                    <td className="kolom-angka">{r.rekap.jamKerja.toFixed(2)}</td>
                    <td className="text-right">
                      <TautanTombol href={alamatTab("harian", r.kode)} kecil varian="hantu">Detail</TautanTombol>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total</td>
                  <td className="kolom-angka">{total((r) => r.hadir)}</td>
                  <td className="kolom-angka">{total((r) => r.izin)}</td>
                  <td className="kolom-angka">{total((r) => r.sakit)}</td>
                  <td className="kolom-angka">{total((r) => r.cuti)}</td>
                  <td className="kolom-angka">{total((r) => r.alpa)}</td>
                  <td className="kolom-angka">{total((r) => r.terlambatMenit)} mnt</td>
                  <td className="kolom-angka">{total((r) => r.jamKerja).toFixed(2)}</td>
                  <td />
                </tr>
              </tfoot>
            </Tabel>
          )}
        </Kartu>
      ) : (
        <Kartu rapat>
          <KepalaKartu
            judul={`Presensi harian · ${labelBulanTahun(periode)}`}
            keterangan={`${harian.length} catatan${filter ? ` untuk ${filter.nama}` : ""}`}
            aksi={filter ? <TautanTombol href={alamatTab("harian")} kecil varian="garis">Tampilkan semua karyawan</TautanTombol> : undefined}
          />
          {harian.length === 0 ? (
            <KeadaanKosong judul="Belum ada presensi pada periode ini" keterangan={bolehKelola ? 'Tekan "Input presensi" untuk mencatat yang pertama.' : "Presensi dicatat oleh HRD."} />
          ) : (
            <Tabel label="Presensi harian">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Karyawan</th>
                  <th>Absensi</th>
                  <th>Masuk</th>
                  <th>Keluar</th>
                  <th className="kolom-angka">Terlambat</th>
                  <th className="kolom-angka">Jam kerja</th>
                  <th>Jabatan (jadwal)</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {harian.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{labelTanggal(p.tanggal)}</td>
                    <td>{p.karyawan}</td>
                    <td><Lencana warna={WARNA_ABSENSI[p.absensi]}>{LABEL_ABSENSI[p.absensi]}</Lencana></td>
                    <td>{p.jamMasuk ?? "-"}</td>
                    <td>{p.jamKeluar ?? "-"}</td>
                    <td className="kolom-angka">{p.terlambat ? <Lencana warna="kuning">{p.terlambat} mnt</Lencana> : "-"}</td>
                    <td className="kolom-angka">{p.jamKerja ? p.jamKerja.toFixed(2) : "-"}</td>
                    <td className="kode">{p.jabatanKode}</td>
                    <td>
                      {p.terkunci ? (
                        <div className="text-right text-xs text-slate-500">terkunci</div>
                      ) : bolehKelola ? (
                        <AksiPresensi id={p.id} nama={p.karyawan} tanggal={p.tanggal} ubahHref={`${alamatTab("harian", cari.karyawan)}&form=${p.id}`} />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabel>
          )}
        </Kartu>
      )}
    </>
  );
}
