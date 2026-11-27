/*
 * Definisi data master dan skema validasinya (zod). Aman diimpor komponen klien.
 * Satu definisi dipakai tiga tempat: form (isian apa saja), server action (validasi), dan daftar (label).
 * Aturan sama dengan MDEF di versi-statis/assets/js/views/master.js.
 */
import { z } from "./zod";
import type { KunciIzin } from "@/lib/peran";
import type { JenisNominal } from "@/lib/inti/nominal";

export const JENIS_MASTER = ["supplier", "peralatan", "perlengkapan", "kategori", "akun", "karyawan", "jabatan", "jabatanEvent", "golongan", "tunjangan", "jadwal", "setgaji"] as const;
export type JenisMaster = (typeof JENIS_MASTER)[number];
export type KelompokMaster = "konversi" | "sdm";

export type TipeIsian = "teks" | "email" | "angka" | "waktu" | "pilih" | "banyak";

export type DefIsian = {
  kunci: string;
  label: string;
  tipe: TipeIsian;
  wajib?: boolean;
  /** Kunci sumber pilihan: statis (lihat OPSI_STATIS) atau dinamis (dikirim server lewat OpsiMaster). */
  sumber?: string;
  min?: number;
  maks?: number;
  petunjuk?: string;
  /** Tidak bisa diubah sesudah data dibuat. */
  tetap?: boolean;
  /** Nilai awal di form data baru. */
  bawaan?: string;
  /**
   * Isian nominal yang berversi (gaji pokok, tunjangan, tunjangan jabatan, tarif event). Hanya diisi saat data baru
   * (menjadi pengajuan nominal awal dengan bulan berlaku); sesudahnya diubah lewat "Ajukan perubahan nominal".
   */
  nominal?: boolean;
};

export type DefMaster = {
  jenis: JenisMaster;
  label: string;
  kelompok: KelompokMaster;
  izin: KunciIzin;
  /** Awalan kode otomatis; kosong bila kode diketik pengguna (akun). */
  isian: DefIsian[];
  petunjuk?: string;
};

export type OpsiPilihan = { nilai: string; label: string; nonaktif?: boolean };
export type OpsiMaster = Record<string, OpsiPilihan[]>;

export const OPSI_STATIS: OpsiMaster = {
  tipe: [
    { nilai: "ASET", label: "Aset" }, { nilai: "KONTRA_ASET", label: "Kontra aset" }, { nilai: "LIABILITAS", label: "Liabilitas" },
    { nilai: "EKUITAS", label: "Ekuitas" }, { nilai: "PENDAPATAN", label: "Pendapatan" }, { nilai: "BEBAN", label: "Beban" },
  ],
  saldoNormal: [{ nilai: "D", label: "Debit" }, { nilai: "K", label: "Kredit" }],
  ptkp: ["TK0", "TK1", "TK2", "TK3", "K0", "K1", "K2", "K3"].map((k) => ({ nilai: k, label: k.replace(/^(TK|K)(\d)$/, "$1/$2") })),
  bank: ["BCA", "Mandiri", "BRI", "BNI", "BSI"].map((b) => ({ nilai: b, label: b })),
  jenisKaryawan: [{ nilai: "INHOUSE", label: "Inhouse (gaji bulanan)" }, { nilai: "EVENT", label: "Event (fee per event)" }],
  peranEvent: [{ nilai: "KAPTEN", label: "Kapten (menilai crew, dinilai Owner)" }, { nilai: "CREW", label: "Crew (dinilai kapten)" }],
  satuanTarif: [{ nilai: "HARI", label: "Per hari (jumlah tanggal hadir)" }, { nilai: "JAM", label: "Per jam (jam yang diakui)" }],
};

