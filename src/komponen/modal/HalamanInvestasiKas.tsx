/*
 * Halaman Investasi Kas (komponen server). Keadaan di URL: ?form=baru membuka form catat setoran,
 * ?periode=2026-10 atau ?periode=semua (bawaan) memilih rentang ringkasan "Dari mana kas dan modal".
 * Hanya Admin dan Owner yang membuka halaman ini (IZIN["investasi-kas.lihat"]).
 */
import { Plus } from "lucide-react";
import { wajibPeranHalaman } from "@/lib/server/auth";
import { boleh, IZIN } from "@/lib/peran";
import { petaAkun } from "@/lib/data/umum";
import { semuaPeriode } from "@/lib/data/pelaporan/periode";
import { daftarSetoran, ringkasanKasModal } from "@/lib/data/modal/investasi-kas";
import { hariIni, labelPeriode, labelTanggal, periodeDariCari, periodeIni } from "@/lib/inti/tanggal";
import PilihBulanTahun from "@/komponen/ui/PilihBulanTahun";
import { rupiah } from "@/lib/format";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import { LencanaStatus } from "@/komponen/ui/Lencana";
import { TautanTombol } from "@/komponen/ui/Tombol";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import { DaftarHP, KartuHP, RincianHP, TabelLebar } from "@/komponen/fee-event/Ringkas";
import FormInvestasiKas from "./FormInvestasiKas";
import AksiInvestasiKas from "./AksiInvestasiKas";
import RingkasanKasModal from "./RingkasanKasModal";

const ALAMAT = "/modal/investasi-kas";

