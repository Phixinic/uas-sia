/*
 * Kueri tab Struktur gaji di Master SDM: jabatan inhouse, jabatan event, golongan (gaji pokok), dan tunjangan lain
 * dalam satu halaman, beserta pemakaiannya oleh setting gaji yang berlaku bulan berjalan.
 * Baris tiap jenis diambil dari daftarMaster supaya kolom dan nilai form sama dengan tab master lain.
 * Nominal (gaji pokok, tunjangan, tunjangan jabatan, tarif event) berversi: tabel menampilkan nilai yang berlaku bulan
 * berjalan, versi berikutnya yang sudah disetujui, dan pengajuan yang menunggu; riwayat per item dibuka lewat ?riwayat=.
 */
import { db } from "@/lib/server/db";
import { daftarPeriode, periodeIni, tambahBulan } from "@/lib/inti/tanggal";
import { daftarMaster, type DaftarMaster } from "./master";
import { dataSettingGaji } from "./setting-gaji";
import { JENIS_STRUKTUR, JENIS_STRUKTUR_DARI_NOMINAL, NOMINAL_STRUKTUR, type JenisStruktur } from "@/lib/skema/master";
import { buatPetaNominal, pengamanNominal, teksNominal, type HasilPengamanNominal, type IsiNominal, type JenisNominal } from "@/lib/inti/nominal";
import { versiDigantikan, type StatusVersi } from "@/lib/inti/setting-gaji";
import { dokumenBeku, drafTerdampak, keRingkas } from "@/lib/server/nominal";

/** Satu versi nominal untuk tampilan (riwayat, pengajuan). */
export type TampilNominal = IsiNominal & {
  kode: string;
  jenis: JenisNominal;
  itemKode: string;
  item: string;
  teks: string;
  berlakuMulai: string;
  status: StatusVersi;
  alasan: string;
  alasanTolak: string | null;
  diajukanOleh: string | null;
  diajukanPada: string;
  diputuskanOleh: string | null;
  diputuskanPada: string | null;
  digantikan: boolean;
};

/** Keadaan nominal satu item: berlaku bulan ini, versi disetujui berikutnya (belum berlaku), dan pengajuan menunggu. */
export type InfoNominal = {
  berlaku: TampilNominal | null;
  berikutnya: TampilNominal | null;
  menunggu: TampilNominal[];
  /** Bulan berlaku paling awal yang masih boleh (sesudah slip atau laporan fee terkunci terakhir yang memakai item). */
  palingAwal: string | null;
};

export type PengajuanNominal = TampilNominal & {
  /** Versi yang berlaku di bulan berlaku pengajuan ini sebelum diputuskan (nilai lama). */
  lama: TampilNominal | null;
  pengaman: HasilPengamanNominal;
  /** Slip draf atau event penilaian yang akan ikut nominal baru. */
  draf: string[];
};

export type RingkasJabatan = { kode: string; nama: string; aktif: boolean; karyawan: number; brutoMin: number | null; brutoMaks: number | null };
export type RingkasGolongan = { kode: string; nama: string; aktif: boolean; jumlah: number | null; karyawan: number };

export type DataStrukturGaji = {
  periode: string;
  daftar: Record<JenisStruktur, DaftarMaster>;
  /** Pemakaian per kode master oleh setting gaji yang berlaku (karyawan inhouse aktif). */
  pemakaian: Record<"jabatan" | "golongan" | "tunjangan", Record<string, number>>;
  /** Jadwal kerja per kode jabatan inhouse, sudah diformat (jam kerja dan hari kerja dipisah supaya tabel tidak melebar). */
  jadwal: Record<string, { jam: string; hari: string }>;
  ringkasJabatan: RingkasJabatan[];
  ringkasGolongan: RingkasGolongan[];
  /** Riwayat nominal per jenis dan kode item. */
  nominal: Record<JenisStruktur, Record<string, InfoNominal>>;
  /** Semua versi nominal per jenis dan kode item (urut berlaku mulai), untuk kartu riwayat. */
  riwayat: Record<JenisStruktur, Record<string, TampilNominal[]>>;
  pengajuan: PengajuanNominal[];
  /** Pilihan bulan berlaku form nominal: semua baris periode ditambah 12 bulan ke depan. */
  periodeBerlaku: string[];
  /** Karyawan inhouse aktif, dan berapa yang punya setting gaji berlaku bulan berjalan. */
  karyawanAktif: number;
  karyawanBersetting: number;
};

