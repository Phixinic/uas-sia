/*
 * Kueri halaman Setting Gaji (Master SDM): versi berlaku per karyawan, pengajuan yang menunggu Owner, riwayat semua versi,
 * dan bahan pengaman untuk form pengajuan. Hasil berupa objek biasa untuk komponen klien.
 */
import { db } from "@/lib/server/db";
import { daftarPeriode, periodeIni, tambahBulan } from "@/lib/inti/tanggal";
import { muatPetaNominal } from "@/lib/server/nominal";
import type { PetaNominal } from "@/lib/inti/nominal";
import { pengamanBerlaku, pilihVersiBerlaku, versiDigantikan, type HasilPengaman, type JenisPerubahan, type SlipRingkas, type StatusVersi, type VersiRingkas } from "@/lib/inti/setting-gaji";

/**
 * Isi satu versi untuk ditampilkan: nama master dan nominal yang berlaku di satu bulan (riwayat nominal). Riwayat dan
 * pengajuan memakai bulan berlaku versinya; versi yang berlaku sekarang memakai bulan berjalan.
 */
export type TampilVersi = {
  kode: string;
  karyawanKode: string;
  karyawan: string;
  jabatanKode: string;
  jabatan: string;
  golonganKode: string;
  golongan: string;
  gajiPokok: number;
  tunjJabatan: number;
  tunjKeluarga: number;
  tunjanganKodes: string[];
  tunjangan: { nama: string; nominal: number }[];
  /** Gaji pokok + tunjangan jabatan + tunjangan keluarga (bila PTKP K/*) + tunjangan lain, sebelum potongan absen. */
  estimasiBruto: number;
  berlakuMulai: string;
  jenisPerubahan: JenisPerubahan;
  alasan: string;
  status: StatusVersi;
  alasanTolak: string | null;
  diajukanOleh: string | null;
  diajukanPada: string;
  diputuskanOleh: string | null;
  diputuskanPada: string | null;
  /** Disetujui tetapi digantikan versi disetujui lain dengan bulan berlaku sama yang diputuskan belakangan. */
  digantikan: boolean;
};

export type PengajuanTampil = TampilVersi & {
  /** Versi yang berlaku di bulan berlaku pengajuan ini sebelum diputuskan (nilai lama). */
  lama: TampilVersi | null;
  pengaman: HasilPengaman;
};

export type BarisKaryawanGaji = {
  kode: string;
  nama: string;
  aktif: boolean;
  statusPtkp: string;
  /** Versi berlaku di periode berjalan. */
  aktifSekarang: TampilVersi | null;
  /** Versi disetujui berikutnya yang berlaku sesudah periode berjalan. */
  berikutnya: TampilVersi | null;
  menunggu: number;
};

/** Bahan form pengajuan per karyawan: semua versi dan slip, supaya pengaman bisa ditampilkan sebelum dikirim. */
export type BahanFormSetting = Record<string, { versi: VersiRingkas[]; slip: SlipRingkas[]; aktifSekarang: TampilVersi | null }>;

const sertai = {
  karyawan: true,
  jabatan: true,
  golongan: true,
  tunjangan: { include: { tunjangan: true }, orderBy: { tunjanganKode: "asc" } },
  diajukanOleh: { select: { nama: true } },
  diputuskanOleh: { select: { nama: true } },
} as const;

type VersiDb = Awaited<ReturnType<typeof db.settingGaji.findMany<{ include: typeof sertai }>>>[number];

function keTampil(v: VersiDb, digantikan: Set<string>, peta: PetaNominal, periode: string): TampilVersi {
  const vj = peta.pada("JABATAN", v.jabatanKode, periode);
  const gajiPokok = peta.pada("GOLONGAN", v.golonganKode, periode)?.nominal ?? 0;
  const tunjJabatan = vj?.tunjJabatan ?? 0;
  const tunjangan = v.tunjangan.map((t) => ({ nama: t.tunjangan.nama, nominal: peta.pada("TUNJANGAN", t.tunjanganKode, periode)?.nominal ?? 0 }));
  const tunjLain = tunjangan.reduce((s, t) => s + t.nominal, 0);
  const tunjKeluarga = v.karyawan.statusPtkp.startsWith("K") ? vj?.tunjKeluarga ?? 0 : 0;
  return {
    kode: v.kode,
    karyawanKode: v.karyawanKode,
    karyawan: v.karyawan.nama,
    jabatanKode: v.jabatanKode,
    jabatan: v.jabatan.nama,
    golonganKode: v.golonganKode,
    golongan: v.golongan.nama,
    gajiPokok,
    tunjJabatan,
    tunjKeluarga,
    tunjanganKodes: v.tunjangan.map((t) => t.tunjanganKode),
    tunjangan,
    estimasiBruto: gajiPokok + tunjJabatan + tunjKeluarga + tunjLain,
    berlakuMulai: v.berlakuMulai,
    jenisPerubahan: v.jenisPerubahan,
    alasan: v.alasan,
    status: v.status,
    alasanTolak: v.alasanTolak,
    diajukanOleh: v.diajukanOleh?.nama ?? null,
    diajukanPada: v.diajukanPada.toISOString(),
    diputuskanOleh: v.diputuskanOleh?.nama ?? null,
    diputuskanPada: v.diputuskanPada?.toISOString() ?? null,
    digantikan: digantikan.has(v.kode),
  };
}

