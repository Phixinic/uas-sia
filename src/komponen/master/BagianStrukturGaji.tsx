/*
 * Tab Struktur gaji di Master SDM (komponen server): jabatan inhouse, jabatan event, golongan (gaji pokok), dan
 * tunjangan lain dalam satu halaman. Tabel database tetap terpisah; tambah, ubah, dan nonaktifkan memakai aksi master
 * yang sama (simpanMaster, ubahStatusMaster), jadi izinnya tetap per jenis seperti di DEF_MASTER.
 * Keadaan di URL: ?tab=struktur&jenis=<jenis>&form=baru|<kode>, &nominal=<kode> (form ajukan perubahan nominal),
 * &riwayat=<kode> (riwayat nominal satu item).
 * Nominal (gaji pokok, tunjangan, tunjangan jabatan, tarif event) berversi: kolom nominal = nilai yang berlaku bulan
 * berjalan, kolom "Riwayat nominal" = sejak kapan berlaku, versi berikutnya yang sudah disetujui, dan pengajuan menunggu.
 */
import Link from "next/link";
import { Plus } from "lucide-react";
import { boleh, LABEL_PERAN, type KunciIzin, type Peran } from "@/lib/peran";
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

export const ALAMAT_STRUKTUR = "/master/sdm?tab=struktur";
export const alamatBagian = (jenis: JenisStruktur, form?: string) => `${ALAMAT_STRUKTUR}&jenis=${jenis}${form ? `&form=${form}` : ""}#bagian-${jenis}`;
export const alamatNominal = (jenis: JenisStruktur, kode: string) => `${ALAMAT_STRUKTUR}&jenis=${jenis}&nominal=${kode}#bagian-${jenis}`;
export const alamatRiwayat = (jenis: JenisStruktur, kode: string) => `${ALAMAT_STRUKTUR}&jenis=${jenis}&riwayat=${kode}#riwayat-nominal`;

/** Izin mengajukan perubahan nominal: tarif jabatan event hanya Owner, nominal lain HRD dan Owner. */
const IZIN_NOMINAL: Record<JenisStruktur, KunciIzin> = { jabatan: "nominal.ajukan", jabatanEvent: "tarif-event.ubah", golongan: "nominal.ajukan", tunjangan: "nominal.ajukan" };

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

