/*
 * Tab Struktur gaji di Master SDM (komponen server): jabatan inhouse, jabatan event, golongan (gaji pokok), dan
 * tunjangan lain dalam satu halaman. Tabel database tetap terpisah; tambah, ubah, dan nonaktifkan memakai aksi master
 * yang sama (simpanMaster, ubahStatusMaster), jadi izinnya tetap per jenis seperti di DEF_MASTER.
 * Keadaan di URL: ?tab=struktur&jenis=<jenis>&form=baru|<kode>.
 */
import { Plus } from "lucide-react";
import { boleh, LABEL_PERAN, type Peran } from "@/lib/peran";
import { opsiMaster } from "@/lib/data/master/master";
import { dataStrukturGaji, type DataStrukturGaji } from "@/lib/data/master/struktur-gaji";
import { DEF_MASTER, JENIS_STRUKTUR, termasukStruktur, type JenisStruktur } from "@/lib/skema/master";
import { labelBulanTahun } from "@/lib/inti/tanggal";
import { rupiah } from "@/lib/format";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import Lencana from "@/komponen/ui/Lencana";
import { TautanTombol } from "@/komponen/ui/Tombol";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import Peringatan from "@/komponen/ui/Peringatan";
import FormMaster from "./FormMaster";
import AksiMaster from "./AksiMaster";

export const ALAMAT_STRUKTUR = "/master/sdm?tab=struktur";
export const alamatBagian = (jenis: JenisStruktur, form?: string) => `${ALAMAT_STRUKTUR}&jenis=${jenis}${form ? `&form=${form}` : ""}#bagian-${jenis}`;

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

export default async function BagianStrukturGaji({ peran, cari }: { peran: Peran; cari: { jenis?: string; form?: string } }) {
  const jenisForm = cari.jenis && termasukStruktur(cari.jenis) ? cari.jenis : null;
  const bolehForm = !!(jenisForm && cari.form && boleh(peran, DEF_MASTER[jenisForm].izin));
  const [d, opsi] = await Promise.all([dataStrukturGaji(), bolehForm ? opsiMaster() : Promise.resolve(null)]);
  const bolehNonaktifkan = boleh(peran, "master.nonaktifkan");
  const bolehSebagian = JENIS_STRUKTUR.some((j) => boleh(peran, DEF_MASTER[j].izin));

  const jabatanTampil = d.ringkasJabatan.filter((j) => j.aktif || j.karyawan);
  const golonganTampil = d.ringkasGolongan.filter((g) => g.aktif || g.karyawan);

  return (
    <>
      {!bolehSebagian && <Peringatan>Peran {LABEL_PERAN[peran]} hanya bisa melihat struktur gaji. Yang boleh mengubah: HRD dan Owner, khusus tarif jabatan event hanya Owner.</Peringatan>}

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
                  <span className="angka text-right text-slate-700">{rupiah(g.jumlah)}</span>
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

        let form: React.ReactNode = null;
        if (bolehForm && opsi && jenisForm === jenis) {
          const baris = cari.form === "baru" ? null : data.baris.find((b) => b.kode === cari.form);
          if (cari.form !== "baru" && !baris) form = <Peringatan jenis="galat">Data {cari.form} tidak ditemukan.</Peringatan>;
          else {
            const bawaan = Object.fromEntries(def.isian.filter((x) => x.bawaan).map((x) => [x.kunci, x.bawaan as string]));
            form = <FormMaster key={`${jenis}-${cari.form}`} def={def} opsi={opsi} kode={baris?.kode ?? null} awal={baris?.nilai ?? bawaan} alamatKembali={`${ALAMAT_STRUKTUR}#bagian-${jenis}`} />;
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
                      {tambahan.map((k) => <th key={k.judul} className={k.angka ? "kolom-angka" : ""}>{k.judul}</th>)}
                      <th>Status</th>
                      {adaAksi && <th className="text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.baris.map((b) => (
                      <tr key={b.kode} className={b.aktif ? "" : "text-slate-400"}>
                        <td className="kode">{b.kode}</td>
                        <td className="font-medium">{b.nama}</td>
                        {b.sel.map((s, i) => <td key={i} className={data.kolom[i]?.angka ? "kolom-angka angka" : ""}>{s}</td>)}
                        {tambahan.map((k) => <td key={k.judul} className={k.angka ? "kolom-angka whitespace-nowrap" : ""}>{k.isi(b.kode)}</td>)}
                        <td><Lencana warna={b.aktif ? "hijau" : "abu"}>{b.aktif ? "Aktif" : "Nonaktif"}</Lencana></td>
                        {adaAksi && (
                          <td>
                            <AksiMaster jenis={jenis} kode={b.kode} aktif={b.aktif} alamatUbah={alamatBagian(jenis, b.kode)} bolehUbah={bolehUbah} bolehNonaktifkan={bolehNonaktifkan} />
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