const tambah = (peta: Record<string, number>, kode: string) => {
  peta[kode] = (peta[kode] ?? 0) + 1;
};

export async function dataStrukturGaji(periode = periodeIni()): Promise<DataStrukturGaji> {
  const [jabatan, jabatanEvent, golongan, tunjangan, jadwalKerja, golonganDb, setting, versiDb, barisPeriode] = await Promise.all([
    daftarMaster("jabatan"),
    daftarMaster("jabatanEvent"),
    daftarMaster("golongan"),
    daftarMaster("tunjangan"),
    db.jabatan.findMany({ where: { jamMasuk: { not: null } }, select: { kode: true, jamMasuk: true, jamKeluar: true, hariKerja: true } }),
    db.golongan.findMany({ orderBy: { kode: "asc" }, select: { kode: true, nama: true, aktif: true } }),
    dataSettingGaji(periode),
    db.versiNominal.findMany({
      orderBy: [{ berlakuMulai: "asc" }, { diajukanPada: "asc" }],
      include: {
        golongan: { select: { nama: true } },
        tunjangan: { select: { nama: true } },
        jabatan: { select: { nama: true, satuanTarif: true } },
        diajukanOleh: { select: { nama: true } },
        diputuskanOleh: { select: { nama: true } },
      },
    }),
    db.periode.findMany({ select: { id: true } }),
  ]);

  // ---- Riwayat nominal: versi berlaku bulan ini, berikutnya, menunggu, dan riwayat per item.
  const ringkas = versiDb.map((v) => keRingkas(v));
  const peta = buatPetaNominal(ringkas);
  const perItem = new Map<string, typeof ringkas>();
  for (const v of ringkas) perItem.set(`${v.jenis}:${v.itemKode}`, [...(perItem.get(`${v.jenis}:${v.itemKode}`) ?? []), v]);
  const ganti = new Set([...perItem.values()].flatMap((d) => [...versiDigantikan(d)]));
  const tampil = new Map<string, TampilNominal>(
    versiDb.map((v, i) => {
      const r = ringkas[i];
      const item = v.golongan?.nama ?? v.tunjangan?.nama ?? v.jabatan?.nama ?? r.itemKode;
      return [v.kode, {
        kode: v.kode, jenis: v.jenis, itemKode: r.itemKode, item,
        nominal: v.nominal, tunjJabatan: v.tunjJabatan, tunjKeluarga: v.tunjKeluarga,
        teks: teksNominal(v.jenis, v, v.jabatan?.satuanTarif),
        berlakuMulai: v.berlakuMulai, status: v.status, alasan: v.alasan, alasanTolak: v.alasanTolak,
        diajukanOleh: v.diajukanOleh?.nama ?? null, diajukanPada: v.diajukanPada.toISOString(),
        diputuskanOleh: v.diputuskanOleh?.nama ?? null, diputuskanPada: v.diputuskanPada?.toISOString() ?? null,
        digantikan: ganti.has(v.kode),
      }];
    }),
  );
  const nominal = Object.fromEntries(JENIS_STRUKTUR.map((j) => [j, {}])) as Record<JenisStruktur, Record<string, InfoNominal>>;
  const riwayat = Object.fromEntries(JENIS_STRUKTUR.map((j) => [j, {}])) as Record<JenisStruktur, Record<string, TampilNominal[]>>;
  const daftarItem: Record<JenisStruktur, DaftarMaster> = { jabatan, jabatanEvent, golongan, tunjangan };
  for (const jenis of JENIS_STRUKTUR) {
    const jn = NOMINAL_STRUKTUR[jenis];
    for (const b of daftarItem[jenis].baris) {
      const milik = perItem.get(`${jn}:${b.kode}`) ?? [];
      const sekarang = peta.pada(jn, b.kode, periode);
      const berikut = milik.filter((v) => v.status === "DISETUJUI" && v.berlakuMulai > periode).sort((a, c) => a.berlakuMulai.localeCompare(c.berlakuMulai))[0];
      const beku = await dokumenBeku(db, jn, b.kode);
      nominal[jenis][b.kode] = {
        berlaku: sekarang ? tampil.get(sekarang.kode)! : null,
        berikutnya: berikut ? tampil.get(berikut.kode)! : null,
        menunggu: milik.filter((v) => v.status === "DIAJUKAN").map((v) => tampil.get(v.kode)!),
        palingAwal: pengamanNominal(periode, beku).palingAwal,
      };
      riwayat[jenis][b.kode] = milik.map((v) => tampil.get(v.kode)!);
    }
  }
  const pengajuan: PengajuanNominal[] = [];
  for (const v of ringkas.filter((x) => x.status === "DIAJUKAN")) {
    const milik = perItem.get(`${v.jenis}:${v.itemKode}`) ?? [];
    const lama = buatPetaNominal(milik).pada(v.jenis, v.itemKode, v.berlakuMulai);
    pengajuan.push({
      ...tampil.get(v.kode)!,
      lama: lama ? tampil.get(lama.kode)! : null,
      pengaman: pengamanNominal(v.berlakuMulai, await dokumenBeku(db, v.jenis, v.itemKode)),
      draf: await drafTerdampak(db, v.jenis, v.itemKode, v.berlakuMulai),
    });
  }
  pengajuan.sort((a, b) => a.diajukanPada.localeCompare(b.diajukanPada));
  const periodeBerlaku = [...new Set([...barisPeriode.map((p) => p.id), ...daftarPeriode(periode, tambahBulan(periode, 12))])].sort();

  // Setting yang berlaku bulan berjalan, hanya karyawan inhouse yang masih aktif (logika sama dengan halaman Setting Gaji).
  const aktif = setting.baris.filter((b) => b.aktif);
  const berlaku = aktif.flatMap((b) => (b.aktifSekarang ? [b.aktifSekarang] : []));
  const pemakaian = { jabatan: {} as Record<string, number>, golongan: {} as Record<string, number>, tunjangan: {} as Record<string, number> };
  const bruto = new Map<string, number[]>();
  for (const v of berlaku) {
    tambah(pemakaian.jabatan, v.jabatanKode);
    tambah(pemakaian.golongan, v.golonganKode);
    for (const t of v.tunjanganKodes) tambah(pemakaian.tunjangan, t);
    bruto.set(v.jabatanKode, [...(bruto.get(v.jabatanKode) ?? []), v.estimasiBruto]);
  }

  const jadwal: Record<string, { jam: string; hari: string }> = {};
  for (const j of jadwalKerja) jadwal[j.kode] = { jam: `${j.jamMasuk} sampai ${j.jamKeluar}`, hari: `${j.hariKerja} hari/bulan` };

  return {
    periode,
    daftar: { jabatan, jabatanEvent, golongan, tunjangan },
    pemakaian,
    jadwal,
    ringkasJabatan: jabatan.baris.map((b) => {
      const n = bruto.get(b.kode) ?? [];
      return { kode: b.kode, nama: b.nama, aktif: b.aktif, karyawan: n.length, brutoMin: n.length ? Math.min(...n) : null, brutoMaks: n.length ? Math.max(...n) : null };
    }),
    ringkasGolongan: golonganDb.map((g) => ({ kode: g.kode, nama: g.nama, aktif: g.aktif, jumlah: peta.pada("GOLONGAN", g.kode, periode)?.nominal ?? null, karyawan: pemakaian.golongan[g.kode] ?? 0 })),
    nominal,
    riwayat,
    pengajuan,
    periodeBerlaku,
    karyawanAktif: aktif.length,
    karyawanBersetting: berlaku.length,
  };
}

/** Jumlah pengajuan nominal yang menunggu keputusan Owner (dashboard dan lencana menu). */
export const hitungPengajuanNominal = () => db.versiNominal.count({ where: { status: "DIAJUKAN" } });

/** Jenis struktur untuk tautan dari jenis nominal (dashboard, log). */
export const jenisStrukturDari = (j: JenisNominal) => JENIS_STRUKTUR_DARI_NOMINAL[j];
