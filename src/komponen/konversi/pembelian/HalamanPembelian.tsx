/*
 * Halaman Pembelian Peralatan / Perlengkapan (komponen server). POLA RUJUKAN untuk halaman lain:
 * - wajibMasuk() di awal, data dibaca lewat src/lib/data/*, peran untuk tampilan lewat boleh().
 * - Keadaan halaman disimpan di URL (?form=baru | ?form=<no> | ?lihat=<no>), jadi bisa dibagikan dan tombol kembali bekerja.
 * - Perubahan data hanya lewat server action di src/lib/aksi/* yang dipanggil komponen klien.
 */
import { Plus } from "lucide-react";
import { wajibMasuk } from "@/lib/server/auth";
import { boleh } from "@/lib/peran";
import { petaAkun, periodeTerkunciSemua } from "@/lib/data/umum";
import { ambilPembelian, daftarPembelian, opsiFormPembelian } from "@/lib/data/konversi/pembelian";
import { dariDate, hariIni, labelTanggal } from "@/lib/inti/tanggal";
import { LABEL_CARA_BAYAR } from "@/lib/format";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import { LencanaStatus } from "@/komponen/ui/Lencana";
import { TautanTombol } from "@/komponen/ui/Tombol";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import Peringatan from "@/komponen/ui/Peringatan";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import FormPembelian from "./FormPembelian";
import { formKosong, type NilaiAwalForm } from "./nilai-awal";
import AksiPembelian from "./AksiPembelian";
import DetailPembelian from "./DetailPembelian";
import type { JenisPembelian } from "@/generated/prisma/enums";
import { belumDiAtas, belumDiputuskan } from "@/lib/inti/urut";