export async function dataSettingGaji(sekarang = periodeIni()) {
  const [karyawan, versi, slip, barisPeriode, peta] = await Promise.all([
    db.karyawan.findMany({ where: { jenis: "INHOUSE" }, orderBy: { kode: "asc" }, select: { kode: true, nama: true, aktif: true, statusPtkp: true } }),
    db.settingGaji.findMany({ include: sertai, orderBy: [{ karyawanKode: "asc" }, { berlakuMulai: "desc" }, { diajukanPada: "desc" }] }),
    db.slipGaji.findMany({ select: { no: true, periodeId: true, status: true, karyawanKode: true } }),
    db.periode.findMany({ select: { id: true } }),
    muatPetaNominal(db),
  ]);
  // Pilihan "berlaku mulai": semua periode di tabel periode ditambah 12 bulan ke depan, dikelompokkan per tahun di form.
  const periodeBerlaku = [...new Set([...barisPeriode.map((p) => p.id), ...daftarPeriode(sekarang, tambahBulan(sekarang, 12))])].sort();

  const versiPer = new Map<string, VersiDb[]>();
  for (const v of versi) versiPer.set(v.karyawanKode, [...(versiPer.get(v.karyawanKode) ?? []), v]);
  const slipPer = new Map<string, SlipRingkas[]>();
  for (const s of slip) slipPer.set(s.karyawanKode, [...(slipPer.get(s.karyawanKode) ?? []), { no: s.no, periode: s.periodeId, status: s.status }]);
  // "Digantikan" dibandingkan per karyawan (bulan berlaku sama milik karyawan lain tidak saling menggantikan).
  const ganti = new Set([...versiPer.values()].flatMap((d) => [...versiDigantikan(d)]));
  const tampil = new Map(versi.map((v) => [v.kode, keTampil(v, ganti, peta, v.berlakuMulai)]));

  const baris: BarisKaryawanGaji[] = karyawan.map((k) => {
    const milik = versiPer.get(k.kode) ?? [];
    const sekarangV = pilihVersiBerlaku(milik, sekarang);
    const berikut = milik
      .filter((v) => v.status === "DISETUJUI" && v.berlakuMulai > sekarang)
      .sort((a, b) => a.berlakuMulai.localeCompare(b.berlakuMulai))[0];
    return {
      kode: k.kode,
      nama: k.nama,
      aktif: k.aktif,
      statusPtkp: k.statusPtkp,
      aktifSekarang: sekarangV ? keTampil(sekarangV, ganti, peta, sekarang) : null,
      berikutnya: berikut ? tampil.get(berikut.kode)! : null,
      menunggu: milik.filter((v) => v.status === "DIAJUKAN").length,
    };
  });

  const pengajuan: PengajuanTampil[] = versi
    .filter((v) => v.status === "DIAJUKAN")
    .sort((a, b) => a.diajukanPada.getTime() - b.diajukanPada.getTime())
    .map((v) => {
      const milik = versiPer.get(v.karyawanKode) ?? [];
      const lama = pilihVersiBerlaku(milik, v.berlakuMulai);
      return { ...tampil.get(v.kode)!, lama: lama ? tampil.get(lama.kode)! : null, pengaman: pengamanBerlaku(v.berlakuMulai, slipPer.get(v.karyawanKode) ?? [], milik) };
    });

  const bahanForm: BahanFormSetting = Object.fromEntries(
    baris.map((b) => [
      b.kode,
      {
        versi: (versiPer.get(b.kode) ?? []).map((v) => ({ kode: v.kode, status: v.status, berlakuMulai: v.berlakuMulai, diputuskanPada: v.diputuskanPada?.toISOString() ?? null, aktif: v.aktif })),
        slip: slipPer.get(b.kode) ?? [],
        aktifSekarang: b.aktifSekarang,
      },
    ]),
  );

  return { baris, pengajuan, riwayat: [...tampil.values()], bahanForm, sekarang, periodeBerlaku };
}

/** Jumlah pengajuan setting gaji yang menunggu keputusan Owner (dashboard dan lencana menu). */
export const hitungPengajuanSetting = () => db.settingGaji.count({ where: { status: "DIAJUKAN" } });
