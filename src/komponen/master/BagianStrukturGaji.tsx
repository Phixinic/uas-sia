/*
 * Tab Struktur gaji di Master SDM (komponen server): satu tabel Jabatan (kelompok Inhouse dan Event, saringan
 * `&kelompok=INHOUSE|EVENT`), golongan (gaji pokok), dan tunjangan lain dalam satu halaman. Tabel database tetap terpisah; tambah, ubah, dan nonaktifkan memakai aksi master
 * yang sama (simpanMaster, ubahStatusMaster) dengan izin dari DEF_MASTER. HRD menambah, mengubah, dan mengajukan
 * nominal; Owner memutuskan pengajuan dan mengaktifkan atau menonaktifkan; peran lain hanya melihat.
 * Keadaan di URL: ?tab=struktur&jenis=<jenis>&form=baru|<kode>, &nominal=<kode> (form ajukan perubahan nominal),
 * &riwayat=<kode> (riwayat nominal satu item).
 * Nominal (gaji pokok, tunjangan, tunjangan jabatan, tarif event) berversi: kolom nominal = nilai yang berlaku bulan
 * berjalan, kolom "Riwayat nominal" = sejak kapan berlaku, versi berikutnya yang sudah disetujui, dan pengajuan menunggu.
 */
import Link from "next/link";
import { Plus } from "lucide-react";
import { boleh, LABEL_PERAN, type Peran } from "@/lib/peran";
import { opsiMaster } from "@/lib/data/master/master";
import { periodeTerkunciSemua } from "@/lib/data/umum";
import { dataStrukturGaji, type DataStrukturGaji, type InfoNominal, type TampilNominal } from "@/lib/data/master/struktur-gaji";
import { DEF_MASTER, JENIS_STRUKTUR, NOMINAL_STRUKTUR, termasukStruktur, type JenisStruktur } from "@/lib/skema/master";
import { labelBulanTahun, labelPeriode } from "@/lib/inti/tanggal";
import { LABEL_JENIS_NOMINAL } from "@/lib/inti/nominal";
import { labelWaktu, rupiah } from "@/lib/format";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import Lencana from "@/komponen/ui/Lencana";
import { TautanTombol } from "@/komponen/ui/Tombol";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import Peringatan from "@/komponen/ui/Peringatan";
import FormMaster from "./FormMaster";
import AksiMaster from "./AksiMaster";
import AksiNominal from "./AksiNominal";
import FormNominal from "./FormNominal";
import { belumDiAtas, belumDiputuskan } from "@/lib/inti/urut";

export const ALAMAT_STRUKTUR = "/master/sdm?tab=struktur";
export const alamatBagian = (jenis: JenisStruktur, form?: string) => `${ALAMAT_STRUKTUR}&jenis=${jenis}${form ? `&form=${form}` : ""}#bagian-${jenis}`;
export const alamatNominal = (jenis: JenisStruktur, kode: string) => `${ALAMAT_STRUKTUR}&jenis=${jenis}&nominal=${kode}#bagian-${jenis}`;
export const alamatRiwayat = (jenis: JenisStruktur, kode: string) => `${ALAMAT_STRUKTUR}&jenis=${jenis}&riwayat=${kode}#riwayat-nominal`;

function LencanaVersi({ v, sekarang }: { v: TampilNominal; sekarang: string }) {
  if (v.status === "DIAJUKAN") return <Lencana warna="biru">Menunggu Owner</Lencana>;
  if (v.status === "DITOLAK") return <Lencana warna="merah">Ditolak</Lencana>;
  if (v.digantikan) return <Lencana warna="abu">Digantikan</Lencana>;
  return <Lencana warna={v.berlakuMulai > sekarang ? "teal" : "hijau"}>{v.berlakuMulai > sekarang ? "Disetujui, belum berlaku" : "Disetujui"}</Lencana>;
}

/** Isi sel "Riwayat nominal": sejak kapan nilai sekarang berlaku, versi berikutnya, dan pengajuan menunggu. */
function SelRiwayat({ info, jenis, kode }: { info: InfoNominal | undefined; jenis: JenisStruktur; kode: string }) {
  if (!info) return null;
  return (
    <div className="min-w-44 space-y-0.5 text-xs">
      <div className="text-slate-600">{info.berlaku ? `Sejak ${labelPeriode(info.berlaku.berlakuMulai)} (${info.berlaku.kode})` : "Belum ada nominal berlaku"}</div>
      {info.berikutnya && <div className="text-teal-800">Mulai {labelPeriode(info.berikutnya.berlakuMulai)}: {info.berikutnya.teks}</div>}
      {info.menunggu.map((m) => <div key={m.kode} className="text-blue-800">Menunggu Owner: {m.teks} mulai {labelPeriode(m.berlakuMulai)}</div>)}
      <Link className="font-medium text-slate-700 underline" href={alamatRiwayat(jenis, kode)}>Riwayat</Link>
    </div>
  );
}

