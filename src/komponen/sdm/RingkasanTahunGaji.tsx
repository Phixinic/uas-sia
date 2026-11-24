/*
 * Ringkasan penggajian per tahun (komponen server) di Gaji Bulanan: tiap bulan statusnya belum ada presensi, belum
 * diajukan, dikembalikan Owner, menunggu Owner, atau dibayar, beserta total THP. Bulan yang dipilih ditandai.
 */
import Link from "next/link";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import { DaftarHP, KartuHP, TabelLebar } from "@/komponen/fee-event/Ringkas";
import { denganPeriode, namaBulan, tahunDari } from "@/lib/inti/tanggal";
import { ringkasanTahunGaji, type RingkasBulanGaji } from "@/lib/data/sdm/gaji";
import { alamatPresensi, TandaStatus } from "./StatusGaji";

const STATUS: Record<RingkasBulanGaji["status"], ["abu" | "kuning" | "biru" | "hijau" | "merah", string]> = {
  KOSONG: ["kuning", "Belum ada presensi"],
  PRESENSI: ["abu", "Belum diajukan"],
  DRAF: ["merah", "Dikembalikan Owner"],
  DIAJUKAN: ["biru", "Menunggu Owner"],
  DIBAYAR: ["hijau", "Dibayar"],
};

/** Status satu bulan; bulan tanpa presensi menautkan ke Presensi bulan itu. */
function StatusBulan({ r }: { r: RingkasBulanGaji }) {
  const [warna, teks] = STATUS[r.status];
  return <TandaStatus warna={warna} href={r.status === "KOSONG" ? alamatPresensi(r.periode) : undefined}>{teks}</TandaStatus>;
}

function rincian(r: RingkasBulanGaji) {
  const bagian = [r.dibayar && `${r.dibayar} slip dibayar`, r.diajukan && `${r.diajukan} slip diajukan`, r.draf && `${r.draf} slip dikembalikan`].filter(Boolean);
  return bagian.length ? bagian.join(", ") : r.presensi ? `${r.presensi} catatan presensi` : "-";
}

export default async function RingkasanTahunGaji({ periode, alamat }: { periode: string; alamat: string }) {
  const tahun = tahunDari(periode);
  const daftar = await ringkasanTahunGaji(tahun);
  const total = daftar.reduce((s, r) => s + r.thp, 0);
  const dibayar = daftar.filter((r) => r.status === "DIBAYAR").length;
  return (
    <Kartu rapat>
      <KepalaKartu judul={`Ringkasan penggajian · Tahun: ${tahun}`} keterangan={`${dibayar} bulan sudah dibayar penuh. Pilih bulan untuk membuka slipnya.`} />
      <DaftarHP label="Ringkasan penggajian per bulan">
        {daftar.map((r) => (
          <KartuHP
            key={r.periode}
            judul={<Link className="underline" href={denganPeriode(alamat, r.periode)} aria-current={r.periode === periode ? "page" : undefined}>{namaBulan(r.periode)}{r.periode === periode ? " (dipilih)" : ""}</Link>}
            sub={rincian(r)}
            kanan={<StatusBulan r={r} />}
          >
            {r.thp > 0 && <div className="text-xs text-slate-600">Total THP <span className="font-semibold text-slate-900"><Rupiah nilai={r.thp} /></span></div>}
          </KartuHP>
        ))}
      </DaftarHP>
      <TabelLebar>
        <Tabel label="Ringkasan penggajian per bulan">
          <thead>
            <tr>
              <th>Bulan</th>
              <th>Status</th>
              <th>Slip</th>
              <th className="kolom-angka">Total THP (Rp)</th>
            </tr>
          </thead>
          <tbody>
            {daftar.map((r) => (
              <tr key={r.periode} className={r.periode === periode ? "bg-aksen-lembut/60" : undefined}>
                <td>
                  <Link className="font-medium hover:underline" href={denganPeriode(alamat, r.periode)} aria-current={r.periode === periode ? "page" : undefined}>{namaBulan(r.periode)}</Link>
                </td>
                <td><StatusBulan r={r} /></td>
                <td className="text-[13px] text-slate-600">{rincian(r)}</td>
                <td className="kolom-angka">{r.thp ? <Rupiah nilai={r.thp} polos /> : "-"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total THP tahun {tahun}</td>
              <td className="kolom-angka"><Rupiah nilai={total} polos /></td>
            </tr>
          </tfoot>
        </Tabel>
      </TabelLebar>
    </Kartu>
  );
}
