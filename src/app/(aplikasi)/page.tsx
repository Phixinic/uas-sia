import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Banknote, BookOpen, CalendarClock, CalendarRange, ClipboardCheck, Coins, FileText, HandCoins, Hourglass, IdCard, Lock, Package, ReceiptText, Scale, TrendingDown, UserCog, Users, Wrench,
} from "lucide-react";
import { wajibMasuk } from "@/lib/server/auth";
import { dataDashboard } from "@/lib/data/pelaporan/dashboard";
import { semuaPeriode } from "@/lib/data/pelaporan/periode";
import { labelPeriode, labelTanggal, periodeIni } from "@/lib/inti/tanggal";
import { LABEL_JENIS_JURNAL, rupiah } from "@/lib/format";
import { LABEL_PERAN, type Peran } from "@/lib/peran";
import KepalaHalaman from "@/komponen/ui/KepalaHalaman";
import KartuRingkasan from "@/komponen/ui/KartuRingkasan";
import Kartu, { KepalaKartu } from "@/komponen/ui/Kartu";
import Tabel, { BarisKosong } from "@/komponen/ui/Tabel";
import Rupiah from "@/komponen/ui/Rupiah";
import Lencana, { LencanaStatus } from "@/komponen/ui/Lencana";
import FilterUrl from "@/komponen/pelaporan/FilterUrl";
import DashboardKapten from "@/komponen/fee-event/DashboardKapten";

export const metadata: Metadata = { title: "Dashboard" };

/** `berperiode`: halaman tujuan membaca ?periode, jadi tautannya membawa periode yang sedang dipilih di dashboard. */
type Tautan = { href: string; label: string; ikon: React.ReactNode; berperiode?: boolean };

const TAUTAN: Record<Exclude<Peran, "KAPTEN">, Tautan[]> = {
  ADMIN: [
    { href: "/konversi/pembelian-peralatan", label: "Pembelian peralatan", ikon: <Wrench className="size-4" /> },
    { href: "/konversi/pembelian-perlengkapan", label: "Pembelian perlengkapan", ikon: <Package className="size-4" /> },
    { href: "/konversi/penyusutan", label: "Proses penyusutan", ikon: <TrendingDown className="size-4" />, berperiode: true },
    { href: "/pelaporan/jurnal-penyesuaian", label: "Jurnal penyesuaian", ikon: <FileText className="size-4" /> },
  ],
  HRD: [
    { href: "/sdm/presensi", label: "Presensi", ikon: <CalendarClock className="size-4" />, berperiode: true },
    { href: "/sdm/hitung-gaji", label: "Hitung gaji", ikon: <Coins className="size-4" />, berperiode: true },
    { href: "/sdm/distribusi", label: "Distribusi gaji", ikon: <ReceiptText className="size-4" />, berperiode: true },
    { href: "/fee-event/event", label: "Event & kehadiran crew", ikon: <CalendarRange className="size-4" /> },
    { href: "/master/sdm", label: "Master SDM", ikon: <Users className="size-4" /> },
  ],
  OWNER: [
    { href: "/pelaporan/jurnal-penyesuaian?status=DIAJUKAN", label: "Setujui jurnal", ikon: <BadgeCheck className="size-4" /> },
    { href: "/sdm/distribusi", label: "Setujui penggajian", ikon: <ReceiptText className="size-4" />, berperiode: true },
    { href: "/fee-event/keputusan", label: "Putuskan fee event", ikon: <HandCoins className="size-4" /> },
    { href: "/pelaporan/tutup-periode", label: "Tutup periode", ikon: <Lock className="size-4" /> },
    { href: "/pengguna", label: "Kelola pengguna", ikon: <UserCog className="size-4" /> },
  ],
};

const TAUTAN_LAPORAN: Tautan[] = [
  { href: "/pelaporan/jurnal-umum", label: "Jurnal umum", ikon: <BookOpen className="size-4" />, berperiode: true },
  { href: "/pelaporan/buku-besar", label: "Buku besar", ikon: <ClipboardCheck className="size-4" />, berperiode: true },
  { href: "/pelaporan/neraca-saldo", label: "Neraca saldo", ikon: <Scale className="size-4" />, berperiode: true },
];

const denganPeriode = (href: string, periode: string) => `${href}${href.includes("?") ? "&" : "?"}periode=${periode}`;

