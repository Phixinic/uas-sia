/*
 * Data contoh fee event, dipakai seed.ts (database kosong) dan tambah-contoh-fee-event.ts (database yang sudah berisi).
 */
import { AKUN_GAJI_BULANAN } from "../src/lib/inti/akun";
import type { StatusPtkp } from "../src/generated/prisma/enums";
import { hashKataSandi } from "../src/lib/server/kata-sandi";
import type { DbAtauTx } from "../src/lib/server/db";
import { keDate } from "../src/lib/inti/tanggal";
import { muatBahanEvent } from "../src/lib/data/fee-event/bahan";
import { versiAwalSeed } from "../src/lib/server/nominal";
import { TARIF_BAWAAN } from "../src/lib/inti/fee-event";

/** Akun kapten contoh (crew freelance). Ditautkan ke karyawan event di seedFeeEvent. */
export const PENGGUNA_KAPTEN: { namaPengguna: string; nama: string; karyawanKode: string; sandi: string }[] = [
  { namaPengguna: "kapten", nama: "Bima Satria", karyawanKode: "KRY-06", sandi: "kapten123" },
  { namaPengguna: "kapten2", nama: "Sari Wulandari", karyawanKode: "KRY-07", sandi: "kapten123" },
];

/*
 * Data contoh fee event (crew freelance), sesuai konsep app absen D'Production:
 * - EVT-2026-0001 Gathering Tahunan PT Sinar Abadi: 4 sesi, 1 kapten + 4 crew, semua crew sudah dinilai kapten
 *   (satu kehadiran KURANG), laporan FEE-2026-0001 sudah dikirim dan menunggu keputusan Owner.
 * - EVT-2026-0002 Wedding Expo Malang: 3 sesi, 1 kapten + 3 crew, kehadiran sudah dicatat HRD dan menunggu penilaian kapten2.
 * Tidak ada jurnal yang dibuat di sini; jurnal fee baru dibuat saat Owner menyetujui laporan.
 */
export async function seedFeeEvent(db: DbAtauTx, idPeran: Record<string, number>, sandiKapten: Record<string, string> = {}) {
  const hrd = idPeran.hrd;
  await db.akun.upsert({ where: { kode: "6-230" }, create: { kode: "6-230", nama: "Biaya Fee Crew Event (Freelance)", tipe: "BEBAN", saldoNormal: "D" }, update: {} });
  // Akun Gaji Bulanan (sama dengan migrasi 20261125120000_upah_event_inhouse).
  for (const a of AKUN_GAJI_BULANAN) await db.akun.upsert({ where: { kode: a.kode }, create: a, update: {} });
  await db.jabatan.createMany({
    data: [
      { kode: "JBT-05", nama: "Kapten Event", akunBebanKode: "6-230", kelompok: "EVENT", peranEvent: "KAPTEN", satuanTarif: "HARI" },
      { kode: "JBT-06", nama: "Crew Event", akunBebanKode: "6-230", kelompok: "EVENT", peranEvent: "CREW", satuanTarif: "JAM" },
    ],
    skipDuplicates: true,
  });
  // Tarif = versi nominal awal DISETUJUI berlaku Oktober 2026 (sama dengan migrasi riwayat nominal).
  await db.periode.createMany({ data: [{ id: "2026-10" }], skipDuplicates: true });
  for (const [itemKode, nominal] of [["JBT-05", TARIF_BAWAAN.KAPTEN_PER_HARI], ["JBT-06", TARIF_BAWAAN.CREW_PER_JAM]] as const) {
    if (await db.versiNominal.count({ where: { jenis: "JABATAN_EVENT", jabatanKode: itemKode } })) continue;
    await versiAwalSeed(db, {
      jenis: "JABATAN_EVENT", itemKode, nominal, tunjJabatan: 0, tunjKeluarga: 0, berlaku: "2026-10", alasan: "Tarif awal data contoh fee event.",
      olehId: idPeran.owner ?? null, pada: new Date("2026-10-01T01:00:00Z"),
    });
  }
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
    const u = await db.pengguna.create({ data: { namaPengguna: k.namaPengguna, nama: k.nama, peran: "KAPTEN", karyawanKode: k.karyawanKode, kataSandiHash: await hashKataSandi(sandiKapten[k.namaPengguna] ?? k.sandi) } });
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
