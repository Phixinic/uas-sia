/*
 * Seed data contoh D'Production Oktober 2026 (salinan data app lama di prisma/data/contoh-oktober-2026.json)
 * ditambah tiga pengguna demo, lalu data contoh fee event (crew freelance) November 2026 dengan dua akun kapten.
 * Dua setoran modal data lama (JU-2026-0001 dan JU-2026-0010) dicatat sebagai Investasi Kas DISETUJUI
 * (INV-2026-0001 dan INV-2026-0002) dengan aturan yang sama dengan backfill migrasi Investasi Kas.
 * Data fee event tidak membuat jurnal, jadi angka akuntansi data lama tidak berubah. Jalankan: npm run db:seed
 * Menolak berjalan bila database sudah berisi pengguna, kecuali SEED_PAKSA=1 (semua data dihapus dulu).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { db } from "../src/lib/server/db";
import { hashKataSandi } from "../src/lib/server/kata-sandi";
import { dariDate, keDate, periodeDari } from "../src/lib/inti/tanggal";
import { AKUN } from "../src/lib/inti/akun";
import { muatJurnalBuku } from "../src/lib/server/jurnal";
import { neracaSaldo } from "../src/lib/inti/buku-besar";
import { PENGGUNA_KAPTEN, seedFeeEvent } from "./seed-fee-event";
import type { Peran, StatusPtkp, TipeAkun } from "../src/generated/prisma/enums";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Koleksi = Record<string, any>;
const SEED: Record<string, Koleksi> = JSON.parse(fs.readFileSync(path.join(__dirname, "data/contoh-oktober-2026.json"), "utf8"));
const daftar = (nama: string): any[] => Object.entries(SEED[nama] ?? {}).map(([id, d]) => ({ id, ...d }));

export const PENGGUNA_DEMO: { namaPengguna: string; nama: string; peran: Peran; sandi: string }[] = [
  { namaPengguna: "admin", nama: "Admin Keuangan", peran: "ADMIN", sandi: "admin123" },
  { namaPengguna: "hrd", nama: "Staf HRD", peran: "HRD", sandi: "hrd12345" },
  { namaPengguna: "owner", nama: "Owner D'Production", peran: "OWNER", sandi: "owner123" },
];


/** Contoh riwayat setting gaji: promosi KRY-04 disetujui berlaku Desember 2026, penyesuaian KRY-05 menunggu Owner. */
const CONTOH_SETTING: {
  kode: string; karyawanKode: string; jabatanKode: string; golonganKode: string; tunjangan: string[]; berlakuMulai: string;
  jenis: "PROMOSI" | "PENYESUAIAN"; status: "DISETUJUI" | "DIAJUKAN"; alasan: string; diajukanPada: string; diputuskanPada: string | null;
}[] = [
  {
    kode: "SET-06", karyawanKode: "KRY-04", jabatanKode: "JBT-03", golonganKode: "GP-02", tunjangan: ["TNJ-01", "TNJ-02"], berlakuMulai: "2026-12",
    jenis: "PROMOSI", status: "DISETUJUI", alasan: "Promosi dari Crew Produksi menjadi Operator Sound & Lighting setelah lulus evaluasi kinerja.",
    diajukanPada: "2026-11-16T09:00:00+07:00", diputuskanPada: "2026-11-17T10:30:00+07:00",
  },
  {
    kode: "SET-07", karyawanKode: "KRY-05", jabatanKode: "JBT-02", golonganKode: "GP-01", tunjangan: ["TNJ-01", "TNJ-02", "TNJ-04"], berlakuMulai: "2027-01",
    jenis: "PENYESUAIAN", status: "DIAJUKAN", alasan: "Penambahan tunjangan kesehatan sesuai kebijakan tahun 2027.",
    diajukanPada: "2026-11-20T14:00:00+07:00", diputuskanPada: null,
  },
];

const TIPE_AKUN: Record<string, TipeAkun> = { Aset: "ASET", "Kontra aset": "KONTRA_ASET", Liabilitas: "LIABILITAS", Ekuitas: "EKUITAS", Pendapatan: "PENDAPATAN", Beban: "BEBAN" };
const ptkp = (s: string) => s.replace("/", "") as StatusPtkp;
// Nilai lama huruf kecil ("disetujui") -> enum Prisma ("DISETUJUI").
const besar = (s: string): any => s.toUpperCase();
const waktu = (s: string | null | undefined) => (s ? new Date(s) : null);
const kosongJadiNull = (s: string | null | undefined) => (s ? s : null);