export const DEF_MASTER: Record<JenisMaster, DefMaster> = {
  supplier: {
    jenis: "supplier", label: "Supplier", kelompok: "konversi", izin: "master-konversi.ubah",
    isian: [
      { kunci: "nama", label: "Nama supplier", tipe: "teks", wajib: true },
      { kunci: "alamat", label: "Alamat", tipe: "teks" },
      { kunci: "telepon", label: "Telepon", tipe: "teks" },
      { kunci: "email", label: "Email", tipe: "email" },
      { kunci: "npwp", label: "NPWP", tipe: "teks", petunjuk: "Kosongkan bila tidak ada. Tidak boleh sama dengan supplier lain." },
    ],
  },
  peralatan: {
    jenis: "peralatan", label: "Peralatan", kelompok: "konversi", izin: "master-konversi.ubah",
    isian: [
      { kunci: "nama", label: "Nama peralatan", tipe: "teks", wajib: true },
      { kunci: "satuan", label: "Satuan", tipe: "teks", wajib: true },
      { kunci: "kategoriKode", label: "Kategori aset", tipe: "pilih", sumber: "kategori", wajib: true },
    ],
  },
  perlengkapan: {
    jenis: "perlengkapan", label: "Perlengkapan", kelompok: "konversi", izin: "master-konversi.ubah",
    isian: [
      { kunci: "nama", label: "Nama perlengkapan", tipe: "teks", wajib: true },
      { kunci: "satuan", label: "Satuan", tipe: "teks", wajib: true },
    ],
  },
  kategori: {
    jenis: "kategori", label: "Kategori aset", kelompok: "konversi", izin: "master.akun-kategori",
    petunjuk: "Kategori dan bagan akun dikelola Owner, dan dipakai bersama oleh siklus konversi dan SDM.",
    isian: [
      { kunci: "nama", label: "Nama kategori", tipe: "teks", wajib: true },
      { kunci: "masaManfaatBulan", label: "Masa manfaat (bulan)", tipe: "angka", wajib: true, maks: 600 },
      { kunci: "persenResidu", label: "Residu (%)", tipe: "angka", maks: 99, petunjuk: "0 sampai 99." },
      { kunci: "akunAsetKode", label: "Akun aset", tipe: "pilih", sumber: "akun", wajib: true },
      { kunci: "akunAkumulasiKode", label: "Akun akumulasi", tipe: "pilih", sumber: "akun", wajib: true },
      { kunci: "akunBebanKode", label: "Akun biaya", tipe: "pilih", sumber: "akun", wajib: true },
    ],
  },
  akun: {
    jenis: "akun", label: "Bagan akun", kelompok: "konversi", izin: "master.akun-kategori",
    petunjuk: "Kode akun tidak bisa diubah sesudah dibuat. Tipe dan saldo normal hanya bisa diubah selama akun belum dipakai di jurnal.",
    isian: [
      { kunci: "kode", label: "Kode akun", tipe: "teks", wajib: true, tetap: true, petunjuk: "Huruf, angka, titik, dan tanda minus, contoh 1-110." },
      { kunci: "nama", label: "Nama akun", tipe: "teks", wajib: true },
      { kunci: "tipe", label: "Tipe", tipe: "pilih", sumber: "tipe", wajib: true },
      { kunci: "saldoNormal", label: "Saldo normal", tipe: "pilih", sumber: "saldoNormal", wajib: true },
    ],
  },
  karyawan: {
    jenis: "karyawan", label: "Karyawan", kelompok: "sdm", izin: "master-sdm.ubah",
    isian: [
      { kunci: "nama", label: "Nama", tipe: "teks", wajib: true },
      { kunci: "statusPtkp", label: "Status PTKP", tipe: "pilih", sumber: "ptkp", wajib: true },
      { kunci: "bank", label: "Bank", tipe: "pilih", sumber: "bank", wajib: true },
      { kunci: "noRek", label: "No. rekening", tipe: "teks", wajib: true },
      {
        kunci: "jenis", label: "Jenis karyawan", tipe: "pilih", sumber: "jenisKaryawan", bawaan: "INHOUSE",
        petunjuk: "Inhouse digaji bulanan lewat Hitung Gaji. Event (crew freelance) dibayar fee per event, tanpa setting gaji.",
      },
    ],
  },
  jabatan: {
    jenis: "jabatan", label: "Jabatan", kelompok: "sdm", izin: "struktur-gaji.ubah",
    isian: [
      { kunci: "nama", label: "Nama jabatan", tipe: "teks", wajib: true },
      { kunci: "tunjJabatan", label: "Tunjangan jabatan (Rp)", tipe: "angka", nominal: true },
      { kunci: "tunjKeluarga", label: "Tunj. istri/anak (Rp)", tipe: "angka", petunjuk: "Hanya untuk karyawan berstatus PTKP K/*.", nominal: true },
      { kunci: "akunBebanKode", label: "Akun biaya gaji", tipe: "pilih", sumber: "akun", wajib: true },
    ],
  },
  jabatanEvent: {
    jenis: "jabatanEvent", label: "Jabatan event", kelompok: "sdm", izin: "struktur-gaji.ubah",
    petunjuk: "Jabatan event (Kapten, Crew) dan tarifnya diurus HRD. Tarif punya riwayat: perubahan diajukan HRD dengan bulan berlaku lalu disetujui Owner, dan fee event memakai tarif yang berlaku di bulan tanggal selesai event.",
    isian: [
      { kunci: "nama", label: "Nama jabatan", tipe: "teks", wajib: true },
      { kunci: "peranEvent", label: "Peran di event", tipe: "pilih", sumber: "peranEvent", wajib: true },
      { kunci: "satuanTarif", label: "Satuan tarif", tipe: "pilih", sumber: "satuanTarif", wajib: true, petunjuk: "Tidak bisa diubah sesudah jabatan dipakai di penugasan event." },
      { kunci: "tarif", label: "Tarif (Rp)", tipe: "angka", wajib: true, maks: 100_000_000, petunjuk: "Bawaan: Kapten Rp200.000 per hari, Crew Rp20.000 per jam (Rp160.000 untuk 8 jam).", nominal: true },
      { kunci: "akunBebanKode", label: "Akun biaya fee", tipe: "pilih", sumber: "akun", wajib: true, bawaan: "6-230" },
    ],
  },
  golongan: {
    jenis: "golongan", label: "Gaji pokok", kelompok: "sdm", izin: "struktur-gaji.ubah",
    isian: [
      { kunci: "nama", label: "Golongan", tipe: "teks", wajib: true },
      { kunci: "jumlah", label: "Gaji pokok (Rp)", tipe: "angka", wajib: true, nominal: true },
    ],
  },
  tunjangan: {
    jenis: "tunjangan", label: "Tunjangan", kelompok: "sdm", izin: "struktur-gaji.ubah",
    isian: [
      { kunci: "nama", label: "Nama tunjangan", tipe: "teks", wajib: true },
      { kunci: "nominal", label: "Nominal per bulan (Rp)", tipe: "angka", wajib: true, nominal: true },
    ],
  },
  jadwal: {
    jenis: "jadwal", label: "Jadwal kerja", kelompok: "sdm", izin: "master-sdm.ubah",
    isian: [
      { kunci: "jabatanKode", label: "Jabatan", tipe: "pilih", sumber: "jabatan", wajib: true },
      { kunci: "jamMasuk", label: "Jam masuk", tipe: "waktu", wajib: true },
      { kunci: "jamKeluar", label: "Jam keluar", tipe: "waktu", wajib: true },
      { kunci: "hariKerja", label: "Hari kerja per bulan", tipe: "angka", wajib: true, maks: 31 },
    ],
  },
  setgaji: {
    jenis: "setgaji", label: "Setting gaji", kelompok: "sdm", izin: "setting-gaji.ajukan",
    petunjuk: "Setting gaji tidak pernah ditimpa. Setiap setting awal, promosi, demosi, atau penyesuaian diajukan HRD dengan bulan berlaku, lalu disetujui atau ditolak Owner. Riwayatnya tersimpan per karyawan.",
    isian: [
      { kunci: "karyawanKode", label: "Karyawan", tipe: "pilih", sumber: "karyawan", wajib: true },
      { kunci: "jabatanKode", label: "Jabatan", tipe: "pilih", sumber: "jabatan", wajib: true },
      { kunci: "golonganKode", label: "Gaji pokok", tipe: "pilih", sumber: "golongan", wajib: true },
      { kunci: "tunjanganKodes", label: "Tunjangan", tipe: "banyak", sumber: "tunjangan" },
    ],
  },
};