/** Keterangan kartu penyusutan: angka disetujui berasal dari jurnal penyusutan yang disetujui. */
function ketPenyusutan(s: { jadwal: number; disetujui: number; unit: number }) {
  const sisa = Math.max(s.jadwal - s.disetujui, 0);
  if (!s.unit && !s.disetujui) return "Tidak ada jadwal di periode ini";
  if (s.disetujui && !sisa) return "Dari jurnal penyusutan yang disetujui";
  if (s.disetujui) return `Dari jurnal yang disetujui; ${rupiah(sisa)} lagi belum disetujui`;
  return `Jadwal ${s.unit} unit, belum dijurnal atau belum disetujui`;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const pengguna = await wajibMasuk({ kapten: true });
  // Kapten (crew freelance) tidak melihat angka keuangan; dashboard-nya hanya berisi pekerjaan penilaian.
  if (pengguna.peran === "KAPTEN") return <DashboardKapten pengguna={pengguna} />;
  const peran = pengguna.peran;
  const cari = await searchParams;
  const semua = await semuaPeriode();
  const periode = cari.periode && semua.includes(cari.periode) ? cari.periode : periodeIni();
  const d = await dataDashboard(periode);
  // Pekerjaan untuk peran yang sedang masuk ditaruh paling atas.
  const tindakan = [...d.tindakan].sort((a, b) => Number(b.peran.includes(pengguna.peran)) - Number(a.peran.includes(pengguna.peran)));

  return (
    <>
      <KepalaHalaman
        judul="Dashboard"
        keterangan={`Selamat datang, ${pengguna.nama} (${LABEL_PERAN[pengguna.peran]}). Angka mengikuti periode yang dipilih.`}
        lencana={<LencanaStatus jenis="periode" status={d.statusPeriode} />}
        aksi={<FilterUrl nama="periode" label="Periode" nilai={periode} opsi={[...semua].reverse().map((p) => ({ nilai: p, label: labelPeriode(p) + (p === periodeIni() ? " (berjalan)" : "") }))} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KartuRingkasan judul="Saldo kas" nilai={d.kas} ikon={<Banknote className="size-4" />} keterangan={`Menurut buku besar sampai ${labelPeriode(periode)}`} nada="hijau" />
        <KartuRingkasan judul="Total aset bersih" nilai={d.totalAset} ikon={<IdCard className="size-4" />} keterangan="Aset dikurangi akumulasi penyusutan" />
        <KartuRingkasan
          judul={`Beban penyusutan ${labelPeriode(periode)}`}
          nilai={d.susut.disetujui || d.susut.jadwal}
          ikon={<TrendingDown className="size-4" />}
          keterangan={ketPenyusutan(d.susut)}
        />
        <KartuRingkasan
          judul={`Beban gaji dan fee ${labelPeriode(periode)}`}
          nilai={d.bebanGaji + d.bebanFee}
          ikon={<Coins className="size-4" />}
          keterangan={d.bebanGaji || d.bebanFee ? `Gaji inhouse ${rupiah(d.bebanGaji)}, fee event ${rupiah(d.bebanFee)}` : "Belum ada penggajian atau fee disetujui"}
        />
        <KartuRingkasan
          judul="Menunggu persetujuan"
          nilai={String(d.menunggu.total)}
          bukanUang
          ikon={<Hourglass className="size-4" />}
          keterangan={`Jurnal ${d.menunggu.jurnal}, pelepasan ${d.menunggu.pelepasan}, penggajian ${d.menunggu.penggajian}, fee ${d.menunggu.fee}, setoran ${d.menunggu.setoran}`}
          nada={d.menunggu.total ? "kuning" : "netral"}
        />
        <KartuRingkasan judul="Periode aktif" nilai={labelPeriode(periode)} bukanUang ikon={<CalendarClock className="size-4" />} keterangan={d.statusPeriode === "TERKUNCI" ? "Terkunci, menolak jurnal baru" : "Terbuka untuk transaksi"} nada={d.statusPeriode === "TERKUNCI" ? "merah" : "netral"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Kartu rapat className="lg:col-span-2">
          <KepalaKartu judul="Perlu tindakan" keterangan={tindakan.length ? `${tindakan.length} pekerjaan tertunda` : undefined} />
          {tindakan.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Tidak ada pekerjaan yang tertunda.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tindakan.map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                      {t.judul}
                      {t.peran.includes(pengguna.peran) && <Lencana warna="teal">untuk kamu</Lencana>}
                    </div>
                    <div className="text-xs text-slate-500">{t.uraian}</div>
                  </div>
                  <Link href={t.href} className="tombol tombol-garis tombol-kecil shrink-0">
                    Buka <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Kartu>

        <Kartu>
          <h2 className="judul-kartu">Tautan cepat</h2>
          <p className="mt-0.5 text-xs text-slate-500">Menu yang sering dipakai {LABEL_PERAN[pengguna.peran]}.</p>
          <div className="mt-3 grid gap-2">
            {[...TAUTAN[peran], ...TAUTAN_LAPORAN].map((t) => (
              <Link key={t.href} href={t.berperiode ? denganPeriode(t.href, periode) : t.href} className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:border-aksen hover:bg-aksen-lembut hover:text-aksen-gelap">
                <span className="text-slate-500">{t.ikon}</span>
                {t.label}
              </Link>
            ))}
          </div>
        </Kartu>
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
            {d.terbaru.length === 0 && <BarisKosong kolom={6}>Belum ada jurnal.</BarisKosong>}
            {d.terbaru.map((j) => (
              <tr key={j.no}>
                <td className="kode">{j.no}</td>
                <td className="whitespace-nowrap">{labelTanggal(j.tanggal)}</td>
                <td className="max-w-md truncate">{j.keterangan}</td>
                <td>{LABEL_JENIS_JURNAL[j.jenis]}</td>
                <td className="kolom-angka"><Rupiah nilai={j.jumlah} polos /></td>
                <td><LencanaStatus jenis="persetujuan" status={j.status} /></td>
              </tr>
            ))}
          </tbody>
        </Tabel>
      </Kartu>
    </>
  );
}