const TABEL = [
  "investasi_kas", "slip_fee", "laporan_fee", "kehadiran_event", "penugasan_event", "sesi_event", "event",
  "log_aktivitas", "sesi", "riwayat_periode", "slip_tunjangan", "slip_gaji", "penggajian", "presensi", "setting_tunjangan", "setting_gaji",
  "jadwal_kerja", "tunjangan", "golongan", "jabatan", "karyawan", "pelepasan", "detail_opname", "opname", "jadwal_penyusutan", "aset",
  "detail_pembelian", "pembelian", "perlengkapan", "peralatan", "kategori_aset", "supplier", "detail_jurnal", "jurnal", "periode", "akun",
  "penghitung", "profil_usaha", "pengguna",
];

async function main() {
  const ada = await db.pengguna.count();
  if (ada > 0 && process.env.SEED_PAKSA !== "1") {
    console.error("Database sudah berisi data. Jalankan dengan SEED_PAKSA=1 untuk menghapus semua data lalu mengisi ulang data contoh.");
    process.exit(1);
  }
  await db.$executeRawUnsafe(`TRUNCATE ${TABEL.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);

  // ---------- Pengguna ----------
  const idPeran: Record<string, number> = {};
  for (const p of PENGGUNA_DEMO) {
    const u = await db.pengguna.create({ data: { namaPengguna: p.namaPengguna, nama: p.nama, peran: p.peran, kataSandiHash: await hashKataSandi(p.sandi) } });
    idPeran[p.namaPengguna] = u.id;
  }
  const oleh = (peranLama: string | null | undefined) => (peranLama ? idPeran[peranLama] ?? idPeran.admin : null);

  // ---------- Profil, penghitung, akun, periode ----------
  const meta = SEED.meta;
  await db.profilUsaha.create({ data: { id: 1, nama: meta.profil?.nama ?? "D'Production", keterangan: meta.profil?.ket ?? "" } });
  await db.penghitung.createMany({ data: Object.entries(meta.counters as Record<string, number>).map(([kunci, nilai]) => ({ kunci, nilai })) });
  await db.akun.createMany({
    data: daftar("akun").map((a) => ({ kode: a.kode, nama: a.nama, tipe: TIPE_AKUN[a.tipe], saldoNormal: a.saldo_normal, aktif: a.aktif !== false })),
  });

  const aset = daftar("aset");
  const semuaPeriode = new Set<string>();
  daftar("jurnal").forEach((j) => semuaPeriode.add(j.periode));
  aset.forEach((a) => a.jadwal.forEach((r: any) => semuaPeriode.add(r.periode)));
  daftar("opname").forEach((o) => semuaPeriode.add(o.periode));
  daftar("slip").forEach((s) => semuaPeriode.add(s.periode));
  daftar("penggajian").forEach((g) => semuaPeriode.add(g.periode));
  await db.periode.createMany({ data: [...semuaPeriode].sort().map((id) => ({ id })) });

  // ---------- Master konversi ----------
  await db.supplier.createMany({
    data: daftar("supplier").map((s) => ({ kode: s.id, nama: s.nama, alamat: s.alamat ?? "", telepon: s.telepon ?? "", email: s.email ?? "", npwp: kosongJadiNull(s.npwp), aktif: s.aktif !== false })),
  });
  await db.kategoriAset.createMany({
    data: daftar("kategori").map((k) => ({
      kode: k.id, nama: k.nama, masaManfaatBulan: k.masa_manfaat_bulan, persenResidu: k.persen_residu ?? 0,
      akunAsetKode: k.akun_aset, akunAkumulasiKode: k.akun_akumulasi, akunBebanKode: k.akun_beban, aktif: k.aktif !== false,
    })),
  });
  await db.peralatan.createMany({ data: daftar("peralatan").map((p) => ({ kode: p.id, nama: p.nama, satuan: p.satuan, kategoriKode: p.kategori_id, aktif: p.aktif !== false })) });
  await db.perlengkapan.createMany({ data: daftar("perlengkapan").map((p) => ({ kode: p.id, nama: p.nama, satuan: p.satuan, aktif: p.aktif !== false })) });

  // ---------- Master SDM ----------
  await db.karyawan.createMany({
    data: daftar("karyawan").map((k) => ({ kode: k.id, nama: k.nama, statusPtkp: ptkp(k.status_ptkp), bank: k.bank, noRek: k.no_rek, aktif: k.aktif !== false })),
  });
  await db.jabatan.createMany({
    data: daftar("jabatan").map((j) => ({ kode: j.id, nama: j.nama, tunjJabatan: j.tunj_jabatan ?? 0, tunjKeluarga: j.tunj_keluarga ?? 0, akunBebanKode: j.akun_beban, aktif: j.aktif !== false })),
  });
  await db.golongan.createMany({ data: daftar("golongan").map((g) => ({ kode: g.id, nama: g.nama, jumlah: g.jumlah, aktif: g.aktif !== false })) });
  await db.tunjangan.createMany({ data: daftar("tunjangan").map((t) => ({ kode: t.id, nama: t.nama, nominal: t.nominal, aktif: t.aktif !== false })) });
  await db.jadwalKerja.createMany({
    data: daftar("jadwal").map((t) => ({ kode: t.id, jabatanKode: t.jabatan_id, jamMasuk: t.jam_masuk, jamKeluar: t.jam_keluar, hariKerja: t.hari_kerja, aktif: t.aktif !== false })),
  });
  // Setting gaji = riwayat versi. Data lama menjadi versi DISETUJUI berjenis Setting awal yang berlaku Oktober 2026
  // (aturan sama dengan migrasi 20261123120000_setting_gaji_riwayat), lalu satu contoh promosi disetujui yang berlaku
  // Desember 2026 dan satu pengajuan penyesuaian yang menunggu Owner. Gaji Oktober dan November tidak berubah.
  await db.periode.createMany({ data: ["2026-10", "2026-12", "2027-01"].map((id) => ({ id })), skipDuplicates: true });
  const awalSetting = waktu("2026-10-01T08:00:00+07:00")!;
  for (const s of daftar("setgaji")) {
    await db.settingGaji.create({
      data: {
        kode: s.id, karyawanKode: s.karyawan_id, jabatanKode: s.jabatan_id, golonganKode: s.golongan_id, aktif: s.aktif !== false,
        berlakuMulai: "2026-10", jenisPerubahan: "SETTING_AWAL", status: "DISETUJUI", alasan: "Setting awal karyawan inhouse (data contoh Oktober 2026).",
        diajukanOlehId: idPeran.hrd, diajukanPada: awalSetting, diputuskanOlehId: idPeran.owner, diputuskanPada: awalSetting,
        tunjangan: { create: (s.tunjangan_ids ?? []).map((t: string) => ({ tunjanganKode: t })) },
      },
    });
  }
  for (const c of CONTOH_SETTING) {
    await db.settingGaji.create({
      data: {
        kode: c.kode, karyawanKode: c.karyawanKode, jabatanKode: c.jabatanKode, golonganKode: c.golonganKode, berlakuMulai: c.berlakuMulai,
        jenisPerubahan: c.jenis, status: c.status, alasan: c.alasan, diajukanOlehId: idPeran.hrd, diajukanPada: waktu(c.diajukanPada)!,
        diputuskanOlehId: c.status === "DISETUJUI" ? idPeran.owner : null, diputuskanPada: c.status === "DISETUJUI" ? waktu(c.diputuskanPada) : null,
        tunjangan: { create: c.tunjangan.map((tunjanganKode) => ({ tunjanganKode })) },
      },
    });
  }
  await db.penghitung.upsert({ where: { kunci: "SET" }, create: { kunci: "SET", nilai: 7 }, update: { nilai: 7 } });

  // ---------- Jurnal ----------
  for (const j of daftar("jurnal").sort((a, b) => a.id.localeCompare(b.id))) {
    await db.jurnal.create({
      data: {
        no: j.id, tanggal: keDate(j.tanggal), periodeId: j.periode, jenis: besar(j.jenis), keterangan: j.keterangan, status: besar(j.status),
        alasanTolak: j.alasan_tolak ?? null, sumberTipe: j.sumber_tipe ? besar(j.sumber_tipe) : null, sumberId: j.sumber_id ?? null,
        pembalikDariNo: j.pembalik_dari ?? null, dibuatOlehId: oleh(j.dibuat_oleh)!, dibuatPada: waktu(j.dibuat_pada) ?? new Date(),
        diajukanPada: waktu(j.diajukan_pada), disetujuiOlehId: oleh(j.disetujui_oleh), disetujuiPada: waktu(j.disetujui_pada),
        detail: { create: j.baris.map((b: any, i: number) => ({ noUrut: i + 1, akunKode: b.akun, debit: b.debit, kredit: b.kredit })) },
      },
    });
  }

  // ---------- Investasi Kas ----------
  // Aturan sama dengan backfill di prisma/migrations/20261123090100_investasi_kas: jurnal SALDO_AWAL DISETUJUI yang
  // berisi tepat Dr Kas dan Kr Modal Pemilik bernilai sama menjadi setoran DISETUJUI, nomor urut tanggal lalu nomor
  // jurnal per tahun, dan sumber jurnalnya dipindah ke INVESTASI_KAS. Angka dan nomor jurnal tidak berubah.
  const perTahun: Record<string, number> = {};
  const setoranLama = await db.jurnal.findMany({ where: { sumberTipe: "SALDO_AWAL", status: "DISETUJUI", jenis: "UMUM" }, include: { detail: true }, orderBy: [{ tanggal: "asc" }, { no: "asc" }] });
  for (const j of setoranLama) {
    const kas = j.detail.find((d) => d.akunKode === AKUN.KAS && d.debit > 0 && d.kredit === 0);
    const modal = j.detail.find((d) => d.akunKode === AKUN.MODAL && d.debit === 0 && d.kredit === kas?.debit);
    if (j.detail.length !== 2 || !kas || !modal) continue;
    const tahun = dariDate(j.tanggal).slice(0, 4);
    perTahun[tahun] = (perTahun[tahun] ?? 0) + 1;
    const no = `INV-${tahun}-${String(perTahun[tahun]).padStart(4, "0")}`;
    await db.investasiKas.create({
      data: {
        no, tanggal: j.tanggal, jumlah: kas.debit, keterangan: j.keterangan, status: "DISETUJUI", jurnalNo: j.no, dibuatOlehId: j.dibuatOlehId,
        dibuatPada: j.dibuatPada, diputuskanOlehId: j.disetujuiOlehId ?? j.dibuatOlehId, diputuskanPada: j.disetujuiPada ?? j.dibuatPada,
      },
    });
    await db.jurnal.update({ where: { no: j.no }, data: { sumberTipe: "INVESTASI_KAS", sumberId: no } });
  }
  for (const [tahun, nilai] of Object.entries(perTahun)) await db.penghitung.upsert({ where: { kunci: `INV${tahun}` }, create: { kunci: `INV${tahun}`, nilai }, update: { nilai } });

  // ---------- Pembelian ----------
  const statusBeli = (s: string) => (s === "posted" ? "DISETUJUI" : s === "dibalik" ? "DIBALIK" : "DRAFT") as "DISETUJUI" | "DIBALIK" | "DRAFT";
  for (const b of daftar("pembelian")) {
    const peralatan = b.jenis === "peralatan";
    await db.pembelian.create({
      data: {
        no: b.id, jenis: besar(b.jenis), tanggal: keDate(b.tanggal), supplierKode: kosongJadiNull(b.supplier_id), caraBayar: besar(b.cara_bayar),
        jatuhTempo: b.jatuh_tempo ? keDate(b.jatuh_tempo) : null, keterangan: b.keterangan ?? "", total: b.total, status: statusBeli(b.status),
        jurnalNo: b.jurnal_id ?? null, jurnalPembalikNo: b.jurnal_pembalik ?? null, alasanBalik: b.alasan_balik ?? null,
        dibuatOlehId: oleh(b.dibuat_oleh)!, disetujuiOlehId: oleh(b.diposting_oleh), disetujuiPada: waktu(b.diposting_pada),
        dibalikOlehId: oleh(b.dibalik_oleh), dibalikPada: waktu(b.dibalik_pada),
        detail: {
          create: b.items.map((it: any, i: number) => ({
            noUrut: i + 1, qty: it.qty, harga: it.harga,
            ...(peralatan
              ? { peralatanKode: it.barang_id, residu: it.residu ?? 0, garansiBulan: it.garansi_bulan ?? 0, masaManfaatBulan: it.masa_manfaat_bulan ?? 0, dasarN: it.dasar_n === "garansi" ? "GARANSI" as const : "MASA_MANFAAT" as const }
              : { perlengkapanKode: it.barang_id }),
          })),
        },
      },
    });
  }

  // ---------- Aset dan jadwal penyusutan ----------
  for (const a of aset) {
    const beli = SEED.pembelian[a.pembelian_id];
    const noUrut = beli.items.findIndex((it: any) => it.barang_id === a.barang_id) + 1;
    await db.aset.create({
      data: {
        kode: a.id, pembelianNo: a.pembelian_id, noUrut, peralatanKode: a.barang_id, kategoriKode: a.kategori_id, nama: a.nama,
        tglPerolehan: keDate(a.tgl_perolehan), bulanMulai: a.bulan_mulai, nilaiPerolehan: a.nilai_perolehan, residu: a.residu,
        garansiBulan: a.garansi_bulan ?? 0, garansiSampai: a.garansi_sampai ? keDate(a.garansi_sampai) : null, masaManfaatBulan: a.masa_manfaat_bulan ?? 0,
        dasarN: a.dasar_n === "garansi" ? "GARANSI" : "MASA_MANFAAT", n: a.n, d: a.d, terakhir: a.terakhir, pengaman: !!a.pengaman,
        akunAsetKode: a.akun_aset, akunAkumulasiKode: a.akun_akm, akunBebanKode: a.akun_beban, status: besar(a.status),
        tanggalLepas: a.tanggal_lepas ? keDate(a.tanggal_lepas) : null,
        jadwal: { create: a.jadwal.map((r: any) => ({ periodeKe: r.p, periodeId: r.periode, beban: r.beban, akumulasi: r.akumulasi, nilaiBuku: r.nilai_buku, jurnalNo: r.jurnal_id ?? null })) },
      },
    });
  }

  // ---------- Opname ----------
  for (const o of daftar("opname")) {
    const j = o.jurnal_id ? SEED.jurnal[o.jurnal_id] : null;
    const status = o.status === "ditolak" ? "DITOLAK" : j ? besar(j.status) : "DISETUJUI";
    await db.opname.create({
      data: {
        no: o.id, periodeId: o.periode, totalBeban: o.total_beban, status, jurnalNo: o.jurnal_id ?? null, dibuatOlehId: oleh(o.dibuat_oleh)!,
        dibuatPada: waktu(o.dibuat_pada) ?? new Date(), disetujuiOlehId: status === "DISETUJUI" ? oleh(j?.disetujui_oleh ?? o.dibuat_oleh) : null,
        disetujuiPada: status === "DISETUJUI" ? waktu(j?.disetujui_pada ?? o.dibuat_pada) : null,
        detail: { create: o.rows.map((r: any) => ({ perlengkapanKode: r.barang_id, saldoBuku: r.saldo_buku, nilaiSisa: r.nilai_sisa })) },
      },
    });
  }

  // ---------- Presensi ----------
  await db.presensi.createMany({
    data: daftar("presensi").map((p) => ({
      karyawanKode: p.karyawan_id, tanggal: keDate(p.tanggal), jadwalKode: p.jadwal_id, absensi: besar(p.absensi),
      jamMasuk: kosongJadiNull(p.jam_masuk), jamKeluar: kosongJadiNull(p.jam_keluar), terlambat: p.terlambat ?? 0, dibuatOlehId: oleh(p.dibuat_oleh ?? "hrd")!,
    })),
  });

  // ---------- Penggajian dan slip ----------
  for (const g of daftar("penggajian")) {
    await db.penggajian.create({
      data: {
        no: g.id, periodeId: g.periode, jumlahSlip: g.jumlah, totalBruto: g.total_bruto, totalPph: g.total_pph, totalThp: g.total_thp,
        status: besar(g.status), alasanTolak: g.alasan_tolak ?? null, jurnalNo: g.jurnal_id ?? null, dibuatOlehId: oleh(g.dibuat_oleh)!,
        dibuatPada: waktu(g.dibuat_pada) ?? new Date(), disetujuiOlehId: oleh(g.disetujui_oleh), disetujuiPada: waktu(g.disetujui_pada),
      },
    });
  }
  const statusSlip = (s: string) => (s === "dibayar" ? "DISETUJUI" : besar(s));
  for (const s of daftar("slip")) {
    const g = s.ref ? SEED.penggajian[s.ref] : null;
    const st = statusSlip(s.status);
    await db.slipGaji.create({
      data: {
        no: s.id, periodeId: s.periode, karyawanKode: s.karyawan_id, jabatanKode: s.jabatan_id, golonganKode: s.golongan_id, jadwalKode: kosongJadiNull(s.jadwal_id),
        akunBebanKode: s.akun_beban, statusPtkp: ptkp(s.status_ptkp), hariKerja: s.hari_kerja, jumlahPresensi: s.presensi, hadir: s.hadir, izin: s.izin,
        sakit: s.sakit, cuti: s.cuti, alpa: s.alpa, jamKerja: s.jam_kerja, terlambatMenit: s.terlambat_menit, gajiPokok: s.gaji_pokok,
        tunjJabatan: s.tunj_jabatan, tunjKeluarga: s.tunj_keluarga, tunjLain: (s.tunj_lain ?? []).reduce((x: number, t: any) => x + t.nominal, 0),
        potonganAbsen: s.potongan_absen, bruto: s.bruto, brutoSetahun: s.pajak.setahun, biayaJabatan: s.pajak.biaya, netoSetahun: s.pajak.neto,
        ptkp: s.pajak.ptkp, pkp: s.pajak.pkp, pphSetahun: s.pajak.pph_setahun, pph21: s.pph21, thp: s.thp, status: st, penggajianNo: s.ref ?? null,
        settingKode: daftar("setgaji").find((x) => x.karyawan_id === s.karyawan_id)?.id ?? null,
        dibuatOlehId: oleh(s.dibuat_oleh)!, dihitungPada: waktu(s.dihitung_pada) ?? new Date(),
        disetujuiOlehId: st === "DISETUJUI" ? oleh(g?.disetujui_oleh) : null, disetujuiPada: st === "DISETUJUI" ? waktu(g?.disetujui_pada) : null,
        tunjangan: { create: (s.tunj_lain ?? []).map((t: any) => ({ tunjanganKode: t.id, nama: t.nama, nominal: t.nominal })) },
      },
    });
  }

  // ---------- Pelepasan ----------
  for (const p of daftar("pelepasan")) {
    await db.pelepasan.create({
      data: {
        no: p.id, asetKode: p.aset_id, tanggal: keDate(p.tanggal), alasan: besar(p.alasan), hargaJual: p.harga_jual ?? 0,
        nilaiPerolehan: p.nilai_perolehan, akumulasi: p.akumulasi, nilaiBuku: p.nilai_buku, labaRugi: p.laba_rugi, status: besar(p.status),
        alasanTolak: p.alasan_tolak ?? null, jurnalNo: p.jurnal_id ?? null, dibuatOlehId: oleh(p.dibuat_oleh)!, dibuatPada: waktu(p.dibuat_pada) ?? new Date(),
        disetujuiOlehId: oleh(p.disetujui_oleh), disetujuiPada: waktu(p.disetujui_pada),
      },
    });
    await db.periode.createMany({ data: [{ id: periodeDari(p.tanggal) }], skipDuplicates: true });
  }

  await seedFeeEvent(db, idPeran);

  await db.logAktivitas.create({ data: { penggunaId: null, aksi: "seed", entitas: "sistem", entitasId: null, keterangan: "Data contoh Oktober 2026 dan fee event November 2026 dimuat." } });

  // ---------- Pemeriksaan ----------
  const ns = neracaSaldo(await muatJurnalBuku(db, "2026-10"), (await db.akun.findMany({ select: { kode: true } })).map((a) => a.kode), "2026-10");
  console.log(`Seed selesai. Neraca saldo s.d. Oktober 2026: debit ${ns.debit.toLocaleString("id-ID")}, kredit ${ns.kredit.toLocaleString("id-ID")}${ns.seimbang ? " (seimbang)" : " (TIDAK SEIMBANG)"}.`);
  console.log("Akun demo: " + [...PENGGUNA_DEMO, ...PENGGUNA_KAPTEN].map((p) => `${p.namaPengguna} / ${p.sandi}`).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