const BAGIAN: Record<JenisStruktur, { judul: string; keterangan: string }> = {
  jabatan: {
    judul: "Jabatan inhouse",
    keterangan: "Tunjangan jabatan dan tunjangan istri/anak (hanya PTKP K) ikut setting gaji. Jam kerja diatur di tab Jadwal kerja.",
  },
  jabatanEvent: {
    judul: "Jabatan event",
    keterangan: "Peran, satuan tarif, dan tarif fee crew freelance. Tarif baru langsung dipakai untuk usulan fee yang belum disetujui.",
  },
  golongan: {
    judul: "Golongan (gaji pokok)",
    keterangan: "Gaji pokok per bulan. Potongan absen dihitung dari gaji pokok dibagi hari kerja.",
  },
  tunjangan: {
    judul: "Tunjangan lain",
    keterangan: "Nominal per bulan, dipilih per karyawan di setting gaji.",
  },
};

const jumlahKaryawan = (n: number | undefined) => (n ? `${n} karyawan` : "belum dipakai");

/** Kolom tambahan di luar kolom daftarMaster: pemakaian oleh setting berlaku dan jadwal kerja. */
function kolomTambahan(jenis: JenisStruktur, d: DataStrukturGaji): { judul: string; angka?: boolean; isi: (kode: string) => React.ReactNode }[] {
  switch (jenis) {
    case "jabatan":
      return [
        {
          judul: "Jadwal kerja",
          isi: (k) => (d.jadwal[k] ? <><span className="block whitespace-nowrap">{d.jadwal[k].jam}</span><span className="block text-xs text-slate-500">{d.jadwal[k].hari}</span></> : "Belum ada"),
        },
        { judul: "Dipakai", angka: true, isi: (k) => jumlahKaryawan(d.pemakaian.jabatan[k]) },
      ];
    case "golongan":
      return [{ judul: "Dipakai", angka: true, isi: (k) => jumlahKaryawan(d.pemakaian.golongan[k]) }];
    case "tunjangan":
      return [{ judul: "Dipakai", angka: true, isi: (k) => jumlahKaryawan(d.pemakaian.tunjangan[k]) }];
    default:
      return [];
  }
}

/** Urutan tampil: jabatan inhouse dan event satu tabel "Jabatan" (kolom Kelompok dan saringan), lalu golongan, tunjangan. */
const KELOMPOK_TAMPIL: JenisStruktur[][] = [["jabatan", "jabatanEvent"], ["golongan"], ["tunjangan"]];
const SARINGAN_KELOMPOK = [
  { nilai: "semua", label: "Semua" },
  { nilai: "INHOUSE", label: "Inhouse" },
  { nilai: "EVENT", label: "Event" },
] as const;

