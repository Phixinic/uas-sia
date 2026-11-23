/*
 * Halaman Event & Kehadiran (komponen server) untuk staf. HRD dan Owner mencatat; Admin hanya melihat.
 * Keadaan di URL: ?form=baru (event baru) | ?lihat=EVT-2026-0001 [&form=ubah | &sesi=baru|<id> | &tugas=baru|<id> | &hadir=baru|<id>&sesiId=<id>].
 */
import LencanaBiaya from "@/komponen/sdm/LencanaBiaya";
import Link from "next/link";
import { ArrowLeft, CalendarPlus, Pencil, Plus, UserPlus } from "lucide-react";
import { wajibMasuk } from "@/lib/server/auth";
import { boleh } from "@/lib/peran";
import { db } from "@/lib/server/db";
import { hariIni, labelTanggal } from "@/lib/inti/tanggal";
import { labelDurasi } from "@/lib/inti/fee-event";
import { LABEL_PERAN_EVENT, LABEL_SATUAN_TARIF, labelWaktu, rupiah } from "@/lib/format";
import { muatBahanEvent, type BahanEvent } from "@/lib/data/fee-event/bahan";
import { daftarEvent, opsiPenugasan, riwayatLaporanEvent } from "@/lib/data/fee-event/daftar";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import Lencana, { LencanaStatus } from "@/komponen/ui/Lencana";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import { TautanTombol } from "@/komponen/ui/Tombol";
import { FormEvent, FormKehadiran, FormPenugasan, FormSesi } from "./FormEvent";
import { AksiBaris, TombolHapusEvent } from "./AksiEvent";
import { KeteranganPenilaian, LencanaPenilaian } from "./Penilaian";
import { DaftarHP, KartuHP, RincianHP, TabelLebar } from "./Ringkas";

const ALAMAT = "/fee-event/event";
export type CariEvent = { lihat?: string; form?: string; sesi?: string; tugas?: string; hadir?: string; sesiId?: string };

