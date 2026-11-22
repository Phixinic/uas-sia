/*
 * Seed data contoh D'Production Oktober 2026 (salinan data app lama di prisma/data/contoh-oktober-2026.json)
 * ditambah tiga pengguna demo, lalu data contoh fee event (crew freelance) November 2026 dengan dua akun kapten.
 * Data fee event tidak membuat jurnal, jadi angka akuntansi data lama tidak berubah. Jalankan: npm run db:seed
 * Menolak berjalan bila database sudah berisi pengguna, kecuali SEED_PAKSA=1 (semua data dihapus dulu).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { db } from "../src/lib/server/db";
import { hashKataSandi } from "../src/lib/server/kata-sandi";
import { keDate, periodeDari } from "../src/lib/inti/tanggal";
import { muatJurnalBuku } from "../src/lib/server/jurnal";
import { neracaSaldo } from "../src/lib/inti/buku-besar";
import { muatBahanEvent } from "../src/lib/data/fee-event/bahan";
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

/** Akun kapten contoh (crew freelance). Ditautkan ke karyawan event di seedFeeEvent. */
export const PENGGUNA_KAPTEN: { namaPengguna: string; nama: string; karyawanKode: string; sandi: string }[] = [
  { namaPengguna: "kapten", nama: "Bima Satria", karyawanKode: "KRY-06", sandi: "kapten123" },
  { namaPengguna: "kapten2", nama: "Sari Wulandari", karyawanKode: "KRY-07", sandi: "kapten123" },
];

const TIPE_AKUN: Record<string, TipeAkun> = { Aset: "ASET", "Kontra aset": "KONTRA_ASET", Liabilitas: "LIABILITAS", Ekuitas: "EKUITAS", Pendapatan: "PENDAPATAN", Beban: "BEBAN" };
const ptkp = (s: string) => s.replace("/", "") as StatusPtkp;
// Nilai lama huruf kecil ("disetujui") -> enum Prisma ("DISETUJUI").
const besar = (s: string): any => s.toUpperCase();
const waktu = (s: string | null | undefined) => (s ? new Date(s) : null);
const kosongJadiNull = (s: string | null | undefined) => (s ? s : null);

const TABEL = [
  "slip_fee", "laporan_fee", "kehadiran_event", "penugasan_event", "sesi_event", "event",
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
  for (const s of daftar("setgaji")) {
    await db.settingGaji.create({
      data: {
        kode: s.id, karyawanKode: s.karyawan_id, jabatanKode: s.jabatan_id, golonganKode: s.golongan_id, aktif: s.aktif !== false,
        tunjangan: { create: (s.tunjangan_ids ?? []).map((t: string) => ({ tunjanganKode: t })) },
      },
    });
  }

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

  await seedFeeEvent(idPeran);

  await db.logAktivitas.create({ data: { penggunaId: null, aksi: "seed", entitas: "sistem", entitasId: null, keterangan: "Data contoh Oktober 2026 dan fee event November 2026 dimuat." } });

  // ---------- Pemeriksaan ----------
  const ns = neracaSaldo(await muatJurnalBuku(db, "2026-10"), (await db.akun.findMany({ select: { kode: true } })).map((a) => a.kode), "2026-10");
  console.log(`Seed selesai. Neraca saldo s.d. Oktober 2026: debit ${ns.debit.toLocaleString("id-ID")}, kredit ${ns.kredit.toLocaleString("id-ID")}${ns.seimbang ? " (seimbang)" : " (TIDAK SEIMBANG)"}.`);
  console.log("Akun demo: " + [...PENGGUNA_DEMO, ...PENGGUNA_KAPTEN].map((p) => `${p.namaPengguna} / ${p.sandi}`).join(", "));
}

/*
 * Data contoh fee event (crew freelance), sesuai konsep app absen D'Production:
 * - EVT-2026-0001 Gathering Tahunan PT Sinar Abadi: 4 sesi, 1 kapten + 4 crew, semua crew sudah dinilai kapten
 *   (satu kehadiran KURANG), laporan FEE-2026-0001 sudah dikirim dan menunggu keputusan Owner.
 * - EVT-2026-0002 Wedding Expo Malang: 3 sesi, 1 kapten + 3 crew, kehadiran sudah dicatat HRD dan menunggu penilaian kapten2.
 * Tidak ada jurnal yang dibuat di sini; jurnal fee baru dibuat saat Owner menyetujui laporan.
 */