export default async function HalamanInvestasiKas({ cari }: { cari: { form?: string; periode?: string; bulan?: string; tahun?: string } }) {
  const pengguna = await wajibPeranHalaman(IZIN["investasi-kas.lihat"]);
  const semua = await semuaPeriode();
  const dipilih = periodeDariCari(cari);
  const periode = dipilih && dipilih !== "semua" ? dipilih : null;
  const [setoran, namaAkun, { ringkasan, bukuBesar }] = await Promise.all([daftarSetoran(), petaAkun(), ringkasanKasModal(periode)]);
  const bolehCatat = boleh(pengguna.peran, "investasi-kas.catat");
  const owner = boleh(pengguna.peran, "investasi-kas.putuskan");
  const tampilForm = cari.form === "baru" && bolehCatat;
  const menunggu = setoran.filter((s) => s.status === "DIAJUKAN");
  const disetujui = setoran.filter((s) => s.status === "DISETUJUI");
  const totalDisetujui = disetujui.reduce((s, x) => s + x.jumlah, 0);
  // Buku besar untuk pembanding: periode terpilih, atau periode terakhir yang dikenal untuk kumulatif.
  const periodeBuku = periode ?? semua.at(-1) ?? periodeIni();

  const status = (s: (typeof setoran)[number]) => (
    <>
      <LencanaStatus jenis="persetujuan" status={s.status} />
      {s.jurnalNo && <div className="kode mt-0.5 text-[11px]!">{s.jurnalNo}</div>}
      {s.alasanTolak && <div className="mt-0.5 max-w-56 text-[11px] break-words text-rose-600">Ditolak: {s.alasanTolak}</div>}
    </>
  );

  return (
    <>
      <KepalaHalaman
        judul="Investasi Kas"
        keterangan="Setoran modal pemilik berupa uang ke kas. Admin atau Owner mencatat setoran, Owner menyetujui, lalu jurnal Debit Kas, Kredit Modal Pemilik dibuat otomatis."
        aksi={bolehCatat && !tampilForm ? <TautanTombol href={`${ALAMAT}?form=baru`} varian="utama" ikon={<Plus className="size-4" />}>Catat setoran</TautanTombol> : null}
      />

      <Peringatan>
        Aplikasi ini hanya mencakup siklus konversi (peralatan dan perlengkapan) dan siklus SDM (gaji inhouse dan fee event), tanpa siklus pendapatan.
        Jadi kas untuk pembelian tunai, gaji, dan fee berasal dari setoran modal pemilik yang dicatat di sini. Barang yang disetor pemilik dicatat lewat pembelian dengan cara bayar Investasi.
      </Peringatan>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KartuRingkasan judul="Menunggu keputusan Owner" nilai={String(menunggu.length)} bukanUang nada={menunggu.length ? "kuning" : "netral"} keterangan={menunggu.length ? `Total ${rupiah(menunggu.reduce((s, x) => s + x.jumlah, 0))}` : "Tidak ada setoran yang menunggu"} />
        <KartuRingkasan judul="Setoran kas disetujui" nilai={totalDisetujui} nada="hijau" keterangan={`${disetujui.length} setoran, sudah dijurnal`} />
        <KartuRingkasan judul={periode ? `Saldo kas akhir ${labelPeriode(periode)}` : "Saldo kas sekarang"} nilai={bukuBesar.kas} keterangan="Menurut buku besar" />
      </div>

      {tampilForm && <FormInvestasiKas tanggalAwal={hariIni()} namaAkun={namaAkun} alamatKembali={ALAMAT} owner={owner} />}

      <Kartu rapat>
        <KepalaKartu judul="Daftar setoran" keterangan={`${setoran.length} dokumen`} />
        {setoran.length === 0 ? (
          <KeadaanKosong judul="Belum ada setoran modal" keterangan={bolehCatat ? 'Tekan "Catat setoran" untuk mencatat yang pertama.' : undefined} />
        ) : (
          <>
            <DaftarHP label="Daftar setoran">
              {setoran.map((s) => (
                <KartuHP key={s.no} judul={<span className="kode text-[13px]! text-slate-900!">{s.no}</span>} sub={labelTanggal(s.tanggal)} kanan={<Rupiah nilai={s.jumlah} className="font-semibold" />}>
                  <p className="text-[13px] break-words text-slate-700">{s.keterangan}</p>
                  <RincianHP isi={[["Status", status(s)], ["Dicatat", s.dibuatOleh], ...(s.diputuskanOleh ? [["Diputuskan", s.diputuskanOleh] as [string, string]] : [])]} />
                  <AksiInvestasiKas no={s.no} status={s.status} jumlah={s.jumlah} tanggal={s.tanggal} peran={pengguna.peran} />
                </KartuHP>
              ))}
            </DaftarHP>
            <TabelLebar>
              <Tabel label="Daftar setoran">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Tanggal</th>
                    <th>Keterangan atau sumber dana</th>
                    <th className="kolom-angka">Jumlah (Rp)</th>
                    <th>Status dan jurnal</th>
                    <th>Dicatat / diputuskan</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {setoran.map((s) => (
                    <tr key={s.no}>
                      <td className="kode">{s.no}</td>
                      <td className="whitespace-nowrap">{labelTanggal(s.tanggal)}</td>
                      <td className="max-w-72 break-words">{s.keterangan}</td>
                      <td className="kolom-angka"><Rupiah nilai={s.jumlah} polos /></td>
                      <td>{status(s)}</td>
                      <td className="text-[12px] text-slate-600">{s.dibuatOleh}{s.diputuskanOleh ? <div>{s.diputuskanOleh}</div> : null}</td>
                      <td><AksiInvestasiKas no={s.no} status={s.status} jumlah={s.jumlah} tanggal={s.tanggal} peran={pengguna.peran} /></td>
                    </tr>
                  ))}
                </tbody>
              </Tabel>
            </TabelLebar>
          </>
        )}
      </Kartu>

      <Kartu rapat>
        <KepalaKartu
          judul="Dari mana kas dan modal"
          keterangan="Dihitung dari jurnal yang sudah disetujui, sama dengan Buku Besar akun Kas dan Modal Pemilik."
          aksi={<PilihBulanTahun periode={periode ?? "semua"} tersedia={semua} semua="Kumulatif" idAwalan="rentang" />}
        />
        <RingkasanKasModal r={ringkasan} bb={bukuBesar} periodeBuku={periodeBuku} />
      </Kartu>
    </>
  );
}