export default async function HalamanEvent({ cari }: { cari: CariEvent }) {
  const pengguna = await wajibMasuk();
  const bolehKelola = boleh(pengguna.peran, "event.kelola");
  if (cari.lihat) return <DetailEvent kode={cari.lihat} cari={cari} bolehKelola={bolehKelola} />;

  const daftar = await daftarEvent();
  const hari = hariIni();
  const form = cari.form === "baru" && bolehKelola ? <FormEvent awal={{ kode: null, nama: "", klien: "", tanggalMulai: hari, tanggalSelesai: hari }} alamatKembali={ALAMAT} /> : null;
  const n = (s: string) => daftar.filter((e) => e.status === s).length;

  return (
    <>
      <KepalaHalaman
        judul="Event & Kehadiran"
        lencana={<LencanaBiaya jenis="variabel" />}
        keterangan="Crew freelance dibayar per event. HRD mencatat event, sesi, penugasan, dan kehadiran; kapten menilai progres crew lalu mengirim laporan ke Owner; Owner menentukan fee."
        aksi={bolehKelola && !form ? <TautanTombol href={`${ALAMAT}?form=baru`} varian="utama" ikon={<CalendarPlus className="size-4" />}>Event baru</TautanTombol> : null}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KartuRingkasan judul="Event" nilai={String(daftar.length)} bukanUang keterangan="Semua event" />
        <KartuRingkasan judul="Penilaian kapten" nilai={String(n("PENILAIAN"))} bukanUang nada={n("PENILAIAN") ? "kuning" : "netral"} keterangan="Masih bisa diubah HRD" />
        <KartuRingkasan judul="Menunggu Owner" nilai={String(n("DIAJUKAN"))} bukanUang nada={n("DIAJUKAN") ? "kuning" : "netral"} keterangan="Laporan kapten terkirim" />
        <KartuRingkasan judul="Selesai" nilai={String(n("SELESAI"))} bukanUang nada="hijau" keterangan="Fee sudah dibayar" />
      </div>
      {!bolehKelola && <Peringatan>Event dicatat oleh HRD atau Owner. Kamu hanya bisa melihat.</Peringatan>}
      {form}
      <Kartu rapat>
        <KepalaKartu judul="Daftar event" keterangan={`${daftar.length} event`} />
        {daftar.length === 0 ? (
          <KeadaanKosong judul="Belum ada event" keterangan={bolehKelola ? 'Tekan "Event baru" untuk mencatat event pertama.' : undefined} />
        ) : (
          <>
<DaftarHP label="Daftar event">
            {daftar.map((e) => (
              <KartuHP
                key={e.kode}
                judul={e.nama}
                sub={<><span className="kode">{e.kode}</span>{e.klien ? ` · ${e.klien}` : ""}</>}
                kanan={<><LencanaStatus jenis="event" status={e.status} />{e.status === "PENILAIAN" && e.alasanTolak && <div className="mt-0.5 text-[11px] text-rose-700">Ditolak Owner</div>}</>}
              >
                <RincianHP
                  isi={[
                    ["Tanggal", `${labelTanggal(e.tanggalMulai)}${e.tanggalSelesai !== e.tanggalMulai ? ` sampai ${labelTanggal(e.tanggalSelesai)}` : ""}`],
                    ["Kapten", e.kapten.length ? e.kapten.join(", ") : <Lencana key="k" warna="kuning">Belum ada</Lencana>],
                    ["Sesi, orang", `${e.jumlahSesi} sesi, ${e.jumlahOrang} orang`],
                    ["Kehadiran", <>{e.jumlahKehadiran}{e.status === "PENILAIAN" && e.belumDinilai > 0 && <span className="text-amber-700">, {e.belumDinilai} belum dinilai</span>}</>],
                  ]}
                />
                <TautanTombol href={`${ALAMAT}?lihat=${e.kode}`} kecil>Buka</TautanTombol>
              </KartuHP>
            ))}
          </DaftarHP>
<TabelLebar>
<Tabel label="Daftar event">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Event</th>
                <th>Tanggal</th>
                <th>Kapten</th>
                <th className="kolom-angka">Sesi</th>
                <th className="kolom-angka">Orang</th>
                <th className="kolom-angka">Kehadiran</th>
                <th>Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((e) => (
                <tr key={e.kode}>
                  <td className="kode">{e.kode}</td>
                  <td>
                    <div className="font-medium">{e.nama}</div>
                    {e.klien && <div className="text-xs text-slate-500">{e.klien}</div>}
                  </td>
                  <td className="whitespace-nowrap">{labelTanggal(e.tanggalMulai)}{e.tanggalSelesai !== e.tanggalMulai ? ` sampai ${labelTanggal(e.tanggalSelesai)}` : ""}</td>
                  <td>{e.kapten.length ? e.kapten.join(", ") : <Lencana warna="kuning">Belum ada</Lencana>}</td>
                  <td className="kolom-angka">{e.jumlahSesi}</td>
                  <td className="kolom-angka">{e.jumlahOrang}</td>
                  <td className="kolom-angka">
                    {e.jumlahKehadiran}
                    {e.status === "PENILAIAN" && e.belumDinilai > 0 && <div className="text-[11px] text-amber-700">{e.belumDinilai} belum dinilai</div>}
                  </td>
                  <td>
                    <LencanaStatus jenis="event" status={e.status} />
                    {e.status === "PENILAIAN" && e.alasanTolak && <div className="mt-0.5 text-[11px] text-rose-700">Ditolak Owner</div>}
                  </td>
                  <td className="text-right"><TautanTombol href={`${ALAMAT}?lihat=${e.kode}`} kecil varian="hantu">Buka</TautanTombol></td>
                </tr>
              ))}
            </tbody>
          </Tabel>
</TabelLebar>
</>
        )}
      </Kartu>
    </>
  );
}