export default async function HalamanPembelian({ jenis, cari }: { jenis: JenisPembelian; cari: { form?: string; lihat?: string } }) {
  const pengguna = await wajibMasuk();
  const peralatan = jenis === "PERALATAN";
  const L = peralatan ? "Peralatan" : "Perlengkapan";
  const alamat = peralatan ? "/konversi/pembelian-peralatan" : "/konversi/pembelian-perlengkapan";
  const bolehDraf = boleh(pengguna.peran, "pembelian.kelola-draf");

  const [daftar, namaAkun] = await Promise.all([daftarPembelian(jenis), petaAkun()]);

  // ----- Form (baru / ubah draf) -----
  let form: React.ReactNode = null;
  if (cari.form && bolehDraf) {
    const noDraf = cari.form === "baru" ? undefined : cari.form;
    const [opsi, terkunci] = await Promise.all([opsiFormPembelian(jenis, noDraf), periodeTerkunciSemua()]);
    if (noDraf && (!opsi.draf || opsi.draf.status !== "DRAFT" || opsi.draf.jenis !== jenis)) {
      form = <Peringatan jenis="galat">Draf {noDraf} tidak ditemukan atau sudah diposting.</Peringatan>;
    } else {
      const d = opsi.draf;
      const awal: NilaiAwalForm = d
        ? {
            no: d.no,
            tanggal: dariDate(d.tanggal),
            caraBayar: d.caraBayar,
            jatuhTempo: dariDate(d.jatuhTempo),
            supplierKode: d.supplierKode ?? "",
            keterangan: d.keterangan,
            baris: d.detail.map((x) => ({
              barangKode: x.peralatanKode ?? x.perlengkapanKode ?? "",
              qty: String(x.qty),
              harga: String(x.harga),
              residu: String(x.residu ?? 0),
              garansiBulan: String(x.garansiBulan ?? ""),
              masaManfaatBulan: String(x.masaManfaatBulan ?? ""),
              dasarN: x.dasarN ?? "GARANSI",
            })),
          }
        : formKosong(hariIni());
      form = <FormPembelian key={cari.form} jenis={jenis} awal={awal} supplier={opsi.supplier} barang={opsi.barang} kategori={opsi.kategori} bolehTambahCepat={boleh(pengguna.peran, "master-konversi.tambah-cepat")} namaAkun={namaAkun} periodeTerkunci={terkunci} alamatKembali={alamat} />;
    }
  }

  // ----- Rincian -----
  let rincian: React.ReactNode = null;
  if (cari.lihat && !form) {
    const b = await ambilPembelian(cari.lihat);
    rincian = b && b.jenis === jenis ? <DetailPembelian b={b} namaAkun={namaAkun} peran={pengguna.peran} alamat={alamat} /> : <Peringatan jenis="galat">Pembelian {cari.lihat} tidak ditemukan.</Peringatan>;
  }

  const draf = daftar.filter((b) => b.status === "DRAFT");
  const diposting = daftar.filter((b) => b.status === "DISETUJUI");

  return (
    <>
      <KepalaHalaman
        judul={`Pembelian ${L}`}
        keterangan={
          peralatan
            ? "Draf bisa diubah atau dihapus. Saat diposting, sistem membuat jurnal umum, kartu aset per unit, dan jadwal penyusutan. Pembelian yang sudah diposting hanya bisa dibalik oleh Owner."
            : "Saat diposting, saldo perlengkapan bertambah dan jurnal umum dibuat. Pemakaian dihitung lewat input nilai sisa di akhir periode."
        }
        aksi={bolehDraf && !form ? <TautanTombol href={`${alamat}?form=baru`} varian="utama" ikon={<Plus className="size-4" />}>Pembelian baru</TautanTombol> : null}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KartuRingkasan judul="Diposting" nilai={diposting.reduce((s, b) => s + b.total, 0)} keterangan={`${diposting.length} pembelian`} nada="hijau" />
        <KartuRingkasan judul="Masih draf" nilai={String(draf.length)} bukanUang keterangan={draf.length ? "Perlu diposting supaya masuk jurnal" : "Tidak ada draf"} nada={draf.length ? "kuning" : "netral"} />
        <KartuRingkasan judul="Utang dari pembelian kredit" nilai={diposting.filter((b) => b.caraBayar === "KREDIT").reduce((s, b) => s + b.total, 0)} keterangan="Total nilai pembelian kredit" />
      </div>

      {pengguna.peran === "OWNER" && !form && <Peringatan>Sebagai Owner kamu bisa memposting draf dan membalik pembelian yang sudah diposting. Draf dibuat oleh Admin.</Peringatan>}
      {form}
      {rincian}

      <Kartu rapat>
        <KepalaKartu judul={`Daftar pembelian ${L.toLowerCase()}`} keterangan={`${daftar.length} dokumen`} />
        {daftar.length === 0 ? (
          <KeadaanKosong
            judul={`Belum ada pembelian ${L.toLowerCase()}`}
            keterangan={bolehDraf ? 'Tekan "Pembelian baru" untuk mencatat yang pertama.' : "Pembelian dicatat oleh Admin."}
          />
        ) : (
          <Tabel label={`Daftar pembelian ${L.toLowerCase()}`}>
            <thead>
              <tr>
                <th>No.</th>
                <th>Tanggal</th>
                <th>Supplier</th>
                <th>Barang</th>
                <th>Bayar</th>
                <th className="kolom-angka">Total (Rp)</th>
                <th>Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {belumDiAtas(daftar, (b) => belumDiputuskan(b.status)).map((b) => (
                <tr key={b.no} className={cari.lihat === b.no ? "bg-aksen-lembut/50" : ""}>
                  <td className="kode">{b.no}</td>
                  <td className="whitespace-nowrap">{labelTanggal(b.tanggal)}</td>
                  <td>{b.supplier}</td>
                  <td className="text-[12px] leading-5">{b.barang.map((x, i) => <div key={i}>{x}</div>)}</td>
                  <td className="whitespace-nowrap">
                    {LABEL_CARA_BAYAR[b.caraBayar]}
                    {b.caraBayar === "KREDIT" && b.jatuhTempo && <div className="text-[11px] text-slate-500">jatuh tempo {labelTanggal(b.jatuhTempo)}</div>}
                  </td>
                  <td className="kolom-angka"><Rupiah nilai={b.total} polos /></td>
                  <td>
                    <LencanaStatus jenis="pembelian" status={b.status} />
                    {b.jurnalNo && <div className="kode mt-0.5 text-[11px]!">{b.jurnalNo}</div>}
                  </td>
                  <td>
                    <AksiPembelian no={b.no} status={b.status} total={b.total} peralatan={peralatan} peran={pengguna.peran} alamat={alamat} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>
    </>
  );
}
