import Link from "next/link";
import { X } from "lucide-react";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import TabelJurnal from "@/komponen/ui/TabelJurnal";
import { LencanaStatus } from "@/komponen/ui/Lencana";
import { TautanTombol } from "@/komponen/ui/Tombol";
import Peringatan from "@/komponen/ui/Peringatan";
import AksiPembelian from "./AksiPembelian";
import { LABEL_DASAR_N, labelCaraBayar, labelWaktu, namaSupplierAtauSumber } from "@/lib/format";
import { dariDate, labelTanggal } from "@/lib/inti/tanggal";
import type { ambilPembelian } from "@/lib/data/konversi/pembelian";
import type { Peran } from "@/lib/peran";

type Pembelian = NonNullable<Awaited<ReturnType<typeof ambilPembelian>>>;

/** Rincian satu pembelian: kepala dokumen, baris barang, jurnal, jurnal pembalik, dan kartu aset yang terbentuk. */
export default function DetailPembelian({ b, namaAkun, peran, alamat }: { b: Pembelian; namaAkun: Record<string, string>; peran: Peran; alamat: string }) {
  const peralatan = b.jenis === "PERALATAN";
  const aset = b.detail.flatMap((d) => d.aset);
  const ubin = (label: string, isi: React.ReactNode) => (
    <div>
      <div className="teks-label">{label}</div>
      <div className="mt-0.5 font-medium text-slate-800">{isi}</div>
    </div>
  );
  return (
    <Kartu rapat>
      <KepalaKartu
        judul={<span className="flex items-center gap-2"><span className="kode text-[15px]! text-slate-900!">{b.no}</span><LencanaStatus jenis="pembelian" status={b.status} /></span>}
        keterangan={`Dibuat ${b.dibuatOleh.nama}, ${labelWaktu(b.dibuatPada)}${b.disetujuiOleh ? ` · diposting ${b.disetujuiOleh.nama}, ${labelWaktu(b.disetujuiPada)}` : ""}`}
        aksi={
          <>
            <AksiPembelian no={b.no} status={b.status} total={b.total} peralatan={peralatan} peran={peran} alamat={alamat} />
            <TautanTombol href={alamat} kecil varian="hantu" ikon={<X className="size-4" />}>Tutup</TautanTombol>
          </>
        }
      />
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {ubin("Tanggal", labelTanggal(dariDate(b.tanggal)))}
          {ubin("Supplier", namaSupplierAtauSumber(b.supplier?.nama, b.sumberInvestasi))}
          {ubin("Cara bayar", `${labelCaraBayar(b.caraBayar, b.sumberInvestasi)}${b.jatuhTempo ? `, jatuh tempo ${labelTanggal(dariDate(b.jatuhTempo))}` : ""}`)}
          {ubin("Total", <Rupiah nilai={b.total} />)}
        </div>
        {b.keterangan && <p className="teks-redup">{b.keterangan}</p>}
        {b.status === "DIBALIK" && (
          <Peringatan jenis="awas">
            Dibalik {b.dibalikOleh?.nama} pada {labelWaktu(b.dibalikPada)}: {b.alasanBalik}
          </Peringatan>
        )}
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <Tabel label="Baris barang">
            <thead>
              <tr>
                <th>#</th>
                <th>Barang</th>
                <th className="kolom-angka">Jumlah</th>
                <th className="kolom-angka">Harga (Rp)</th>
                <th className="kolom-angka">Subtotal (Rp)</th>
                {peralatan && <th>Penyusutan</th>}
              </tr>
            </thead>
            <tbody>
              {b.detail.map((d) => (
                <tr key={d.noUrut}>
                  <td>{d.noUrut}</td>
                  <td>
                    <span className="kode mr-2">{d.peralatanKode ?? d.perlengkapanKode}</span>
                    {d.peralatan?.nama ?? d.perlengkapan?.nama}
                  </td>
                  <td className="kolom-angka">{d.qty} {d.peralatan?.satuan ?? d.perlengkapan?.satuan}</td>
                  <td className="kolom-angka"><Rupiah nilai={d.harga} polos /></td>
                  <td className="kolom-angka"><Rupiah nilai={d.qty * d.harga} polos /></td>
                  {peralatan && (
                    <td className="text-[12px] text-slate-600">
                      residu <Rupiah nilai={d.residu} />, garansi {d.garansiBulan} bln, manfaat {d.masaManfaatBulan} bln, n dari {LABEL_DASAR_N[d.dasarN ?? "GARANSI"].toLowerCase()}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Tabel>
        </div>
        {b.jurnal && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Jurnal umum {b.jurnal.no}</h3>
            <TabelJurnal baris={b.jurnal.detail.map((x) => ({ akun: x.akunKode, debit: x.debit, kredit: x.kredit }))} namaAkun={namaAkun} />
          </div>
        )}
        {b.jurnalPembalik && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Jurnal pembalik {b.jurnalPembalik.no}</h3>
            <TabelJurnal baris={b.jurnalPembalik.detail.map((x) => ({ akun: x.akunKode, debit: x.debit, kredit: x.kredit }))} namaAkun={namaAkun} />
          </div>
        )}
        {aset.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Kartu aset ({aset.length})</h3>
            <div className="flex flex-wrap gap-2">
              {aset.map((a) => (
                <Link key={a.kode} href={`/konversi/kartu-aset?aset=${a.kode}`} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] hover:border-aksen">
                  <span className="kode">{a.kode}</span>
                  <span className="text-slate-500">n {a.n}, d <Rupiah nilai={a.d} polos /></span>
                  <LencanaStatus jenis="aset" status={a.status} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Kartu>
  );
}
