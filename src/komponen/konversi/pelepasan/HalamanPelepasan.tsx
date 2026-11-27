/*
 * Halaman Pelepasan Peralatan (komponen server). Keadaan di URL: ?form=baru[&aset=AST-0001] membuka form,
 * ?lihat=PLP-2026-0001 membuka rincian satu pengajuan.
 */
import { Plus } from "lucide-react";
import { wajibMasuk } from "@/lib/server/auth";
import { boleh } from "@/lib/peran";
import { petaAkun } from "@/lib/data/umum";
import { dataPelepasan } from "@/lib/data/konversi/aset";
import { barisPelepasan } from "@/lib/inti/jurnal";
import { hariIni, labelTanggal } from "@/lib/inti/tanggal";
import { LABEL_ALASAN_PELEPASAN } from "@/lib/format";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import { LencanaStatus } from "@/komponen/ui/Lencana";
import { TautanTombol } from "@/komponen/ui/Tombol";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import TabelJurnal from "@/komponen/ui/TabelJurnal";
import FormPelepasan from "./FormPelepasan";
import AksiPelepasan from "./AksiPelepasan";
import { belumDiAtas, belumDiputuskan } from "@/lib/inti/urut";

const ALAMAT = "/konversi/pelepasan";

export default async function HalamanPelepasan({ cari }: { cari: { form?: string; lihat?: string; aset?: string } }) {
  const pengguna = await wajibMasuk();
  const [d, namaAkun] = await Promise.all([dataPelepasan(), petaAkun()]);
  const bolehAjukan = boleh(pengguna.peran, "pelepasan.ajukan");
  const diajukan = d.pelepasan.filter((p) => p.status === "DIAJUKAN");
  const disetujui = d.pelepasan.filter((p) => p.status === "DISETUJUI");
  const lihat = cari.lihat ? d.pelepasan.find((p) => p.no === cari.lihat) : null;
  const tampilForm = !!cari.form && bolehAjukan;

  const labaRugi = (n: number) => (n < 0 ? <span className="text-rose-600">Rugi <Rupiah nilai={-n} polos /></span> : n > 0 ? <>Laba <Rupiah nilai={n} polos /></> : "0");

  return (
    <>
      <KepalaHalaman
        judul="Pelepasan Peralatan"
        keterangan="Untuk peralatan yang dijual, dibuang, atau hilang. Nilai buku memakai penyusutan yang sudah disetujui. Setelah disetujui Owner, jadwal sisanya dibatalkan dan jurnal pelepasan dibuat."
        aksi={bolehAjukan && !tampilForm ? <TautanTombol href={`${ALAMAT}?form=baru`} varian="utama" ikon={<Plus className="size-4" />}>Ajukan pelepasan</TautanTombol> : null}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KartuRingkasan judul="Menunggu keputusan Owner" nilai={String(diajukan.length)} bukanUang nada={diajukan.length ? "kuning" : "netral"} keterangan={diajukan.length ? diajukan.map((p) => p.asetKode).join(", ") : "Tidak ada pengajuan"} />
        <KartuRingkasan judul="Pelepasan disetujui" nilai={String(disetujui.length)} bukanUang nada="hijau" keterangan={`${d.aset.length} aset masih aktif`} />
        <KartuRingkasan judul="Laba/rugi pelepasan" nilai={disetujui.reduce((s, p) => s + p.labaRugi, 0)} keterangan="Dari pelepasan yang disetujui" />
      </div>

      {!bolehAjukan && <Peringatan>Pelepasan diajukan oleh Admin, lalu Owner menyetujui atau menolaknya.</Peringatan>}
      {tampilForm && <FormPelepasan key={cari.aset ?? "baru"} aset={d.aset} namaAkun={namaAkun} asetAwal={d.aset.some((a) => a.kode === cari.aset) ? cari.aset! : ""} tanggalAwal={hariIni()} alamatKembali={ALAMAT} />}

      {cari.lihat && !tampilForm && !lihat && <Peringatan jenis="galat">Pengajuan {cari.lihat} tidak ditemukan.</Peringatan>}
      {lihat && !tampilForm && (
        <Kartu rapat>
          <KepalaKartu
            judul={<span className="flex flex-wrap items-center gap-2"><span className="kode text-[15px]! text-slate-900!">{lihat.no}</span><LencanaStatus jenis="persetujuan" status={lihat.status} /></span>}
            keterangan={`${lihat.asetKode} ${lihat.nama}, ${LABEL_ALASAN_PELEPASAN[lihat.alasan].toLowerCase()} ${labelTanggal(lihat.tanggal)}. Diajukan ${lihat.dibuatOleh}${lihat.disetujuiOleh ? `, diputuskan ${lihat.disetujuiOleh}` : ""}.`}
            aksi={
              <>
                <AksiPelepasan no={lihat.no} status={lihat.status} peran={pengguna.peran} alamat={ALAMAT} tanpaLihat />
                <TautanTombol href={ALAMAT} kecil varian="hantu">Tutup</TautanTombol>
              </>
            }
          />
          <div className="space-y-4 p-5">
            {lihat.status === "DITOLAK" && <Peringatan jenis="galat">Ditolak: {lihat.alasanTolak}</Peringatan>}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <div><div className="teks-label">Perolehan</div><div className="font-semibold"><Rupiah nilai={lihat.nilaiPerolehan} /></div></div>
              <div><div className="teks-label">Akumulasi</div><div className="font-semibold"><Rupiah nilai={lihat.akumulasi} /></div></div>
              <div><div className="teks-label">Nilai buku</div><div className="font-semibold"><Rupiah nilai={lihat.nilaiBuku} /></div></div>
              <div><div className="teks-label">Harga jual</div><div className="font-semibold"><Rupiah nilai={lihat.hargaJual} /></div></div>
              <div><div className="teks-label">{lihat.labaRugi < 0 ? "Rugi" : "Laba"}</div><div className={`font-semibold ${lihat.labaRugi < 0 ? "text-rose-600" : ""}`}><Rupiah nilai={Math.abs(lihat.labaRugi)} /></div></div>
            </div>
            <details open>
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">{lihat.jurnalNo ? `Jurnal pelepasan ${lihat.jurnalNo}` : "Jurnal pelepasan (dibuat saat disetujui)"}</summary>
              <div className="mt-3">
                <TabelJurnal
                  baris={lihat.jurnalBaris ?? barisPelepasan({ nilaiPerolehan: lihat.nilaiPerolehan, akumulasi: lihat.akumulasi, hargaJual: lihat.hargaJual, akunAset: lihat.akunAset, akunAkumulasi: lihat.akunAkumulasi })}
                  namaAkun={namaAkun}
                />
              </div>
            </details>
          </div>
        </Kartu>
      )}

      <Kartu rapat>
        <KepalaKartu judul="Daftar pengajuan" keterangan={`${d.pelepasan.length} dokumen`} />
        {d.pelepasan.length === 0 ? (
          <KeadaanKosong judul="Belum ada pengajuan pelepasan" keterangan={bolehAjukan ? 'Tekan "Ajukan pelepasan" untuk membuat yang pertama.' : undefined} />
        ) : (
          <Tabel label="Daftar pengajuan pelepasan">
            <thead>
              <tr>
                <th>No.</th>
                <th>Aset</th>
                <th>Tanggal</th>
                <th>Alasan</th>
                <th className="kolom-angka">Harga jual (Rp)</th>
                <th className="kolom-angka">Nilai buku (Rp)</th>
                <th className="kolom-angka">Laba/rugi (Rp)</th>
                <th>Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {belumDiAtas(d.pelepasan, (p) => belumDiputuskan(p.status)).map((p) => (
                <tr key={p.no} className={cari.lihat === p.no ? "bg-aksen-lembut/50" : ""}>
                  <td className="kode">{p.no}</td>
                  <td><span className="kode mr-1">{p.asetKode}</span>{p.nama}</td>
                  <td className="whitespace-nowrap">{labelTanggal(p.tanggal)}</td>
                  <td>{LABEL_ALASAN_PELEPASAN[p.alasan]}</td>
                  <td className="kolom-angka"><Rupiah nilai={p.hargaJual} polos /></td>
                  <td className="kolom-angka"><Rupiah nilai={p.nilaiBuku} polos /></td>
                  <td className="kolom-angka whitespace-nowrap">{labaRugi(p.labaRugi)}</td>
                  <td>
                    <LencanaStatus jenis="persetujuan" status={p.status} />
                    {p.jurnalNo && <div className="kode mt-0.5 text-[11px]!">{p.jurnalNo}</div>}
                    {p.alasanTolak && <div className="mt-0.5 max-w-48 text-[11px] text-rose-600">{p.alasanTolak}</div>}
                  </td>
                  <td><AksiPelepasan no={p.no} status={p.status} peran={pengguna.peran} alamat={ALAMAT} /></td>
                </tr>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>
    </>
  );
}