const BAGIAN: Record<JenisStruktur, { judul: string; keterangan: string; pengubah: string }> = {
  jabatan: {
    judul: "Jabatan inhouse",
    keterangan: "Tunjangan jabatan dan tunjangan istri/anak (hanya PTKP K) ikut setting gaji. Jam kerja diatur di tab Jadwal kerja.",
    pengubah: "HRD dan Owner",
  },
  jabatanEvent: {
    judul: "Jabatan event",
    keterangan: "Peran, satuan tarif, dan tarif fee crew freelance. Tarif baru langsung dipakai untuk usulan fee yang belum disetujui.",
    pengubah: "Owner",
  },
  golongan: {
    judul: "Golongan (gaji pokok)",
    keterangan: "Gaji pokok per bulan. Potongan absen dihitung dari gaji pokok dibagi hari kerja.",
    pengubah: "HRD dan Owner",
  },
  tunjangan: {
    judul: "Tunjangan lain",
    keterangan: "Nominal per bulan, dipilih per karyawan di setting gaji.",
    pengubah: "HRD dan Owner",
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

export default async function BagianStrukturGaji({ peran, cari }: { peran: Peran; cari: { jenis?: string; form?: string; nominal?: string; riwayat?: string } }) {
  const jenisForm = cari.jenis && termasukStruktur(cari.jenis) ? cari.jenis : null;
  const bolehForm = !!(jenisForm && cari.form && boleh(peran, DEF_MASTER[jenisForm].izin));
  const bolehFormNominal = !!(jenisForm && cari.nominal && boleh(peran, IZIN_NOMINAL[jenisForm]));
  const [d, opsi, terkunci] = await Promise.all([
    dataStrukturGaji(),
    bolehForm ? opsiMaster() : Promise.resolve(null),
    bolehFormNominal ? periodeTerkunciSemua() : Promise.resolve([] as string[]),
  ]);
  const bolehPutuskan = boleh(peran, "nominal.putuskan");
  const riwayatItem = jenisForm && cari.riwayat ? d.daftar[jenisForm].baris.find((b) => b.kode === cari.riwayat) : null;
  const bolehNonaktifkan = boleh(peran, "master.nonaktifkan");
  const bolehSebagian = JENIS_STRUKTUR.some((j) => boleh(peran, DEF_MASTER[j].izin));

  const jabatanTampil = d.ringkasJabatan.filter((j) => j.aktif || j.karyawan);
  const golonganTampil = d.ringkasGolongan.filter((g) => g.aktif || g.karyawan);

  return (
    <>
      {!bolehSebagian && <Peringatan>Peran {LABEL_PERAN[peran]} hanya bisa melihat struktur gaji. Yang boleh mengubah: HRD dan Owner, khusus tarif jabatan event hanya Owner.</Peringatan>}

      <Kartu rapat label="Pengajuan nominal">
        <KepalaKartu
          judul={`Pengajuan nominal menunggu Owner (${d.pengajuan.length})`}
          keterangan={bolehPutuskan ? "Bandingkan nominal lama dan baru, lalu setujui atau tolak dengan alasan." : "Gaji pokok, tunjangan, dan tunjangan jabatan diajukan HRD atau Owner; tarif event hanya Owner. Owner yang memutuskan."}
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
              {(d.riwayat[jenisForm][riwayatItem.kode] ?? []).slice().reverse().map((v) => (
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

      {JENIS_STRUKTUR.map((jenis) => {
        const def = DEF_MASTER[jenis];
        const info = BAGIAN[jenis];
        const data = d.daftar[jenis];
        const bolehUbah = boleh(peran, def.izin);
        const tambahan = kolomTambahan(jenis, d);
        const adaAksi = bolehUbah || bolehNonaktifkan;

        const bolehNominal = boleh(peran, IZIN_NOMINAL[jenis]);
        const kembali = `${ALAMAT_STRUKTUR}#bagian-${jenis}`;
        let form: React.ReactNode = null;
        if (bolehForm && opsi && jenisForm === jenis) {
          const baris = cari.form === "baru" ? null : data.baris.find((b) => b.kode === cari.form);
          if (cari.form !== "baru" && !baris) form = <Peringatan jenis="galat">Data {cari.form} tidak ditemukan.</Peringatan>;
          else {
            const bawaan = Object.fromEntries(def.isian.filter((x) => x.bawaan).map((x) => [x.kunci, x.bawaan as string]));
            form = (
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
        } else if (bolehFormNominal && jenisForm === jenis) {
          const baris = data.baris.find((b) => b.kode === cari.nominal);
          const info = baris ? d.nominal[jenis][baris.kode] : undefined;
          if (!baris || !info) form = <Peringatan jenis="galat">Data {cari.nominal} tidak ditemukan.</Peringatan>;
          else if (!baris.aktif) form = <Peringatan jenis="galat">{baris.nama} sudah dinonaktifkan, jadi nominalnya tidak bisa diubah.</Peringatan>;
          else {
            const ringkas = (v: TampilNominal | null) => (v ? { kode: v.kode, teks: v.teks, berlakuMulai: v.berlakuMulai } : null);
            form = (
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
        }

        return (
          <div key={jenis} id={`bagian-${jenis}`} className="scroll-mt-20 space-y-4">
            {form}
            <Kartu rapat label={info.judul}>
              <KepalaKartu
                judul={info.judul}
                keterangan={`${data.baris.length} data. ${info.keterangan}`}
                aksi={bolehUbah && !form ? <TautanTombol href={alamatBagian(jenis, "baru")} kecil varian="utama" ikon={<Plus className="size-4" />}>{def.label} baru</TautanTombol> : null}
              />
              {!bolehUbah && bolehSebagian && (
                <div className="border-b border-slate-100 px-5 py-3">
                  <Peringatan>Peran {LABEL_PERAN[peran]} hanya bisa melihat {def.label.toLowerCase()}. Yang boleh mengubah: {info.pengubah}.</Peringatan>
                </div>
              )}
              {data.baris.length === 0 ? (
                <KeadaanKosong judul={`Belum ada data ${def.label.toLowerCase()}`} keterangan={bolehUbah ? `Tekan "${def.label} baru" untuk menambah.` : undefined} />
              ) : (
                <Tabel label={`Daftar ${info.judul.toLowerCase()}`}>
                  <thead>
                    <tr>
                      <th>Kode</th>
                      <th>Nama</th>
                      {data.kolom.map((k) => <th key={k.judul} className={k.angka ? "kolom-angka" : ""}>{k.judul}</th>)}
                      <th>Riwayat nominal</th>
                      {tambahan.map((k) => <th key={k.judul} className={k.angka ? "kolom-angka" : ""}>{k.judul}</th>)}
                      <th>Status</th>
                      {(adaAksi || bolehNominal) && <th className="text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.baris.map((b) => (
                      <tr key={b.kode} className={b.aktif ? "" : "text-slate-400"}>
                        <td className="kode">{b.kode}</td>
                        <td className="font-medium">{b.nama}</td>
                        {b.sel.map((s, i) => <td key={i} className={data.kolom[i]?.angka ? "kolom-angka angka" : ""}>{s}</td>)}
                        <td><SelRiwayat info={d.nominal[jenis][b.kode]} jenis={jenis} kode={b.kode} /></td>
                        {tambahan.map((k) => <td key={k.judul} className={k.angka ? "kolom-angka whitespace-nowrap" : ""}>{k.isi(b.kode)}</td>)}
                        <td><Lencana warna={b.aktif ? "hijau" : "abu"}>{b.aktif ? "Aktif" : "Nonaktif"}</Lencana></td>
                        {(adaAksi || bolehNominal) && (
                          <td>
                            <div className="flex flex-col items-end gap-1.5">
                              {bolehNominal && b.aktif && <TautanTombol href={alamatNominal(jenis, b.kode)} kecil varian="utama">Ajukan nominal</TautanTombol>}
                              <AksiMaster jenis={jenis} kode={b.kode} aktif={b.aktif} alamatUbah={alamatBagian(jenis, b.kode)} bolehUbah={bolehUbah} bolehNonaktifkan={bolehNonaktifkan} />
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
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
