/*
 * Halaman Master Konversi dan Master SDM (komponen server). Satu komponen untuk dua kelompok:
 * tab jenis master, daftar, form tambah/ubah, dan (Master Konversi) profil usaha.
 * Keadaan di URL: ?tab=<jenis>&form=baru | ?form=<kode>.
 * Master SDM punya tab Struktur gaji (jabatan, jabatan event, golongan, tunjangan dalam satu halaman, lihat
 * BagianStrukturGaji); tautan lama ke tab keempat jenis itu dialihkan ke sana.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { wajibMasuk } from "@/lib/server/auth";
import { boleh, LABEL_PERAN } from "@/lib/peran";
import { profilUsaha } from "@/lib/data/umum";
import { daftarMaster, opsiMaster } from "@/lib/data/master/master";
import { DAFTAR_KELOMPOK, DEF_MASTER, TAB_SDM, termasukStruktur, type JenisMaster, type KelompokMaster } from "@/lib/skema/master";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import Lencana from "@/komponen/ui/Lencana";
import { TautanTombol } from "@/komponen/ui/Tombol";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import Peringatan from "@/komponen/ui/Peringatan";
import FormMaster from "./FormMaster";
import AksiMaster from "./AksiMaster";
import FormProfil from "./FormProfil";
import { ALAMAT_SETTING_GAJI } from "./HalamanSettingGaji";
import BagianStrukturGaji, { ALAMAT_STRUKTUR, alamatBagian } from "./BagianStrukturGaji";

/** Tab navigasi: Master Konversi per jenis master, Master SDM menurut TAB_SDM. */
function NavMaster({ kelompok, aktif }: { kelompok: KelompokMaster; aktif: string }) {
  const daftar =
    kelompok === "sdm"
      ? TAB_SDM.map((t) => ({ kunci: t.tab as string, label: t.label as string, href: t.tab === "setgaji" ? ALAMAT_SETTING_GAJI : t.tab === "struktur" ? ALAMAT_STRUKTUR : `/master/sdm?tab=${t.tab}` }))
      : DAFTAR_KELOMPOK.konversi.map((j) => ({ kunci: j as string, label: DEF_MASTER[j].label, href: `/master/konversi?tab=${j}` }));
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Jenis master">
      {daftar.map((t) => (
        <Link key={t.kunci} href={t.href} aria-current={t.kunci === aktif ? "page" : undefined} className={`tombol tombol-kecil ${t.kunci === aktif ? "tombol-gelap" : "tombol-garis"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function HalamanMaster({ kelompok, cari }: { kelompok: KelompokMaster; cari: { tab?: string; form?: string; karyawan?: string; jenis?: string; nominal?: string; riwayat?: string; kelompok?: string } }) {
  const pengguna = await wajibMasuk();
  if (kelompok === "sdm" && cari.tab) {
    // Jabatan, jabatan event, golongan, dan tunjangan sekarang satu tab; tautan lama (termasuk ?form=) tetap berfungsi.
    if (termasukStruktur(cari.tab)) redirect(alamatBagian(cari.tab, cari.form));
    if (cari.tab === "struktur") {
      return (
        <>
          <KepalaHalaman
            judul="Master SDM"
            keterangan="Struktur gaji menyatukan jabatan inhouse, jabatan event, golongan (gaji pokok), dan tunjangan lain di satu halaman. Data master tidak pernah dihapus, hanya dinonaktifkan oleh Owner."
          />
          <NavMaster kelompok="sdm" aktif="struktur" />
          <BagianStrukturGaji peran={pengguna.peran} cari={cari} />
        </>
      );
    }
  }
  const jenisAda = kelompok === "sdm" ? DAFTAR_KELOMPOK.sdm.filter((j) => !termasukStruktur(j)) : DAFTAR_KELOMPOK[kelompok];
  const jenis: JenisMaster = jenisAda.find((j) => j === cari.tab) ?? jenisAda[0];
  // Setting gaji punya halaman sendiri (riwayat versi dan persetujuan Owner); tautan lama tab ini dialihkan ke sana.
  if (jenis === "setgaji") {
    const q = new URLSearchParams();
    if (cari.form) q.set("form", "baru");
    if (cari.karyawan) q.set("karyawan", cari.karyawan);
    redirect(`${ALAMAT_SETTING_GAJI}${q.size ? `?${q}` : ""}`);
  }
  const def = DEF_MASTER[jenis];
  const dasar = kelompok === "konversi" ? "/master/konversi" : "/master/sdm";
  const alamatDaftar = `${dasar}?tab=${jenis}`;
  const bolehUbah = boleh(pengguna.peran, def.izin);
  const bolehNonaktifkan = boleh(pengguna.peran, "master.nonaktifkan");

  const [data, opsi] = await Promise.all([daftarMaster(jenis), cari.form && bolehUbah ? opsiMaster() : Promise.resolve(null)]);

  let form: React.ReactNode = null;
  if (cari.form && bolehUbah && opsi) {
    const baris = cari.form === "baru" ? null : data.baris.find((b) => b.kode === cari.form);
    if (cari.form !== "baru" && !baris) form = <Peringatan jenis="galat">Data {cari.form} tidak ditemukan.</Peringatan>;
    else {
      const bawaan = Object.fromEntries(def.isian.filter((d) => d.bawaan).map((d) => [d.kunci, d.bawaan as string]));
      form = <FormMaster key={`${jenis}-${cari.form}`} def={def} opsi={opsi} kode={baris?.kode ?? null} awal={baris?.nilai ?? bawaan} alamatKembali={alamatDaftar} />;
    }
  }

  const kunciMaster = kelompok === "sdm" ? "HRD dan Owner" : "Admin dan Owner";
  const profil = kelompok === "konversi" && pengguna.peran === "OWNER" ? await profilUsaha() : null;

  return (
    <>
      <KepalaHalaman
        judul={kelompok === "sdm" ? "Master SDM" : "Master Konversi"}
        keterangan={`Data master tidak pernah dihapus, hanya dinonaktifkan, supaya transaksi lama tetap terbaca. ${def.petunjuk ?? `${kunciMaster} bisa menambah dan mengubah. Menonaktifkan hanya Owner.`}`}
        aksi={bolehUbah && !form ? <TautanTombol href={`${alamatDaftar}&form=baru`} varian="utama" ikon={<Plus className="size-4" />}>{def.label} baru</TautanTombol> : null}
      />

      <NavMaster kelompok={kelompok} aktif={jenis} />

      {!bolehUbah && <Peringatan>Peran {LABEL_PERAN[pengguna.peran]} hanya bisa melihat {def.label.toLowerCase()}. Yang boleh mengubah: {def.izin === "master.akun-kategori" || def.izin === "tarif-event.ubah" ? "Owner" : kunciMaster}.</Peringatan>}
      {form}

      <Kartu rapat>
        <KepalaKartu judul={`Daftar ${def.label.toLowerCase()}`} keterangan={`${data.baris.length} data`} />
        {data.baris.length === 0 ? (
          <KeadaanKosong judul={`Belum ada data ${def.label.toLowerCase()}`} keterangan={bolehUbah ? `Tekan "${def.label} baru" untuk menambah.` : undefined} />
        ) : (
          <Tabel label={`Daftar ${def.label.toLowerCase()}`}>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama</th>
                {data.kolom.map((k) => <th key={k.judul} className={k.angka ? "kolom-angka" : ""}>{k.judul}</th>)}
                <th>Status</th>
                {(bolehUbah || bolehNonaktifkan) && <th className="text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {data.baris.map((b) => (
                <tr key={b.kode} className={b.aktif ? "" : "text-slate-400"}>
                  <td className="kode">{b.kode}</td>
                  <td className="font-medium">{b.nama}</td>
                  {b.sel.map((s, i) => <td key={i} className={data.kolom[i]?.angka ? "kolom-angka angka" : ""}>{s}</td>)}
                  <td><Lencana warna={b.aktif ? "hijau" : "abu"}>{b.aktif ? "Aktif" : "Nonaktif"}</Lencana></td>
                  {(bolehUbah || bolehNonaktifkan) && (
                    <td>
                      <AksiMaster jenis={jenis} kode={b.kode} aktif={b.aktif} alamatUbah={`${alamatDaftar}&form=${b.kode}`} bolehUbah={bolehUbah} bolehNonaktifkan={bolehNonaktifkan && jenis !== "jadwal"} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>

      {profil && <FormProfil awal={{ nama: profil.nama, keterangan: profil.keterangan }} />}
    </>
  );
}
