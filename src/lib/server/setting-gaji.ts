/*
 * Layanan server bersama untuk riwayat setting gaji: kunci, isi versi untuk log, dan bahan pengaman per karyawan.
 *
 * Kunci advisory 7410002 menyerialkan persetujuan setting gaji terhadap penghitungan dan pengajuan slip:
 * persetujuan memegang kunci eksklusif, Hitung Gaji dan pengajuan penggajian memegang kunci bersama sampai transaksinya
 * selesai. Jadi slip tidak bisa dihitung atau diajukan dengan versi lama di tengah persetujuan versi baru.
 */
import type { DbAtauTx, Tx } from "@/lib/server/db";
import { isiSama, keteranganLog, pengamanBerlaku, pilihVersiBerlaku, type IsiVersi, type JenisPerubahan, type SlipRingkas, type VersiRingkas } from "@/lib/inti/setting-gaji";
import { muatPetaNominal } from "@/lib/server/nominal";
import { GalatAksi } from "@/lib/server/aksi";
import { AWALAN, kodeBerikutnya } from "@/lib/server/nomor";
import { pastikanTerbuka } from "@/lib/server/periode";
import { catatLog } from "@/lib/server/log";
import { labelPeriode } from "@/lib/inti/tanggal";

export async function tahanKunciSetting(tx: DbAtauTx, eksklusif = false) {
  if (eksklusif) await tx.$executeRaw`SELECT pg_advisory_xact_lock(7410002)`;
  else await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(7410002)`;
}

/** Mengunci baris karyawan sampai transaksi selesai, supaya dua pengajuan atau keputusan untuk karyawan yang sama berurutan. */
export async function kunciKaryawan(tx: Tx, karyawanKode: string) {
  await tx.$queryRaw`SELECT 1 FROM "karyawan" WHERE "id_karyawan" = ${karyawanKode} FOR UPDATE`;
}

/** Semua versi dan slip gaji satu karyawan (bahan pilihVersiBerlaku dan pengamanBerlaku). */
export async function bahanPengaman(klien: DbAtauTx, karyawanKode: string): Promise<{ versi: VersiRingkas[]; slip: SlipRingkas[] }> {
  // Berurutan (bukan Promise.all) karena biasanya dipanggil di dalam transaksi yang memakai satu koneksi.
  const versi = await klien.settingGaji.findMany({ where: { karyawanKode }, select: { kode: true, status: true, berlakuMulai: true, diputuskanPada: true, aktif: true } });
  const slip = await klien.slipGaji.findMany({ where: { karyawanKode }, select: { no: true, periodeId: true, status: true } });
  return { versi, slip: slip.map((s) => ({ no: s.no, periode: s.periodeId, status: s.status })) };
}

/**
 * Isi lengkap satu versi untuk ditampilkan dan dicatat di log: nama master dan nominal yang berlaku di bulan berlaku
 * versi itu (riwayat nominal, versi_nominal). Nominal yang belum berlaku di bulan itu ditulis 0.
 */
export async function isiVersi(klien: DbAtauTx, kode: string | null | undefined): Promise<IsiVersi | null> {
  if (!kode) return null;
  const v = await klien.settingGaji.findUnique({
    where: { kode },
    include: { jabatan: true, golongan: true, tunjangan: { include: { tunjangan: true }, orderBy: { tunjanganKode: "asc" } } },
  });
  if (!v) return null;
  const peta = await muatPetaNominal(klien);
  const p = v.berlakuMulai;
  return {
    jabatanKode: v.jabatanKode,
    jabatan: v.jabatan.nama,
    golonganKode: v.golonganKode,
    golongan: v.golongan.nama,
    gajiPokok: peta.pada("GOLONGAN", v.golonganKode, p)?.nominal ?? 0,
    tunjJabatan: peta.pada("JABATAN", v.jabatanKode, p)?.tunjJabatan ?? 0,
    tunjangan: v.tunjangan.map((t) => ({ kode: t.tunjanganKode, nama: t.tunjangan.nama, nominal: peta.pada("TUNJANGAN", t.tunjanganKode, p)?.nominal ?? 0 })),
    berlakuMulai: v.berlakuMulai,
  };
}

// ====================================================================== Alur ajukan dan setujui
// Dipakai server action (src/lib/aksi/master/setting-gaji.ts) dan skrip data dummy, supaya urutan cek, klaim status,
// dan log selalu sama. Izin dan validasi zod dicek pemanggil.

const GALAT_BULAN = (pesan: string) => ({ bulan: pesan, tahun: pesan });
const daftarSlip = (s: SlipRingkas[]) => s.map((x) => x.no).join(", ");

/** Karyawan inhouse aktif, jabatan inhouse aktif, golongan dan tunjangan aktif. */
async function pastikanRujukanAktif(tx: Tx, d: { karyawanKode: string; jabatanKode: string; golonganKode: string; tunjanganKodes: string[] }) {
  const k = await tx.karyawan.findUnique({ where: { kode: d.karyawanKode }, select: { aktif: true, jenis: true, nama: true } });
  const j = await tx.jabatan.findUnique({ where: { kode: d.jabatanKode }, select: { aktif: true, kelompok: true, nama: true } });
  const g = await tx.golongan.findUnique({ where: { kode: d.golonganKode }, select: { aktif: true, nama: true } });
  const t = await tx.tunjangan.findMany({ where: { kode: { in: d.tunjanganKodes } }, select: { kode: true, aktif: true, nama: true } });
  if (!k) throw new GalatAksi("Karyawan tidak ditemukan.", { karyawanKode: "Karyawan tidak ditemukan." });
  if (!k.aktif) throw new GalatAksi(`${k.nama} sudah dinonaktifkan.`, { karyawanKode: "Karyawan nonaktif." });
  if (k.jenis !== "INHOUSE") throw new GalatAksi("Karyawan event tidak memakai setting gaji. Fee-nya dihitung di menu Fee event.", { karyawanKode: "Karyawan event." });
  if (!j) throw new GalatAksi("Jabatan tidak ditemukan.", { jabatanKode: "Jabatan tidak ditemukan." });
  if (j.kelompok !== "INHOUSE") throw new GalatAksi("Jabatan event tidak dipakai untuk gaji inhouse.", { jabatanKode: "Jabatan event." });
  if (!j.aktif) throw new GalatAksi(`Jabatan ${j.nama} sudah dinonaktifkan.`, { jabatanKode: "Jabatan nonaktif." });
  if (!g) throw new GalatAksi("Gaji pokok tidak ditemukan.", { golonganKode: "Gaji pokok tidak ditemukan." });
  if (!g.aktif) throw new GalatAksi(`Gaji pokok ${g.nama} sudah dinonaktifkan.`, { golonganKode: "Gaji pokok nonaktif." });
  if (t.length !== d.tunjanganKodes.length) throw new GalatAksi("Ada tunjangan yang tidak ditemukan.", { tunjanganKodes: "Tunjangan tidak ditemukan." });
  const mati = t.find((x) => !x.aktif);
  if (mati) throw new GalatAksi(`Tunjangan ${mati.nama} sudah dinonaktifkan.`, { tunjanganKodes: "Tunjangan nonaktif dipilih." });
  return k.nama;
}

/**
 * Nominal komponen (riwayat nominal) harus sudah disetujui dan berlaku di bulan berlaku setting, supaya Hitung Gaji
 * selalu punya angkanya. Dicek sesudah pengaman bulan berlaku, saat mengajukan dan saat menyetujui.
 */
async function pastikanNominalBerlaku(tx: Tx, d: { jabatanKode: string; golonganKode: string; tunjanganKodes: string[]; berlaku: string }) {
  const peta = await muatPetaNominal(tx);
  const nama = async (jenis: "jabatan" | "golongan" | "tunjangan", kode: string) =>
    (await (tx[jenis] as unknown as { findUnique: (a: unknown) => Promise<{ nama: string } | null> }).findUnique({ where: { kode } }))?.nama ?? kode;
  const belum = (label: string, n: string) => `${label} ${n} belum punya nominal yang disetujui dan berlaku di ${labelPeriode(d.berlaku)}. Minta Owner menyetujui nominalnya dulu di tab Struktur gaji.`;
  if (!peta.pada("JABATAN", d.jabatanKode, d.berlaku)) throw new GalatAksi(belum("Tunjangan jabatan", await nama("jabatan", d.jabatanKode)), { jabatanKode: "Nominal jabatan belum berlaku." });
  if (!peta.pada("GOLONGAN", d.golonganKode, d.berlaku)) throw new GalatAksi(belum("Gaji pokok", await nama("golongan", d.golonganKode)), { golonganKode: "Gaji pokok belum berlaku." });
  const tanpa = d.tunjanganKodes.find((x) => !peta.pada("TUNJANGAN", x, d.berlaku));
  if (tanpa) throw new GalatAksi(belum("Tunjangan", await nama("tunjangan", tanpa)), { tunjanganKodes: "Nominal tunjangan belum berlaku." });
}

export type InputSetting = { karyawanKode: string; jenisPerubahan: JenisPerubahan; jabatanKode: string; golonganKode: string; tunjanganKodes: string[]; alasan: string };

/** Ajukan versi setting gaji (status DIAJUKAN) dengan bulan berlaku. Lihat pengamanBerlaku untuk aturan bulan berlaku. */
export async function ajukanSettingDalam(tx: Tx, penggunaId: number, d: InputSetting, berlaku: string): Promise<{ kode: string; nama: string; draf: SlipRingkas[] }> {
  const tunjanganKodes = [...new Set(d.tunjanganKodes)].sort();
  const pengguna = { id: penggunaId };
  await pastikanTerbuka(tx, berlaku, GALAT_BULAN("Periode ini sudah tertutup."));
  await kunciKaryawan(tx, d.karyawanKode);
  const nama = await pastikanRujukanAktif(tx, { ...d, tunjanganKodes });
  const { versi, slip } = await bahanPengaman(tx, d.karyawanKode);

  const adaDisetujui = versi.some((v) => v.status === "DISETUJUI");
  if (!adaDisetujui && d.jenisPerubahan !== "SETTING_AWAL") {
    throw new GalatAksi(`${nama} belum punya setting gaji yang disetujui, jadi pengajuan pertamanya berjenis Setting awal.`, { jenisPerubahan: "Pilih Setting awal." });
  }
  if (adaDisetujui && d.jenisPerubahan === "SETTING_AWAL") {
    throw new GalatAksi(`${nama} sudah punya setting gaji. Pilih Promosi, Demosi, atau Penyesuaian.`, { jenisPerubahan: "Sudah punya setting gaji." });
  }
  if (versi.some((v) => v.status === "DIAJUKAN" && v.berlakuMulai === berlaku)) {
    throw new GalatAksi(`Sudah ada pengajuan setting gaji ${nama} berlaku ${labelPeriode(berlaku)} yang menunggu Owner. Tunggu keputusannya dulu.`, GALAT_BULAN("Sudah ada pengajuan di bulan ini."));
  }
  const p = pengamanBerlaku(berlaku, slip, versi);
  if (p.galat) throw new GalatAksi(p.galat, GALAT_BULAN(p.galat));
  await pastikanNominalBerlaku(tx, { ...d, tunjanganKodes, berlaku });

  const lama = pilihVersiBerlaku(versi, berlaku);
  const isiLama = await isiVersi(tx, lama?.kode);
  if (isiLama && isiSama(isiLama, { jabatanKode: d.jabatanKode, golonganKode: d.golonganKode, tunjangan: tunjanganKodes.map((kode) => ({ kode, nama: "", nominal: 0 })) })) {
    throw new GalatAksi(`Isian sama dengan setting ${lama!.kode} yang berlaku di ${labelPeriode(berlaku)}. Tidak ada yang berubah.`, { jabatanKode: "Belum ada perubahan." });
  }

  const kode = await kodeBerikutnya(tx, AWALAN.SETTING_GAJI);
  await tx.settingGaji.create({
    data: {
      kode,
      karyawanKode: d.karyawanKode,
      jabatanKode: d.jabatanKode,
      golonganKode: d.golonganKode,
      berlakuMulai: berlaku,
      jenisPerubahan: d.jenisPerubahan,
      alasan: d.alasan,
      status: "DIAJUKAN",
      diajukanOlehId: pengguna.id,
      tunjangan: { create: tunjanganKodes.map((tunjanganKode) => ({ tunjanganKode })) },
    },
  });
  const isiBaru = (await isiVersi(tx, kode))!;
  const catatan = [`Alasan: ${d.alasan}.`, p.drafTerdampak.length ? `Bila disetujui, slip draf ${daftarSlip(p.drafTerdampak)} perlu dihitung ulang.` : ""].join(" ").trim();
  await catatLog(tx, pengguna.id, "setting-gaji.ajukan", "setgaji", kode, `${nama}. ${keteranganLog(d.jenisPerubahan, isiLama, isiBaru, catatan)}`);
  return { kode, nama, draf: p.drafTerdampak };
}

/** Setujui pengajuan setting gaji (Owner). Pengaman dan nominal komponen dicek ulang. */
export async function setujuiSettingDalam(tx: Tx, penggunaId: number, kode: string): Promise<{ nama: string; berlaku: string; draf: SlipRingkas[] }> {
  const pengguna = { id: penggunaId };
  const v = await tx.settingGaji.findUnique({ where: { kode }, include: { tunjangan: true } });
  if (!v) throw new GalatAksi(`Pengajuan ${kode} tidak ditemukan.`);
  if (v.status !== "DIAJUKAN") throw new GalatAksi(`Pengajuan ${kode} sudah diputuskan.`);
  await pastikanTerbuka(tx, v.berlakuMulai);
  // Kunci eksklusif: Hitung Gaji dan pengajuan penggajian menunggu sampai keputusan ini selesai.
  await tahanKunciSetting(tx, true);
  await kunciKaryawan(tx, v.karyawanKode);
  const rujukan = { karyawanKode: v.karyawanKode, jabatanKode: v.jabatanKode, golonganKode: v.golonganKode, tunjanganKodes: v.tunjangan.map((t) => t.tunjanganKode) };
  const nama = await pastikanRujukanAktif(tx, rujukan);

  // Pengaman dicek ulang: slip bisa sudah diajukan atau dibayar sejak pengajuan ini dibuat.
  const { versi, slip } = await bahanPengaman(tx, v.karyawanKode);
  const p = pengamanBerlaku(v.berlakuMulai, slip, versi);
  if (p.galat) throw new GalatAksi(`${p.galat} Tolak pengajuan ini, lalu minta HRD mengajukan ulang dengan bulan berlaku yang benar.`);
  await pastikanNominalBerlaku(tx, { ...rujukan, berlaku: v.berlakuMulai });
  const lama = pilihVersiBerlaku(versi, v.berlakuMulai);
  const isiLama = await isiVersi(tx, lama?.kode);

  const klaim = await tx.settingGaji.updateMany({ where: { kode, status: "DIAJUKAN" }, data: { status: "DISETUJUI", diputuskanOlehId: pengguna.id, diputuskanPada: new Date() } });
  if (klaim.count !== 1) throw new GalatAksi(`Pengajuan ${kode} baru saja diputuskan pengguna lain.`);
  const isiBaru = (await isiVersi(tx, kode))!;
  const catatan = p.drafTerdampak.length ? `Slip draf ${daftarSlip(p.drafTerdampak)} perlu dihitung ulang.` : "Tidak ada slip draf yang terdampak.";
  await catatLog(tx, pengguna.id, "setting-gaji.setujui", "setgaji", kode, `${nama}. ${keteranganLog(v.jenisPerubahan, isiLama, isiBaru, catatan)}`);
  return { nama, berlaku: v.berlakuMulai, draf: p.drafTerdampak };
}
