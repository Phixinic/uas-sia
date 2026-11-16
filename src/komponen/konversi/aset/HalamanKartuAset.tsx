/*
 * Halaman Kartu Aset (komponen server). Filter status dan aset yang dibuka ada di query string:
 * ?status=AKTIF|DILEPAS|BATAL|SEMUA dan ?aset=AST-0001.
 */
import Link from "next/link";
import { wajibMasuk } from "@/lib/server/auth";
import { boleh } from "@/lib/peran";
import { ambilAset, daftarAset, hitungPerStatus } from "@/lib/data/konversi/aset";
import { labelTanggal } from "@/lib/inti/tanggal";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import { LencanaStatus } from "@/komponen/ui/Lencana";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import Peringatan from "@/komponen/ui/Peringatan";
import DetailAset from "./DetailAset";
import type { StatusAset } from "@/generated/prisma/enums";

const ALAMAT = "/konversi/kartu-aset";
const FILTER: { nilai: StatusAset | "SEMUA"; label: string }[] = [
  { nilai: "AKTIF", label: "Aktif" },
  { nilai: "DILEPAS", label: "Dilepas" },
  { nilai: "BATAL", label: "Batal" },
  { nilai: "SEMUA", label: "Semua" },
];

export default async function HalamanKartuAset({ cari }: { cari: { status?: string; aset?: string } }) {
  const pengguna = await wajibMasuk();
  const status = (FILTER.find((f) => f.nilai === cari.status)?.nilai ?? "AKTIF") as StatusAset | "SEMUA";
  const [daftar, hitung, aktifSemua, terbuka] = await Promise.all([
    daftarAset(status),
    hitungPerStatus(),
    daftarAset("AKTIF"),
    cari.aset ? ambilAset(cari.aset) : null,
  ]);
  const alamatFilter = (s: string) => `${ALAMAT}?status=${s}`;
  const alamatTutup = status === "AKTIF" ? ALAMAT : alamatFilter(status);
  const jumlahSemua = hitung.AKTIF + hitung.DILEPAS + hitung.BATAL;

  return (
    <>
      <KepalaHalaman
        judul="Kartu Aset"
        keterangan="Satu kartu untuk setiap unit peralatan. Buka satu aset untuk melihat rumus dan jadwal penyusutannya."
        aksi={
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter status aset">
            {FILTER.map((f) => (
              <Link key={f.nilai} href={alamatFilter(f.nilai)} aria-current={status === f.nilai ? "true" : undefined} className={`tombol tombol-kecil ${status === f.nilai ? "tombol-gelap" : "tombol-garis"}`}>
                {f.label} ({f.nilai === "SEMUA" ? jumlahSemua : hitung[f.nilai]})
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KartuRingkasan judul="Aset aktif" nilai={String(hitung.AKTIF)} bukanUang keterangan={`${hitung.DILEPAS} dilepas, ${hitung.BATAL} batal`} nada="hijau" />
        <KartuRingkasan judul="Nilai perolehan (aktif)" nilai={aktifSemua.reduce((s, a) => s + a.nilaiPerolehan, 0)} />
        <KartuRingkasan judul="Akumulasi disetujui (aktif)" nilai={aktifSemua.reduce((s, a) => s + a.akumulasi, 0)} />
        <KartuRingkasan judul="Nilai buku (aktif)" nilai={aktifSemua.reduce((s, a) => s + a.nilaiBuku, 0)} />
      </div>

      {cari.aset && !terbuka && <Peringatan jenis="galat">Aset {cari.aset} tidak ditemukan.</Peringatan>}
      {terbuka && <DetailAset a={terbuka} alamatTutup={alamatTutup} bolehLepas={boleh(pengguna.peran, "pelepasan.ajukan")} />}

      <Kartu rapat>
        <KepalaKartu judul="Daftar aset" keterangan={`${daftar.length} kartu`} />
        {daftar.length === 0 ? (
          <KeadaanKosong
            judul={status === "AKTIF" || status === "SEMUA" ? "Belum ada kartu aset" : "Tidak ada aset dengan status ini"}
            keterangan={status === "AKTIF" || status === "SEMUA" ? "Kartu dibuat saat pembelian peralatan diposting." : undefined}
          />
        ) : (
          <Tabel label="Daftar kartu aset">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Peralatan</th>
                <th>Diperoleh</th>
                <th className="kolom-angka">Perolehan (Rp)</th>
                <th>n</th>
                <th className="kolom-angka">d (Rp)</th>
                <th className="kolom-angka">Periode n (Rp)</th>
                <th className="kolom-angka">Nilai buku (Rp)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((a) => (
                <tr key={a.kode} className={cari.aset === a.kode ? "bg-aksen-lembut/50" : ""}>
                  <td><Link className="kode hover:underline" href={`${ALAMAT}?status=${status}&aset=${a.kode}`}>{a.kode}</Link></td>
                  <td>{a.nama}</td>
                  <td className="whitespace-nowrap">{labelTanggal(a.tglPerolehan)}</td>
                  <td className="kolom-angka"><Rupiah nilai={a.nilaiPerolehan} polos /></td>
                  <td className="whitespace-nowrap">{a.n} <span className="text-xs text-slate-500">{a.dasarN === "GARANSI" ? "garansi" : "manfaat"}</span></td>
                  <td className="kolom-angka"><Rupiah nilai={a.d} polos /></td>
                  <td className="kolom-angka"><Rupiah nilai={a.terakhir} polos /></td>
                  <td className="kolom-angka"><Rupiah nilai={a.nilaiBuku} polos /></td>
                  <td><LencanaStatus jenis="aset" status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>
    </>
  );
}
