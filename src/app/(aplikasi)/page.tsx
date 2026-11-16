import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, Hourglass, IdCard, Users } from "lucide-react";
import { wajibMasuk } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { saldoAkun } from "@/lib/server/jurnal";
import { AKUN } from "@/lib/inti/akun";
import { labelPeriode, labelTanggal, dariDate, periodeIni } from "@/lib/inti/tanggal";
import { LABEL_JENIS_JURNAL } from "@/lib/format";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel, { BarisKosong } from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import { LencanaStatus } from "@/komponen/ui/Lencana";

export const metadata: Metadata = { title: "Dashboard" };

/*
 * Dashboard dasar dari fondasi. Agen pelaporan melengkapinya (daftar "Perlu tindakan", garansi hampir habis,
 * penyusutan bulan berjalan) mengikuti versi-statis/assets/js/views/dashboard.js.
 */
export default async function Dashboard() {
  const pengguna = await wajibMasuk();
  const P = periodeIni();
  const [kas, aset, akm, menunggu, karyawan, terbaru] = await Promise.all([
    saldoAkun(db, AKUN.KAS),
    db.aset.aggregate({ where: { status: "AKTIF" }, _sum: { nilaiPerolehan: true }, _count: true }),
    db.jadwalPenyusutan.aggregate({ where: { aset: { status: "AKTIF" }, jurnal: { status: "DISETUJUI" } }, _sum: { beban: true } }),
    Promise.all([
      db.jurnal.count({ where: { status: "DIAJUKAN" } }),
      db.pelepasan.count({ where: { status: "DIAJUKAN" } }),
      db.penggajian.count({ where: { status: "DIAJUKAN" } }),
    ]).then((x) => x.reduce((s, n) => s + n, 0)),
    db.karyawan.count({ where: { aktif: true } }),
    db.jurnal.findMany({ orderBy: { dibuatPada: "desc" }, take: 6, include: { detail: { select: { debit: true } } } }),
  ]);
  const nilaiBuku = (aset._sum.nilaiPerolehan ?? 0) - (akm._sum.beban ?? 0);

  return (
    <>
      <KepalaHalaman judul="Dashboard" keterangan={`Selamat datang, ${pengguna.nama}. Periode berjalan ${labelPeriode(P)}.`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuRingkasan judul="Saldo kas" nilai={kas} ikon={<Banknote className="size-4" />} keterangan="Menurut buku besar" nada="hijau" />
        <KartuRingkasan judul="Nilai buku peralatan" nilai={nilaiBuku} ikon={<IdCard className="size-4" />} keterangan={`${aset._count} unit aktif`} />
        <KartuRingkasan judul="Menunggu persetujuan" nilai={String(menunggu)} ikon={<Hourglass className="size-4" />} keterangan="Jurnal, pelepasan, penggajian" nada={menunggu ? "kuning" : "netral"} />
        <KartuRingkasan judul="Karyawan aktif" nilai={String(karyawan)} ikon={<Users className="size-4" />} keterangan="Dari master SDM" />
      </div>
      <Kartu rapat>
        <KepalaKartu judul="Jurnal terbaru" aksi={<Link href="/pelaporan/jurnal-umum" className="text-[13px] font-semibold text-aksen hover:underline">Lihat jurnal umum</Link>} />
        <Tabel label="Jurnal terbaru">
          <thead>
            <tr>
              <th>No.</th>
              <th>Tanggal</th>
              <th>Keterangan</th>
              <th>Jenis</th>
              <th className="kolom-angka">Jumlah (Rp)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {terbaru.length === 0 && <BarisKosong kolom={6}>Belum ada jurnal.</BarisKosong>}
            {terbaru.map((j) => (
              <tr key={j.no}>
                <td className="kode">{j.no}</td>
                <td>{labelTanggal(dariDate(j.tanggal))}</td>
                <td className="max-w-md truncate">{j.keterangan}</td>
                <td>{LABEL_JENIS_JURNAL[j.jenis]}</td>
                <td className="kolom-angka"><Rupiah nilai={j.detail.reduce((s, d) => s + d.debit, 0)} polos /></td>
                <td><LencanaStatus jenis="persetujuan" status={j.status} /></td>
              </tr>
            ))}
          </tbody>
        </Tabel>
      </Kartu>
    </>
  );
}
