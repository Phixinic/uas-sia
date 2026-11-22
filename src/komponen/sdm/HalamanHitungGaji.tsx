/*
 * Halaman Hitung Gaji (komponen server). Keadaan di URL: ?periode=2026-10&slip=<no slip>|semua.
 * Gaji dihitung dari Setting Gaji dan rekap presensi (rumus di src/lib/inti/penggajian.ts), disimpan sebagai slip DRAFT,
 * lalu diajukan lewat Distribusi Gaji.
 */
import { wajibMasuk } from "@/lib/server/auth";
import { boleh } from "@/lib/peran";
import { periodeTerkunciSemua, profilUsaha } from "@/lib/data/umum";
import { kunciPenutup, labelPeriode } from "@/lib/inti/tanggal";
import { opsiPeriodeSdm, periodeDipilih } from "@/lib/data/sdm/umum";
import { ambilSlip, barisHitungGaji, daftarSlipPeriode } from "@/lib/data/sdm/gaji";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Peringatan from "@/komponen/ui/Peringatan";
import KeadaanKosong from "@/komponen/ui/KeadaanKosong";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import { TautanTombol } from "@/komponen/ui/Tombol";
import { Printer } from "lucide-react";
import PilihPeriode from "./PilihPeriode";
import TabelGaji from "./TabelGaji";
import SlipGaji from "./SlipGaji";
import { TombolHitungSemua } from "./AksiGaji";
import { labelPtkp } from "@/lib/format";

const ALAMAT = "/sdm/hitung-gaji";

export type CariGaji = { periode?: string; slip?: string };