export const DAFTAR_KELOMPOK: Record<KelompokMaster, JenisMaster[]> = {
  konversi: JENIS_MASTER.filter((j) => DEF_MASTER[j].kelompok === "konversi"),
  sdm: JENIS_MASTER.filter((j) => DEF_MASTER[j].kelompok === "sdm"),
};

/**
 * Empat master yang membentuk gaji dan fee. Di Master SDM keempatnya tampil bersama di tab Struktur gaji, tetapi
 * tabelnya tetap terpisah (dipakai relasi slip, setting gaji, dan penugasan event). Keempatnya ditambah dan diubah HRD
 * (struktur-gaji.ubah).
 */
export const JENIS_STRUKTUR = ["jabatan", "jabatanEvent", "golongan", "tunjangan"] as const satisfies readonly JenisMaster[];
export type JenisStruktur = (typeof JENIS_STRUKTUR)[number];
export const termasukStruktur = (j: string): j is JenisStruktur => (JENIS_STRUKTUR as readonly string[]).includes(j);

/** Jenis nominal berversi untuk tiap master struktur gaji (tabel versi_nominal). */
export const NOMINAL_STRUKTUR: Record<JenisStruktur, JenisNominal> = { jabatan: "JABATAN", jabatanEvent: "JABATAN_EVENT", golongan: "GOLONGAN", tunjangan: "TUNJANGAN" };
export const JENIS_STRUKTUR_DARI_NOMINAL: Record<JenisNominal, JenisStruktur> = { JABATAN: "jabatan", JABATAN_EVENT: "jabatanEvent", GOLONGAN: "golongan", TUNJANGAN: "tunjangan" };