export default async function BagianStrukturGaji({ peran, cari }: { peran: Peran; cari: { jenis?: string; form?: string; nominal?: string; riwayat?: string; kelompok?: string } }) {
  const jenisForm = cari.jenis && termasukStruktur(cari.jenis) ? cari.jenis : null;
  const bolehForm = !!(jenisForm && cari.form && boleh(peran, DEF_MASTER[jenisForm].izin));
  const bolehNominal = boleh(peran, "nominal.ajukan");
  const bolehFormNominal = !!(jenisForm && cari.nominal && bolehNominal);
  const [d, opsi, terkunci] = await Promise.all([
    dataStrukturGaji(),
    bolehForm ? opsiMaster() : Promise.resolve(null),
    bolehFormNominal ? periodeTerkunciSemua() : Promise.resolve([] as string[]),
  ]);
  const bolehPutuskan = boleh(peran, "nominal.putuskan");
  const riwayatItem = jenisForm && cari.riwayat ? d.daftar[jenisForm].baris.find((b) => b.kode === cari.riwayat) : null;
  const bolehNonaktifkan = boleh(peran, "master.nonaktifkan");
  const bolehUbah = boleh(peran, "struktur-gaji.ubah");

  const kelompokDipilih = cari.kelompok === "INHOUSE" || cari.kelompok === "EVENT" ? cari.kelompok : "semua";

  /** Form tambah, ubah, atau ajukan nominal untuk satu jenis (null bila URL tidak membuka form jenis ini). */
  const formUntuk = (jenis: JenisStruktur): React.ReactNode => {
    if (jenisForm !== jenis) return null;
    const def = DEF_MASTER[jenis];
    const data = d.daftar[jenis];
    const kembali = `${ALAMAT_STRUKTUR}#bagian-${jenis}`;
    if (bolehForm && opsi) {
      const baris = cari.form === "baru" ? null : data.baris.find((b) => b.kode === cari.form);
      if (cari.form !== "baru" && !baris) return <Peringatan jenis="galat">Data {cari.form} tidak ditemukan.</Peringatan>;
      const bawaan = Object.fromEntries(def.isian.filter((x) => x.bawaan).map((x) => [x.kunci, x.bawaan as string]));
      return (
        <FormMaster
          key={`${jenis}-${cari.form}`}
          def={def}
          opsi={opsi}
          kode={baris?.kode ?? null}
          awal={baris?.nilai ?? bawaan}
          alamatKembali={kembali}
          berlaku={{ periodeBerlaku: d.periodeBerlaku, bawaan: d.periode }}
        />
      );
    }
    if (bolehFormNominal) {
      const baris = data.baris.find((b) => b.kode === cari.nominal);
      const info = baris ? d.nominal[jenis][baris.kode] : undefined;
      if (!baris || !info) return <Peringatan jenis="galat">Data {cari.nominal} tidak ditemukan.</Peringatan>;
      if (!baris.aktif) return <Peringatan jenis="galat">{baris.nama} sudah dinonaktifkan, jadi nominalnya tidak bisa diubah.</Peringatan>;
      const ringkas = (v: TampilNominal | null) => (v ? { kode: v.kode, teks: v.teks, berlakuMulai: v.berlakuMulai } : null);
      return (
        <FormNominal
          key={`nominal-${baris.kode}`}
          bahan={{
            jenis: NOMINAL_STRUKTUR[jenis],
            itemKode: baris.kode,
            item: baris.nama,
            satuan: jenis === "jabatanEvent" ? baris.sel[2] ?? null : null,
            berlaku: info.berlaku ? { ...ringkas(info.berlaku)!, nominal: info.berlaku.nominal, tunjJabatan: info.berlaku.tunjJabatan, tunjKeluarga: info.berlaku.tunjKeluarga } : null,
            berikutnya: ringkas(info.berikutnya),
            menunggu: info.menunggu.map((m) => ringkas(m)!),
            palingAwal: info.palingAwal,
          }}
          sekarang={d.periode}
          periodeBerlaku={d.periodeBerlaku}
          terkunci={terkunci}
          alamatKembali={kembali}
        />
      );
    }
    return null;
  };

  const jabatanTampil = d.ringkasJabatan.filter((j) => j.aktif || j.karyawan);
  const golonganTampil = d.ringkasGolongan.filter((g) => g.aktif || g.karyawan);

  return (
    <>
      {!bolehUbah && !bolehPutuskan && <Peringatan>Peran {LABEL_PERAN[peran]} hanya bisa melihat struktur gaji. HRD yang menambah, mengubah, dan mengajukan nominal; Owner yang memutuskan.</Peringatan>}

      <Kartu rapat label="Pengajuan nominal">
        <KepalaKartu
          judul={`Pengajuan nominal menunggu Owner (${d.pengajuan.length})`}
          keterangan={bolehPutuskan ? "Bandingkan nominal lama dan baru, lalu setujui atau tolak dengan alasan." : "Gaji pokok, tunjangan, tunjangan jabatan, dan tarif event diajukan HRD. Owner yang memutuskan."}
        />
        {d.pengajuan.length === 0 ? (
          <KeadaanKosong judul="Tidak ada pengajuan nominal yang menunggu" />
        ) : (
          <ul className="divide-y divide-slate-100" aria-label="Pengajuan nominal menunggu Owner">
            {d.pengajuan.map((p) => {
              const tarif = p.jenis === "JABATAN_EVENT";
              return (
                <li key={p.kode} className="space-y-2 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="kode">{p.kode}</span>
                        <span className="font-semibold text-slate-900">{LABEL_JENIS_NOMINAL[p.jenis]} {p.item}</span>
                        <Lencana warna="biru">Berlaku {labelBulanTahun(p.berlakuMulai)}</Lencana>
                      </div>
                      <div className="mt-0.5 text-[13px] text-slate-600">Diajukan {p.diajukanOleh ?? "-"} pada {labelWaktu(p.diajukanPada)}.</div>
                    </div>
                    {bolehPutuskan && <AksiNominal kode={p.kode} judul={`${LABEL_JENIS_NOMINAL[p.jenis]} ${p.item}`} berlaku={p.berlakuMulai} draf={p.draf} tarif={tarif} terhalang={p.pengaman.galat} />}
                  </div>
                  <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 p-2.5"><dt className="text-[12px] font-semibold tracking-wide text-slate-500 uppercase">Sebelum (nilai lama)</dt><dd className="mt-0.5">{p.lama ? `${p.lama.teks}, berlaku sejak ${labelPeriode(p.lama.berlakuMulai)} (${p.lama.kode})` : "Belum ada nominal berlaku"}</dd></div>
                    <div className="rounded-lg border border-slate-200 p-2.5"><dt className="text-[12px] font-semibold tracking-wide text-slate-500 uppercase">Sesudah (nilai baru)</dt><dd className="mt-0.5 font-medium text-slate-900">{p.teks}, berlaku mulai {labelPeriode(p.berlakuMulai)}</dd></div>
                  </dl>
                  <p className="text-[13px] text-slate-700"><span className="text-slate-500">Alasan: </span>{p.alasan}</p>
                  {p.pengaman.galat ? (
                    <Peringatan jenis="galat">Tidak bisa disetujui lagi: {p.pengaman.galat}</Peringatan>
                  ) : p.draf.length ? (
                    <Peringatan jenis="awas">{tarif ? `Usulan fee ${p.draf.join(", ")} akan memakai tarif baru setelah disetujui.` : `Slip draf ${p.draf.join(", ")} akan ditandai perlu dihitung ulang setelah disetujui.`}</Peringatan>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Kartu>

      {riwayatItem && jenisForm && (
        <Kartu rapat label="Riwayat nominal">
          <div id="riwayat-nominal" className="scroll-mt-20" />
          <KepalaKartu
            judul={`Riwayat ${LABEL_JENIS_NOMINAL[NOMINAL_STRUKTUR[jenisForm]].toLowerCase()} · ${riwayatItem.nama}`}
            keterangan={`${riwayatItem.kode}. Versi lama tidak pernah ditimpa. Slip dan fee memakai versi yang berlaku di bulannya.`}
            aksi={<TautanTombol href={`${ALAMAT_STRUKTUR}#bagian-${jenisForm}`} kecil>Tutup</TautanTombol>}
          />
          <Tabel label={`Riwayat nominal ${riwayatItem.nama}`}>
            <thead>
              <tr><th>Versi</th><th>Nominal</th><th>Berlaku mulai</th><th>Status</th><th>Alasan</th><th>Diajukan</th><th>Diputuskan</th></tr>
            </thead>
            <tbody>
              {belumDiAtas(d.riwayat[jenisForm][riwayatItem.kode] ?? [], (v) => belumDiputuskan(v.status)).map((v) => (
                <tr key={v.kode}>
                  <td className="kode">{v.kode}</td>
                  <td className="whitespace-nowrap font-medium">{v.teks}</td>
                  <td className="whitespace-nowrap">{labelPeriode(v.berlakuMulai)}</td>
                  <td><LencanaVersi v={v} sekarang={d.periode} /></td>
                  <td className="min-w-48 text-[13px]">{v.alasan}{v.alasanTolak ? <span className="block text-rose-700">Ditolak: {v.alasanTolak}</span> : null}</td>
                  <td className="text-[13px] whitespace-nowrap">{v.diajukanOleh ?? "Migrasi"}<span className="block text-xs text-slate-500">{labelWaktu(v.diajukanPada)}</span></td>
                  <td className="text-[13px] whitespace-nowrap">{v.diputuskanOleh ?? (v.diputuskanPada ? "Migrasi" : "-")}{v.diputuskanPada && <span className="block text-xs text-slate-500">{labelWaktu(v.diputuskanPada)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </Tabel>
        </Kartu>
      )}

      <Kartu label="Ringkasan struktur gaji">
        <h2 className="judul-kartu">Ringkasan pemakaian</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Dari setting gaji yang berlaku {labelBulanTahun(d.periode)}: {d.karyawanBersetting} dari {d.karyawanAktif} karyawan inhouse aktif sudah punya setting. Bruto = gaji pokok + tunjangan jabatan + tunjangan istri/anak + tunjangan lain, sebelum potongan absen.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="teks-label mb-1.5">Per jabatan inhouse</h3>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200" aria-label="Pemakaian per jabatan inhouse">
              {jabatanTampil.map((j) => (
                <li key={j.kode} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-[13px]">
                  <span className="min-w-0">
                    <span className="font-medium text-slate-800">{j.nama}</span>{" "}
                    {!j.aktif && <Lencana warna="abu">nonaktif</Lencana>}
                    <span className="block text-xs text-slate-500">{j.karyawan ? `${j.karyawan} karyawan` : "Belum dipakai setting berlaku"}</span>
                  </span>
                  <span className="angka text-right text-slate-700">
                    {j.brutoMin === null ? "-" : j.brutoMin === j.brutoMaks ? rupiah(j.brutoMin) : `${rupiah(j.brutoMin)} sampai ${rupiah(j.brutoMaks ?? 0)}`}
                  </span>
                </li>
              ))}
              {jabatanTampil.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Belum ada jabatan inhouse.</li>}
            </ul>
          </div>
          <div>
            <h3 className="teks-label mb-1.5">Per golongan</h3>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200" aria-label="Pemakaian per golongan">
              {golonganTampil.map((g) => (
                <li key={g.kode} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-[13px]">
                  <span className="min-w-0">
                    <span className="font-medium text-slate-800">{g.nama}</span>{" "}
                    {!g.aktif && <Lencana warna="abu">nonaktif</Lencana>}
                    <span className="block text-xs text-slate-500">{g.karyawan ? `${g.karyawan} karyawan` : "Belum dipakai setting berlaku"}</span>
                  </span>
                  <span className="angka text-right text-slate-700">{g.jumlah === null ? "belum berlaku" : rupiah(g.jumlah)}</span>
                </li>
              ))}
              {golonganTampil.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Belum ada golongan.</li>}
            </ul>
          </div>
        </div>
      </Kartu>

      {KELOMPOK_TAMPIL.map((kelompokJenis) => {
        const gabungan = kelompokJenis.length > 1;
        // Form tambah, ubah, atau ajukan nominal untuk salah satu jenis di kelompok ini.
        const form = kelompokJenis.map((jenis) => formUntuk(jenis)).find(Boolean) ?? null;
        const semuaBaris = kelompokJenis.flatMap((jenis) => d.daftar[jenis].baris.map((b) => ({ jenis, b })));
        const saring = gabungan ? kelompokDipilih : "semua";
        // Data dengan pengajuan nominal menunggu, atau data aktif yang belum punya nominal disetujui, tampil di atas.
        const baris = belumDiAtas(
          semuaBaris.filter((x) => saring === "semua" || (saring === "INHOUSE" ? x.jenis === "jabatan" : x.jenis === "jabatanEvent")),
          ({ jenis, b }) => {
            const n = d.nominal[jenis][b.kode];
            return !!n && (n.menunggu.length > 0 || (b.aktif && !n.berlaku && !n.berikutnya));
          },
        );
        const utama = kelompokJenis[0];
        const info = gabungan ? { judul: "Jabatan", keterangan: "Satu master jabatan untuk karyawan inhouse (tunjangan jabatan dan tunjangan istri/anak ikut setting gaji, jam kerja di tab Jadwal kerja) dan untuk penugasan event (peran, satuan tarif, dan tarif fee). Data ditambah dan diubah HRD." } : BAGIAN[utama];
        const adaAksiKolom = bolehUbah || bolehNominal || bolehNonaktifkan;
        const tombolBaru = form || !bolehUbah ? null : (
          <div className="flex flex-wrap gap-2">
            {kelompokJenis.map((j) => (
              <TautanTombol key={j} href={alamatBagian(j, "baru")} kecil varian="utama" ikon={<Plus className="size-4" />}>{DEF_MASTER[j].label} baru</TautanTombol>
            ))}
          </div>
        );
        return (
          <div key={utama} id={`bagian-${utama}`} className="scroll-mt-20 space-y-4">
            {kelompokJenis.slice(1).map((j) => <span key={j} id={`bagian-${j}`} className="block scroll-mt-20" />)}
            {form}
            <Kartu rapat label={info.judul}>
              <KepalaKartu judul={info.judul} keterangan={`${semuaBaris.length} data. ${info.keterangan}`} aksi={tombolBaru} />
              {gabungan && (
                <nav className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3" aria-label="Saring kelompok jabatan">
                  <span className="text-xs text-slate-500">Kelompok:</span>
                  {SARINGAN_KELOMPOK.map((k) => (
                    <Link
                      key={k.nilai}
                      href={`${ALAMAT_STRUKTUR}${k.nilai === "semua" ? "" : `&kelompok=${k.nilai}`}#bagian-jabatan`}
                      aria-current={saring === k.nilai ? "page" : undefined}
                      className={`tombol tombol-kecil ${saring === k.nilai ? "tombol-gelap" : "tombol-garis"}`}
                    >
                      {k.label} ({k.nilai === "semua" ? semuaBaris.length : semuaBaris.filter((x) => (k.nilai === "INHOUSE") === (x.jenis === "jabatan")).length})
                    </Link>
                  ))}
                </nav>
              )}
              {baris.length === 0 ? (
                <KeadaanKosong judul={`Belum ada data ${info.judul.toLowerCase()}`} keterangan={bolehUbah ? "Tekan tombol tambah di atas untuk menambah." : undefined} />
              ) : (
                <Tabel label={`Daftar ${info.judul.toLowerCase()}`}>
                  <thead>
                    <tr>
                      <th>Kode</th>
                      <th>Nama</th>
                      {gabungan ? (
                        <>
                          <th>Kelompok</th>
                          <th>Rincian</th>
                        </>
                      ) : (
                        d.daftar[utama].kolom.map((k) => <th key={k.judul} className={k.angka ? "kolom-angka" : ""}>{k.judul}</th>)
                      )}
                      <th>Riwayat nominal</th>
                      {gabungan ? <th>Dipakai</th> : kolomTambahan(utama, d).map((k) => <th key={k.judul} className={k.angka ? "kolom-angka" : ""}>{k.judul}</th>)}
                      <th>Status</th>
                      {adaAksiKolom && <th className="text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {baris.map(({ jenis, b }) => {
                      const kolom = d.daftar[jenis].kolom;
                      const tambahan = kolomTambahan(jenis, d);
                      return (
                        <tr key={`${jenis}-${b.kode}`} className={b.aktif ? "" : "text-slate-400"}>
                          <td className="kode">{b.kode}</td>
                          <td className="font-medium">{b.nama}</td>
                          {gabungan ? (
                            <>
                              <td><Lencana warna={jenis === "jabatan" ? "teal" : "biru"}>{jenis === "jabatan" ? "Inhouse" : "Event"}</Lencana></td>
                              <td className="min-w-52 text-[13px]">
                                <dl className="space-y-0.5">
                                  {b.sel.map((x, i) => (kolom[i] && kolom[i].judul !== "Dipakai" ? <div key={i} className="flex gap-1.5"><dt className="text-slate-500">{kolom[i].judul}:</dt><dd className="angka">{x}</dd></div> : null))}
                                  {tambahan.filter((k) => k.judul !== "Dipakai").map((k) => <div key={k.judul} className="flex gap-1.5"><dt className="text-slate-500">{k.judul}:</dt><dd>{k.isi(b.kode)}</dd></div>)}
                                </dl>
                              </td>
                            </>
                          ) : (
                            b.sel.map((x, i) => <td key={i} className={kolom[i]?.angka ? "kolom-angka angka" : ""}>{x}</td>)
                          )}
                          <td><SelRiwayat info={d.nominal[jenis][b.kode]} jenis={jenis} kode={b.kode} /></td>
                          {gabungan ? (
                            <td className="whitespace-nowrap">{jenis === "jabatan" ? jumlahKaryawan(d.pemakaian.jabatan[b.kode]) : b.sel[kolom.findIndex((k) => k.judul === "Dipakai")] ?? "-"}</td>
                          ) : (
                            tambahan.map((k) => <td key={k.judul} className={k.angka ? "kolom-angka whitespace-nowrap" : ""}>{k.isi(b.kode)}</td>)
                          )}
                          <td><Lencana warna={b.aktif ? "hijau" : "abu"}>{b.aktif ? "Aktif" : "Nonaktif"}</Lencana></td>
                          {adaAksiKolom && (
                            <td>
                              <div className="flex flex-col items-end gap-1.5">
                                {bolehNominal && b.aktif && <TautanTombol href={alamatNominal(jenis, b.kode)} kecil varian="utama">Ajukan nominal</TautanTombol>}
                                <AksiMaster jenis={jenis} kode={b.kode} aktif={b.aktif} alamatUbah={alamatBagian(jenis, b.kode)} bolehUbah={bolehUbah} bolehNonaktifkan={bolehNonaktifkan} />
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </Tabel>
              )}
            </Kartu>
          </div>
        );
      })}
    </>
  );
}