async function DetailEvent({ kode, cari, bolehKelola }: { kode: string; cari: CariEvent; bolehKelola: boolean }) {
  const [b, riwayat] = await Promise.all([muatBahanEvent(db, kode), riwayatLaporanEvent(kode)]);
  if (!b) {
    return (
      <>
        <KepalaHalaman judul="Event tidak ditemukan" />
        <Peringatan jenis="galat">Event {kode} tidak ditemukan.</Peringatan>
        <TautanTombol href={ALAMAT} ikon={<ArrowLeft className="size-4" />}>Kembali ke daftar</TautanTombol>
      </>
    );
  }
  const dasar = `${ALAMAT}?lihat=${b.kode}`;
  const terbuka = b.status === "PENILAIAN";
  const kelola = bolehKelola && terbuka;
  const kapten = b.orang.filter((o) => o.peranEvent === "KAPTEN");
  const semuaKehadiran = b.orang.flatMap((o) => o.kehadiran);
  const kurang = semuaKehadiran.filter((k) => k.penilaian === "KURANG").length;

  const form = kelola ? await formDetail(b, cari, dasar) : null;

  return (
    <>
      <KepalaHalaman
        judul={b.nama}
        lencana={<LencanaStatus jenis="event" status={b.status} />}
        keterangan={`${b.kode}${b.klien ? ` · ${b.klien}` : ""} · ${labelTanggal(b.tanggalMulai)}${b.tanggalSelesai !== b.tanggalMulai ? ` sampai ${labelTanggal(b.tanggalSelesai)}` : ""}`}
        aksi={
          <>
            <TautanTombol href={ALAMAT} ikon={<ArrowLeft className="size-4" />}>Daftar event</TautanTombol>
            {kelola && !form && <TautanTombol href={`${dasar}&form=ubah`} ikon={<Pencil className="size-4" />}>Ubah event</TautanTombol>}
            {kelola && !form && !semuaKehadiran.length && !riwayat.length && <TombolHapusEvent kode={b.kode} nama={b.nama} />}
          </>
        }
      />

      {terbuka && b.alasanTolak && <Peringatan jenis="galat">Laporan sebelumnya ditolak Owner: &ldquo;{b.alasanTolak}&rdquo;. Kapten perlu menilai ulang lalu mengirim laporan lagi.</Peringatan>}
      {terbuka && !kapten.length && <Peringatan jenis="awas">Event ini belum punya kapten. Tugaskan minimal satu orang sebagai Kapten supaya progres crew bisa dinilai.</Peringatan>}
      {b.status === "DIAJUKAN" && <Peringatan>Laporan kapten sedang menunggu keputusan Owner, jadi data event terkunci. <Link className="font-semibold underline" href={`/fee-event/keputusan?lihat=${riwayat[0]?.no ?? ""}`}>Buka laporan</Link></Peringatan>}
      {b.status === "SELESAI" && <Peringatan jenis="sukses">Fee event ini sudah dibayar. <Link className="font-semibold underline" href={`/fee-event/keputusan?lihat=${riwayat[0]?.no ?? ""}`}>Lihat keputusan dan slip fee</Link></Peringatan>}
      {!bolehKelola && <Peringatan>Event dicatat oleh HRD atau Owner. Kamu hanya bisa melihat.</Peringatan>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KartuRingkasan judul="Sesi" nilai={String(b.sesi.length)} bukanUang keterangan={b.sesi.map((s) => s.nama).join(", ") || "Belum ada sesi"} />
        <KartuRingkasan judul="Orang ditugaskan" nilai={String(b.orang.length)} bukanUang keterangan={`${kapten.length} kapten, ${b.orang.length - kapten.length} crew`} />
        <KartuRingkasan judul="Kehadiran" nilai={String(semuaKehadiran.length)} bukanUang nada={b.crewBelumDinilai ? "kuning" : "netral"} keterangan={b.crewBelumDinilai ? `${b.crewBelumDinilai} crew belum dinilai` : kurang ? `${kurang} dinilai kurang` : "Semua crew sudah dinilai"} />
        <KartuRingkasan judul="Usulan fee" nilai={b.totalUsulan} keterangan="Dihitung dari penilaian saat ini" />
      </div>

      {form}

      <Kartu rapat>
        <KepalaKartu
          judul="Sesi"
          keterangan="Jam kerja crew dipotong ke jadwal sesi"
          aksi={kelola && !form ? <TautanTombol href={`${dasar}&sesi=baru`} kecil varian="utama" ikon={<Plus className="size-4" />}>Tambah sesi</TautanTombol> : undefined}
        />
        {b.sesi.length === 0 ? (
          <KeadaanKosong judul="Belum ada sesi" keterangan="Contoh sesi: Meeting, Loading in, Hari H, Loading out." />
        ) : (
          <>
<DaftarHP label="Sesi event">
            {b.sesi.map((s) => (
              <KartuHP key={s.id} judul={s.nama} sub={`${labelTanggal(s.tanggal)}, ${s.jamMulai} sampai ${s.jamSelesai}`} kanan={<span className="text-xs text-slate-500">{semuaKehadiran.filter((k) => k.sesiId === s.id).length} hadir</span>}>
                {kelola && <AksiBaris kiri jenis="sesi" id={s.id} ubahHref={`${dasar}&sesi=${s.id}`} judulHapus={`Hapus sesi ${s.nama}?`} pesanHapus="Sesi yang sudah punya kehadiran tidak bisa dihapus." />}
              </KartuHP>
            ))}
          </DaftarHP>
<TabelLebar>
<Tabel label="Sesi event">
            <thead>
              <tr><th>Sesi</th><th>Tanggal</th><th>Jadwal</th><th className="kolom-angka">Kehadiran</th>{kelola && <th className="text-right">Aksi</th>}</tr>
            </thead>
            <tbody>
              {b.sesi.map((s) => {
                const n = semuaKehadiran.filter((k) => k.sesiId === s.id).length;
                return (
                  <tr key={s.id}>
                    <td className="font-medium">{s.nama}</td>
                    <td className="whitespace-nowrap">{labelTanggal(s.tanggal)}</td>
                    <td className="whitespace-nowrap">{s.jamMulai} sampai {s.jamSelesai}</td>
                    <td className="kolom-angka">{n}</td>
                    {kelola && <td><AksiBaris jenis="sesi" id={s.id} ubahHref={`${dasar}&sesi=${s.id}`} judulHapus={`Hapus sesi ${s.nama}?`} pesanHapus="Sesi yang sudah punya kehadiran tidak bisa dihapus." /></td>}
                  </tr>
                );
              })}
            </tbody>
          </Tabel>
</TabelLebar>
</>
        )}
      </Kartu>

      <Kartu rapat>
        <KepalaKartu
          judul="Penugasan"
          keterangan="Kapten menilai crew; kehadiran kapten dinilai Owner"
          aksi={kelola && !form ? <TautanTombol href={`${dasar}&tugas=baru`} kecil varian="utama" ikon={<UserPlus className="size-4" />}>Tugaskan crew</TautanTombol> : undefined}
        />
        {b.orang.length === 0 ? (
          <KeadaanKosong judul="Belum ada penugasan" />
        ) : (
          <>
<DaftarHP label="Penugasan event">
            {b.orang.map((o) => (
              <KartuHP key={o.karyawanKode} judul={o.nama} sub={<><span className="kode">{o.karyawanKode}</span> · {o.jabatan}</>} kanan={<Lencana warna={o.peranEvent === "KAPTEN" ? "teal" : "abu"}>{LABEL_PERAN_EVENT[o.peranEvent]}</Lencana>}>
                <RincianHP
                  kolom={3}
                  isi={[
                    ["Tarif", `${rupiah(o.tarif)} ${LABEL_SATUAN_TARIF[o.satuanTarif]}`],
                    ["Diakui", `${o.satuanTarif === "HARI" ? `${o.usulan.jumlahHari} hari` : labelDurasi(o.usulan.menitDiakui)} (${o.usulan.jumlahSesi} sesi)`],
                    ["Usulan", <Rupiah key="u" nilai={o.usulan.fee} />],
                  ]}
                />
                {kelola && <AksiBaris kiri jenis="penugasan" id={o.penugasanId} ubahHref={`${dasar}&tugas=${o.penugasanId}`} labelUbah="Ganti jabatan" judulHapus={`Hapus penugasan ${o.nama}?`} pesanHapus="Orang yang sudah punya kehadiran tidak bisa dihapus dari event." />}
              </KartuHP>
            ))}
          </DaftarHP>
<TabelLebar>
<Tabel label="Penugasan event">
            <thead>
              <tr><th>Nama</th><th>Jabatan</th><th>Tarif</th><th className="kolom-angka">Sesi hadir</th><th className="kolom-angka">Diakui</th><th className="kolom-angka">Usulan (Rp)</th>{kelola && <th className="text-right">Aksi</th>}</tr>
            </thead>
            <tbody>
              {b.orang.map((o) => (
                <tr key={o.karyawanKode}>
                  <td><span className="font-medium">{o.nama}</span> <span className="kode">{o.karyawanKode}</span></td>
                  <td><Lencana warna={o.peranEvent === "KAPTEN" ? "teal" : "abu"}>{LABEL_PERAN_EVENT[o.peranEvent]}</Lencana> <span className="text-xs text-slate-500">{o.jabatan}</span></td>
                  <td className="whitespace-nowrap">{rupiah(o.tarif)} {LABEL_SATUAN_TARIF[o.satuanTarif]}</td>
                  <td className="kolom-angka">{o.usulan.jumlahSesi}</td>
                  <td className="kolom-angka whitespace-nowrap">{o.satuanTarif === "HARI" ? `${o.usulan.jumlahHari} hari` : labelDurasi(o.usulan.menitDiakui)}</td>
                  <td className="kolom-angka"><Rupiah nilai={o.usulan.fee} polos /></td>
                  {kelola && <td><AksiBaris jenis="penugasan" id={o.penugasanId} ubahHref={`${dasar}&tugas=${o.penugasanId}`} labelUbah="Ganti jabatan" judulHapus={`Hapus penugasan ${o.nama}?`} pesanHapus="Orang yang sudah punya kehadiran tidak bisa dihapus dari event." /></td>}
                </tr>
              ))}
            </tbody>
          </Tabel>
</TabelLebar>
</>
        )}
      </Kartu>

      {b.sesi.map((s) => {
        const baris = b.orang.flatMap((o) => o.kehadiran.filter((k) => k.sesiId === s.id).map((k) => ({ o, k })));
        return (
          <Kartu rapat key={s.id}>
            <KepalaKartu
              judul={`Kehadiran: ${s.nama}`}
              keterangan={`${labelTanggal(s.tanggal)}, jadwal ${s.jamMulai} sampai ${s.jamSelesai} · ${baris.length} orang`}
              aksi={kelola && !form ? <TautanTombol href={`${dasar}&hadir=baru&sesiId=${s.id}`} kecil varian="utama" ikon={<Plus className="size-4" />}>Catat kehadiran</TautanTombol> : undefined}
            />
            {baris.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">Belum ada kehadiran di sesi ini.</p>
            ) : (
              <>
<DaftarHP label={`Kehadiran ${s.nama}`}>
                {baris.map(({ o, k }) => (
                  <KartuHP key={k.id} judul={o.nama} sub={`${LABEL_PERAN_EVENT[o.peranEvent]} · ${k.jamMasuk} sampai ${k.jamPulang} · tercatat ${labelDurasi(k.menitTercatat)}`} kanan={<LencanaPenilaian k={k} peran={o.peranEvent} />} nada={k.penilaian === "KURANG" ? "kurang" : undefined}>
                    <div className="text-[13px] break-words text-slate-700">{k.catatanProgres || <span className="text-slate-400">Tanpa catatan progres</span>}</div>
                    <KeteranganPenilaian k={k} />
                    {kelola && <AksiBaris kiri jenis="kehadiran" id={k.id} ubahHref={`${dasar}&hadir=${k.id}&sesiId=${s.id}`} judulHapus={`Hapus kehadiran ${o.nama}?`} pesanHapus={`Kehadiran di sesi ${s.nama} dihapus${k.penilaian ? " beserta penilaiannya" : ""}.`} />}
                  </KartuHP>
                ))}
              </DaftarHP>
<TabelLebar>
<Tabel label={`Kehadiran ${s.nama}`}>
                <thead>
                  <tr><th>Nama</th><th>Masuk</th><th>Pulang</th><th className="kolom-angka">Tercatat</th><th>Catatan progres</th><th>Penilaian</th>{kelola && <th className="text-right">Aksi</th>}</tr>
                </thead>
                <tbody>
                  {baris.map(({ o, k }) => (
                    <tr key={k.id} className={k.penilaian === "KURANG" ? "bg-rose-50/50" : ""}>
                      <td><span className="font-medium">{o.nama}</span> <span className="text-xs text-slate-500">{LABEL_PERAN_EVENT[o.peranEvent]}</span></td>
                      <td>{k.jamMasuk}</td>
                      <td>{k.jamPulang}</td>
                      <td className="kolom-angka whitespace-nowrap">{labelDurasi(k.menitTercatat)}</td>
                      <td className="max-w-72 text-[13px]">{k.catatanProgres || <span className="text-slate-400">-</span>}</td>
                      <td className="min-w-40"><LencanaPenilaian k={k} peran={o.peranEvent} /><KeteranganPenilaian k={k} /></td>
                      {kelola && <td><AksiBaris jenis="kehadiran" id={k.id} ubahHref={`${dasar}&hadir=${k.id}&sesiId=${s.id}`} judulHapus={`Hapus kehadiran ${o.nama}?`} pesanHapus={`Kehadiran di sesi ${s.nama} dihapus${k.penilaian ? " beserta penilaiannya" : ""}.`} /></td>}
                    </tr>
                  ))}
                </tbody>
              </Tabel>
</TabelLebar>
</>
            )}
          </Kartu>
        );
      })}

      {riwayat.length > 0 && (
        <Kartu rapat>
          <KepalaKartu judul="Riwayat laporan kapten" keterangan={`${riwayat.length} laporan`} />
          <>
<DaftarHP label="Riwayat laporan">
            {riwayat.map((l) => (
              <KartuHP key={l.no} judul={<span className="kode">{l.no}</span>} sub={`${labelWaktu(l.diajukanPada)} · ${l.diajukanOleh}`} kanan={<LencanaStatus jenis="persetujuan" status={l.status} />}>
                <div className="text-[13px] break-words">{l.alasanTolak ? <span className="text-rose-700">Ditolak: {l.alasanTolak}</span> : l.jurnalNo ? `Jurnal ${l.jurnalNo}` : l.catatanKapten || "-"}</div>
                <TautanTombol href={`/fee-event/keputusan?lihat=${l.no}`} kecil>Buka</TautanTombol>
              </KartuHP>
            ))}
          </DaftarHP>
<TabelLebar>
<Tabel label="Riwayat laporan">
            <thead><tr><th>No.</th><th>Dikirim</th><th>Oleh</th><th>Status</th><th>Keterangan</th><th className="text-right" /></tr></thead>
            <tbody>
              {riwayat.map((l) => (
                <tr key={l.no}>
                  <td className="kode">{l.no}</td>
                  <td className="whitespace-nowrap">{labelWaktu(l.diajukanPada)}</td>
                  <td>{l.diajukanOleh}</td>
                  <td><LencanaStatus jenis="persetujuan" status={l.status} /></td>
                  <td className="max-w-80 text-[13px]">{l.alasanTolak ? <span className="text-rose-700">Ditolak: {l.alasanTolak}</span> : l.jurnalNo ? `Jurnal ${l.jurnalNo}` : l.catatanKapten || "-"}</td>
                  <td className="text-right"><TautanTombol href={`/fee-event/keputusan?lihat=${l.no}`} kecil varian="hantu">Buka</TautanTombol></td>
                </tr>
              ))}
            </tbody>
          </Tabel>
</TabelLebar>
</>
        </Kartu>
      )}
    </>
  );
}