/** Isian yang tampil di form: data baru memuat isian nominal, ubah data tidak (nominal diubah lewat pengajuan). */
export const isianForm = (def: DefMaster, baru: boolean) => def.isian.filter((d) => baru || !d.nominal);
/** true bila master ini punya nominal berversi (form data baru meminta bulan dan tahun berlaku). */
export const punyaNominal = (def: DefMaster) => def.isian.some((d) => d.nominal);

/** Tab Master SDM, urut tampil. Tautan lama ?tab=jabatan, jabatanEvent, golongan, tunjangan dialihkan ke tab struktur. */
export const TAB_SDM = [
  { tab: "karyawan", label: "Karyawan" },
  { tab: "struktur", label: "Struktur gaji" },
  { tab: "jadwal", label: "Jadwal kerja" },
  { tab: "setgaji", label: "Setting gaji" },
] as const;
export type TabSdm = (typeof TAB_SDM)[number]["tab"];

const MAKS_RUPIAH = 2_000_000_000;
const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;
const POLA_KODE_AKUN = /^[0-9A-Za-z.\-]{1,20}$/;

function skemaIsian(d: DefIsian): z.ZodType {
  switch (d.tipe) {
    case "angka": {
      const min = d.wajib ? 1 : (d.min ?? 0);
      const angka = z.coerce
        .number({ error: `${d.label} harus berupa angka.` })
        .int(`${d.label} harus bilangan bulat.`)
        .min(min, d.wajib ? `${d.label} wajib diisi dan lebih dari 0.` : `${d.label} tidak boleh kurang dari ${min}.`)
        .max(d.maks ?? MAKS_RUPIAH, `${d.label} terlalu besar (maksimal ${(d.maks ?? MAKS_RUPIAH).toLocaleString("id-ID")}).`);
      // Isian angka opsional yang tidak disentuh form tidak terkirim sama sekali; dianggap 0, bukan NaN.
      return d.wajib ? angka : z.preprocess((v) => (v === undefined || v === null ? 0 : v), angka);
    }
    // Form yang dikirim kosong tidak mengirim isian sama sekali (undefined), jadi pesan tipe juga ditulis per isian.
    case "waktu":
      return z.string({ error: `${d.label} wajib diisi.` }).trim().min(1, `${d.label} wajib diisi.`).regex(POLA_JAM, `${d.label} berbentuk HH:MM.`);
    case "banyak":
      return z.array(z.string({ error: `${d.label} tidak valid.` }), { error: `${d.label} tidak valid.` }).default([]);
    case "email":
      return z.string({ error: `${d.label} tidak valid.` }).trim().max(120, `${d.label} maksimal 120 karakter.`).refine((v) => v === "" || z.email().safeParse(v).success, `${d.label} tidak valid.`).default("");
    case "pilih": {
      const pesan = `Pilih ${d.label.toLowerCase()}.`;
      return d.wajib ? z.string({ error: pesan }).trim().min(1, pesan) : z.string({ error: pesan }).trim().default("");
    }
    default: {
      const s = z.string({ error: d.wajib ? `${d.label} wajib diisi.` : `${d.label} tidak valid.` }).trim().max(200, `${d.label} maksimal 200 karakter.`);
      return d.wajib ? s.min(1, `${d.label} wajib diisi.`) : s.default("");
    }
  }
}