async function seedFeeEvent(idPeran: Record<string, number>) {
  const hrd = idPeran.hrd;
  await db.akun.upsert({ where: { kode: "6-230" }, create: { kode: "6-230", nama: "Biaya Fee Crew Event (Freelance)", tipe: "BEBAN", saldoNormal: "D" }, update: {} });
  await db.jabatan.createMany({
    data: [
      { kode: "JBT-05", nama: "Kapten Event", akunBebanKode: "6-230", kelompok: "EVENT", peranEvent: "KAPTEN", satuanTarif: "HARI", tarif: 200_000 },
      { kode: "JBT-06", nama: "Crew Event", akunBebanKode: "6-230", kelompok: "EVENT", peranEvent: "CREW", satuanTarif: "JAM", tarif: 20_000 },
    ],
  });
  const crew: [string, string, StatusPtkp, string, string][] = [
    ["KRY-06", "Bima Satria", "K1", "BCA", "7710223344"],
    ["KRY-07", "Sari Wulandari", "TK0", "BRI", "005601112233"],
    ["KRY-08", "Rizky Pratama", "TK0", "Mandiri", "1440009876543"],
    ["KRY-09", "Yoga Firmansyah", "TK0", "BNI", "0456789123"],
    ["KRY-10", "Dewi Lestari", "TK0", "BCA", "7715566778"],
    ["KRY-11", "Arif Hidayat", "K0", "BSI", "7123456789"],
    ["KRY-12", "Fajar Nugroho", "TK0", "BRI", "005609998877"],
  ];
  await db.karyawan.createMany({ data: crew.map(([kode, nama, statusPtkp, bank, noRek]) => ({ kode, nama, statusPtkp, bank, noRek, jenis: "EVENT" as const })) });
  for (const k of PENGGUNA_KAPTEN) {
    const u = await db.pengguna.create({ data: { namaPengguna: k.namaPengguna, nama: k.nama, peran: "KAPTEN", karyawanKode: k.karyawanKode, kataSandiHash: await hashKataSandi(k.sandi) } });
    idPeran[k.namaPengguna] = u.id;
  }

  type Hadir = [karyawan: string, masuk: string, pulang: string, progres: string, nilai?: { kurang?: { jam: number; catatan: string }; catatan?: string }];
  async function buatEvent(e: { kode: string; nama: string; klien: string; mulai: string; selesai: string; kapten: string; crew: string[]; sesi: { nama: string; tanggal: string; mulai: string; selesai: string; hadir: Hadir[] }[]; penilai: number | null }) {
    await db.event.create({ data: { kode: e.kode, nama: e.nama, klien: e.klien, tanggalMulai: keDate(e.mulai), tanggalSelesai: keDate(e.selesai), dibuatOlehId: hrd } });
    await db.penugasanEvent.createMany({ data: [{ eventKode: e.kode, karyawanKode: e.kapten, jabatanKode: "JBT-05" }, ...e.crew.map((k) => ({ eventKode: e.kode, karyawanKode: k, jabatanKode: "JBT-06" }))] });
    for (const s of e.sesi) {
      const sesi = await db.sesiEvent.create({ data: { eventKode: e.kode, nama: s.nama, tanggal: keDate(s.tanggal), jamMulai: s.mulai, jamSelesai: s.selesai } });
      for (const [karyawanKode, jamMasuk, jamPulang, catatanProgres, nilai] of s.hadir) {
        // Kehadiran kapten tidak dinilai kapten (dinilai Owner); crew dinilai kapten bila event sudah dinilai.
        const dinilai = e.penilai && karyawanKode !== e.kapten;
        await db.kehadiranEvent.create({
          data: {
            sesiId: sesi.id, karyawanKode, jamMasuk, jamPulang, catatanProgres, dibuatOlehId: hrd,
            ...(dinilai
              ? { penilaian: nilai?.kurang ? "KURANG" : "SESUAI", menitDiakui: nilai?.kurang ? nilai.kurang.jam * 60 : null, catatanNilai: nilai?.kurang?.catatan ?? nilai?.catatan ?? null, dinilaiOlehId: e.penilai, dinilaiPada: new Date(`${e.selesai}T16:00:00Z`) }
              : {}),
          },
        });
      }
    }
  }

  await buatEvent({
    kode: "EVT-2026-0001", nama: "Gathering Tahunan PT Sinar Abadi", klien: "PT Sinar Abadi", mulai: "2026-11-10", selesai: "2026-11-14", kapten: "KRY-06",
    crew: ["KRY-08", "KRY-09", "KRY-10", "KRY-11"], penilai: idPeran.kapten,
    sesi: [
      { nama: "Meeting", tanggal: "2026-11-10", mulai: "19:00", selesai: "21:00", hadir: [
        ["KRY-06", "19:00", "21:00", "Memimpin rapat teknis dengan klien dan vendor"],
        ["KRY-08", "19:00", "21:00", "Mencatat kebutuhan rigging dan daftar alat"],
      ] },
      { nama: "Loading in", tanggal: "2026-11-13", mulai: "13:00", selesai: "21:00", hadir: [
        ["KRY-06", "12:45", "21:00", "Mengatur urutan bongkar muat dan pembagian tugas"],
        ["KRY-08", "13:00", "21:00", "Pasang truss panggung utama"],
        ["KRY-09", "13:30", "21:00", "Tarik kabel power dan sound"],
        ["KRY-11", "13:00", "21:00", "Pasang lighting dan cek DMX"],
      ] },
      { nama: "Hari H", tanggal: "2026-11-14", mulai: "07:00", selesai: "16:00", hadir: [
        ["KRY-06", "06:45", "16:00", "Koordinasi rundown dengan event manager"],
        ["KRY-08", "07:00", "16:00", "Stage crew, ganti set tiap sesi"],
        ["KRY-09", "07:00", "16:00", "Operator mic wireless"],
        ["KRY-10", "07:00", "16:00", "Registrasi tamu dan runner"],
        ["KRY-11", "07:15", "16:00", "Operator lighting"],
      ] },
      { nama: "Loading out", tanggal: "2026-11-14", mulai: "16:00", selesai: "22:00", hadir: [
        ["KRY-06", "16:00", "22:15", "Cek kelengkapan alat sebelum masuk truk"],
        ["KRY-08", "16:00", "22:00", "Bongkar truss"],
        ["KRY-09", "16:00", "22:00", "Gulung kabel", { kurang: { jam: 4, catatan: "Meninggalkan area pukul 20.00 tanpa izin, gulung kabel dilanjutkan crew lain." } }],
        ["KRY-10", "16:00", "22:00", "Packing properti dekorasi"],
        ["KRY-11", "16:00", "21:30", "Bongkar lighting dan packing"],
      ] },
    ],
  });
  await buatEvent({
    kode: "EVT-2026-0002", nama: "Wedding Expo Malang 2026", klien: "Asosiasi Wedding Organizer Malang", mulai: "2026-11-20", selesai: "2026-11-21", kapten: "KRY-07",
    crew: ["KRY-09", "KRY-10", "KRY-12"], penilai: null,
    sesi: [
      { nama: "Loading in", tanggal: "2026-11-20", mulai: "14:00", selesai: "22:00", hadir: [
        ["KRY-07", "14:00", "22:00", "Briefing crew dan cek layout booth"],
        ["KRY-09", "14:00", "22:00", "Pasang backdrop panggung"],
        ["KRY-12", "14:30", "22:00", "Tarik kabel dan pasang speaker"],
      ] },
      { nama: "Hari H", tanggal: "2026-11-21", mulai: "08:00", selesai: "17:00", hadir: [
        ["KRY-07", "07:45", "17:00", "Koordinasi panggung fashion show"],
        ["KRY-09", "08:00", "17:00", "Stage crew"],
        ["KRY-10", "08:00", "17:00", "Usher dan registrasi"],
        ["KRY-12", "08:10", "15:00", "Operator sound, pulang lebih awal"],
      ] },
      { nama: "Loading out", tanggal: "2026-11-21", mulai: "17:00", selesai: "23:00", hadir: [
        ["KRY-07", "17:00", "23:00", "Cek alat kembali lengkap"],
        ["KRY-09", "17:00", "23:00", "Bongkar backdrop"],
        ["KRY-10", "17:00", "21:00", "Packing properti"],
      ] },
    ],
  });

  // Laporan kapten untuk event pertama: totalnya dihitung dengan rumus yang sama dengan aplikasi.
  const b = await muatBahanEvent(db, "EVT-2026-0001");
  await db.event.update({ where: { kode: "EVT-2026-0001" }, data: { status: "DIAJUKAN" } });
  await db.laporanFee.create({
    data: {
      no: "FEE-2026-0001", eventKode: "EVT-2026-0001", status: "DIAJUKAN", totalUsulan: b!.totalUsulan, diajukanOlehId: idPeran.kapten,
      diajukanPada: new Date("2026-11-15T02:00:00Z"), catatanKapten: "Semua sesi berjalan lancar. Yoga meninggalkan loading out lebih awal, sudah saya tegur.",
    },
  });
  for (const [kunci, nilai] of [["KRY", 12], ["JBT", 6], ["EVT2026", 2], ["FEE2026", 1]] as const) {
    await db.penghitung.upsert({ where: { kunci }, create: { kunci, nilai }, update: { nilai } });
  }
  console.log(`Fee event contoh: EVT-2026-0001 (laporan FEE-2026-0001 menunggu Owner, usulan ${b!.totalUsulan.toLocaleString("id-ID")}), EVT-2026-0002 (menunggu penilaian kapten2).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