/** Form yang sedang dibuka di halaman detail (event, sesi, penugasan, atau kehadiran). */
async function formDetail(b: BahanEvent, cari: CariEvent, dasar: string): Promise<React.ReactNode> {
  if (cari.form === "ubah") {
    return <FormEvent key="ubah" awal={{ kode: b.kode, nama: b.nama, klien: b.klien, tanggalMulai: b.tanggalMulai, tanggalSelesai: b.tanggalSelesai }} alamatKembali={dasar} />;
  }
  if (cari.sesi) {
    const s = cari.sesi === "baru" ? null : b.sesi.find((x) => String(x.id) === cari.sesi);
    if (cari.sesi !== "baru" && !s) return <Peringatan jenis="galat">Sesi tidak ditemukan.</Peringatan>;
    const adaPenilaian = !!s && b.orang.some((o) => o.kehadiran.some((k) => k.sesiId === s.id && k.penilaian));
    return <FormSesi key={`sesi-${cari.sesi}`} awal={s ? { ...s, eventKode: b.kode } : { id: null, eventKode: b.kode, nama: "", tanggal: b.tanggalMulai, jamMulai: "", jamSelesai: "" }} alamatKembali={dasar} adaPenilaian={adaPenilaian} />;
  }
  if (cari.tugas) {
    const o = cari.tugas === "baru" ? null : b.orang.find((x) => String(x.penugasanId) === cari.tugas);
    if (cari.tugas !== "baru" && !o) return <Peringatan jenis="galat">Penugasan tidak ditemukan.</Peringatan>;
    const opsi = await opsiPenugasan(b.periodeTarif);
    const crew = opsi.crew.filter((c) => c.kode === o?.karyawanKode || !b.orang.some((x) => x.karyawanKode === c.kode));
    return (
      <FormPenugasan
        key={`tugas-${cari.tugas}`}
        awal={{ id: o?.penugasanId ?? null, eventKode: b.kode, karyawanKode: o?.karyawanKode ?? "", jabatanKode: o?.jabatanKode ?? "" }}
        alamatKembali={dasar}
        crew={crew}
        jabatan={opsi.jabatan}
        punyaKehadiran={!!o?.kehadiran.length}
      />
    );
  }
  if (cari.hadir) {
    const sesi = b.sesi.find((x) => String(x.id) === cari.sesiId);
    if (!sesi) return <Peringatan jenis="galat">Sesi tidak ditemukan.</Peringatan>;
    const semua = b.orang.flatMap((o) => o.kehadiran);
    const k = cari.hadir === "baru" ? null : semua.find((x) => String(x.id) === cari.hadir);
    if (cari.hadir !== "baru" && !k) return <Peringatan jenis="galat">Kehadiran tidak ditemukan.</Peringatan>;
    const orang = b.orang.map((o) => ({ kode: o.karyawanKode, nama: o.nama, peran: LABEL_PERAN_EVENT[o.peranEvent], sudahAda: o.kehadiran.some((x) => x.sesiId === sesi.id) }));
    if (!orang.length) return <Peringatan jenis="awas">Tugaskan crew dulu sebelum mencatat kehadiran.</Peringatan>;
    return (
      <FormKehadiran
        key={`hadir-${cari.hadir}-${sesi.id}`}
        awal={k ? { id: k.id, sesiId: sesi.id, karyawanKode: k.karyawanKode, jamMasuk: k.jamMasuk, jamPulang: k.jamPulang, catatanProgres: k.catatanProgres } : { id: null, sesiId: sesi.id, karyawanKode: "", jamMasuk: sesi.jamMulai, jamPulang: sesi.jamSelesai, catatanProgres: "" }}
        alamatKembali={dasar}
        sesi={sesi}
        orang={orang}
        sudahDinilai={!!k?.penilaian}
      />
    );
  }
  return null;
}