const skemaBulanBerlaku = z.coerce.number({ error: "Pilih bulan berlaku." }).int("Pilih bulan berlaku.").min(1, "Pilih bulan berlaku.").max(12, "Pilih bulan berlaku.");
const skemaTahunBerlaku = z.coerce.number({ error: "Pilih tahun berlaku." }).int("Pilih tahun berlaku.").min(2000, "Pilih tahun berlaku.").max(2999, "Pilih tahun berlaku.");

/**
 * Skema isi satu jenis master, lengkap dengan aturan lintas isian (sama dengan validate/mSave di app lama).
 * Ubah data (baru = false) tidak memuat isian nominal. Data baru bernominal memuat bulan dan tahun berlaku nominal awalnya.
 */
export function skemaIsiMaster(jenis: JenisMaster, opsi: { baru?: boolean } = { baru: true }) {
  const def = DEF_MASTER[jenis];
  const baru = opsi.baru ?? true;
  const bentuk: Record<string, z.ZodType> = Object.fromEntries(isianForm(def, baru).map((d) => [d.kunci, skemaIsian(d)]));
  if (baru && punyaNominal(def)) {
    bentuk.bulan = skemaBulanBerlaku;
    bentuk.tahun = skemaTahunBerlaku;
  }
  return z.object(bentuk).superRefine((v, ctx) => {
    const x = v as Record<string, unknown>;
    const galat = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    for (const d of isianForm(def, baru)) {
      const statis = d.sumber ? OPSI_STATIS[d.sumber] : undefined;
      if (statis && x[d.kunci] && !statis.some((o) => o.nilai === x[d.kunci])) galat(d.kunci, `${d.label} tidak valid.`);
    }
    if (jenis === "akun" && !POLA_KODE_AKUN.test(String(x.kode))) galat("kode", "Kode akun hanya boleh huruf, angka, titik, dan tanda minus.");
    if (jenis === "jadwal" && POLA_JAM.test(String(x.jamMasuk)) && POLA_JAM.test(String(x.jamKeluar)) && String(x.jamKeluar) <= String(x.jamMasuk)) {
      galat("jamKeluar", "Jam keluar harus setelah jam masuk.");
    }
  });
}

export const skemaSimpanMaster = z.object({
  jenis: z.enum(JENIS_MASTER, { error: "Jenis master tidak dikenal." }),
  /** Kode data yang diubah; kosong untuk data baru. */
  kode: z.string({ error: "Kode data tidak valid." }).trim().optional().nullable(),
  nilai: z.record(z.string(), z.unknown(), { error: "Isian form tidak terkirim. Muat ulang halaman lalu coba lagi." }),
});

export const skemaStatusMaster = z.object({
  jenis: z.enum(JENIS_MASTER, { error: "Jenis master tidak dikenal." }),
  kode: z.string({ error: "Kode kosong." }).trim().min(1, "Kode kosong."),
  aktif: z.boolean({ error: "Status aktif tidak valid." }),
});

export const skemaProfil = z.object({
  nama: z.string({ error: "Nama usaha wajib diisi." }).trim().min(1, "Nama usaha wajib diisi.").max(80, "Nama usaha maksimal 80 karakter."),
  keterangan: z.string({ error: "Keterangan tidak valid." }).trim().max(120, "Keterangan maksimal 120 karakter.").default(""),
});