export default async function HalamanHitungGaji({ cari }: { cari: CariGaji }) {
  const pengguna = await wajibMasuk();
  const periode = periodeDipilih(cari.periode);
  const bolehHitung = boleh(pengguna.peran, "gaji.hitung");

  const [opsiPeriode, baris, tersimpan, terkunci, profil] = await Promise.all([
    opsiPeriodeSdm(periode),
    barisHitungGaji(periode),
    daftarSlipPeriode(periode),
    periodeTerkunciSemua(),
    profilUsaha(),
  ]);

  const alamatPeriode = `${ALAMAT}?periode=${periode}`;
  const slipDibuka = cari.slip === "semua" ? tersimpan : cari.slip ? [await ambilSlip(cari.slip)].filter((s) => s !== null) : [];
  // Tertutup bila periode ini atau periode sesudahnya sudah dikunci (kunci berurutan).
  const penutup = kunciPenutup(periode, terkunci);
  const periodeKunci = penutup !== null;
  const bisaDihitung = baris.filter((b) => b.jumlahPresensi > 0 && (!b.slipStatus || b.slipStatus === "DRAFT")).length;
  const jumlahSimpan = baris.filter((b) => b.slipNo).length;
  const jumlah = (f: (b: (typeof baris)[number]) => number) => baris.reduce((s, b) => s + f(b), 0);

  return (
    <>
      {cari.slip && (
        slipDibuka.length ? <SlipGaji daftar={slipDibuka} namaUsaha={profil.nama} alamatTutup={alamatPeriode} /> : <Peringatan jenis="galat">Slip {cari.slip} tidak ditemukan.</Peringatan>
      )}

      <div className={`space-y-5 ${cari.slip && slipDibuka.length ? "tanpa-cetak" : ""}`}>
        <KepalaHalaman
          judul="Hitung Gaji"
          keterangan="Gaji bulanan karyawan inhouse, dihitung dari Setting Gaji dan rekap presensi. Crew event dibayar lewat menu Fee event. Potongan absen = gaji pokok dibagi hari kerja, dikali jumlah alpa. Hasilnya disimpan sebagai slip draf, lalu diajukan lewat Distribusi Gaji."
          aksi={
            <>
              <PilihPeriode terpilih={periode} opsi={opsiPeriode} />
              {tersimpan.length > 0 && (
                <TautanTombol href={`${alamatPeriode}&slip=semua`} ikon={<Printer className="size-4" />}>
                  Lihat dan cetak semua slip
                </TautanTombol>
              )}
              {bolehHitung && !periodeKunci && <TombolHitungSemua periode={periode} jumlah={bisaDihitung} />}
            </>
          }
        />

        {penutup && (
          <Peringatan jenis="awas">
            {penutup === periode ? `Periode ${labelPeriode(periode)} terkunci` : `Periode ${labelPeriode(periode)} tertutup karena ${labelPeriode(penutup)} sudah dikunci`}. Slip tidak bisa dihitung atau diajukan sampai Owner membuka kuncinya.
          </Peringatan>
        )}
        {!bolehHitung && <Peringatan>Hitung gaji dijalankan oleh HRD. Kamu bisa melihat hasil dan slipnya.</Peringatan>}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KartuRingkasan judul="Karyawan" nilai={String(baris.length)} bukanUang keterangan={`${jumlahSimpan} slip tersimpan`} />
          <KartuRingkasan judul="Bruto" nilai={jumlah((b) => b.tampil.bruto)} />
          <KartuRingkasan judul="PPh 21" nilai={jumlah((b) => b.tampil.pph21)} nada="kuning" keterangan="Menjadi utang PPh 21" />
          <KartuRingkasan judul="Take home pay" nilai={jumlah((b) => b.tampil.thp)} nada="hijau" keterangan="Kas keluar saat dibayar" />
        </div>

        <Kartu rapat>
          <KepalaKartu judul={`Proses hitung gaji ${labelPeriode(periode)}`} keterangan="Tekan Rincian untuk melihat komponen gaji dan PPh 21 tiap karyawan" />
          {baris.length === 0 ? (
            <KeadaanKosong judul="Belum ada Setting Gaji" keterangan="Tambahkan setting gaji karyawan di Master SDM." />
          ) : (
            <TabelGaji baris={baris} periode={periode} bolehHitung={bolehHitung && !periodeKunci} alamat={ALAMAT} />
          )}
        </Kartu>

        <Kartu rapat>
          <KepalaKartu judul={`PPh 21 ${labelPeriode(periode)}`} keterangan="Metode disetahunkan: (bruto x 12 - biaya jabatan - PTKP) x tarif progresif / 12. Simulasi untuk tugas, belum memakai tarif efektif (TER)." />
          {tersimpan.length === 0 ? (
            <KeadaanKosong judul="Belum ada slip pada periode ini" keterangan="Jalankan hitung gaji dulu." />
          ) : (
            <Tabel label="Rincian PPh 21 per slip">
              <thead>
                <tr>
                  <th className="max-md:hidden">Slip</th>
                  <th>Karyawan</th>
                  <th>PTKP</th>
                  <th className="kolom-angka">Bruto/bln</th>
                  <th className="kolom-angka max-md:hidden">Bruto setahun</th>
                  <th className="kolom-angka max-md:hidden">Biaya jabatan</th>
                  <th className="kolom-angka max-md:hidden">PTKP (Rp)</th>
                  <th className="kolom-angka max-md:hidden">PKP</th>
                  <th className="kolom-angka">PPh 21/bln</th>
                </tr>
              </thead>
              <tbody>
                {tersimpan.map((s) => (
                  <tr key={s.no}>
                    <td className="kode max-md:hidden">{s.no}</td>
                    <td>{s.karyawan}</td>
                    <td>{labelPtkp(s.statusPtkp)}</td>
                    <td className="kolom-angka"><Rupiah nilai={s.bruto} polos /></td>
                    <td className="kolom-angka max-md:hidden"><Rupiah nilai={s.brutoSetahun} polos /></td>
                    <td className="kolom-angka max-md:hidden"><Rupiah nilai={s.biayaJabatan} polos /></td>
                    <td className="kolom-angka max-md:hidden"><Rupiah nilai={s.ptkp} polos /></td>
                    <td className="kolom-angka max-md:hidden"><Rupiah nilai={s.pkp} polos /></td>
                    <td className="kolom-angka font-semibold"><Rupiah nilai={s.pph21} polos /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="md:hidden">Total PPh 21</td>
                  <td colSpan={8} className="max-md:hidden">Total PPh 21</td>
                  <td className="kolom-angka"><Rupiah nilai={tersimpan.reduce((x, s) => x + s.pph21, 0)} polos /></td>
                </tr>
              </tfoot>
            </Tabel>
          )}
        </Kartu>
      </div>
    </>
  );
}
