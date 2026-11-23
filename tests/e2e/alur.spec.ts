/*
 * Uji E2E menyeluruh SIA D'Production: satu periode November 2026 dari pembelian sampai tutup periode.
 * Skenario berurutan (serial) dan saling bergantung, jadi dijalankan di database uji yang baru di-seed
 * (lihat tests/e2e/jalankan.mjs). Tiga sesi login hidup berdampingan: Admin, HRD, Owner.
 * Screenshot tiap halaman utama per peran disimpan di /tmp/sia-e2e/<peran>/.
 */
import fs from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? 3200}`;
const KELUARAN = "/tmp/sia-e2e";

type Sesi = { ctx: BrowserContext; page: Page };
const sesi: Record<"admin" | "hrd" | "owner", Sesi> = {} as never;
const galatKonsol: string[] = [];
const temuan: string[] = [];

/** Angka kunci yang dicatat selama uji (dicetak di akhir). */
const angkaKunci: Record<string, string | number> = {};

const angkaDari = (t: string) => Number(t.replace(/[^\d]/g, ""));

async function bukaSesi(browser: Browser, nama: string, sandi: string, peran: string, viewport = { width: 1366, height: 900 }): Promise<Sesi> {
  const ctx = await browser.newContext({ baseURL: BASE, locale: "id-ID", timezoneId: "Asia/Jakarta", viewport });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => galatKonsol.push(`[${peran}] pageerror ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource.*(401|404)/.test(m.text())) galatKonsol.push(`[${peran}] ${page.url()} ${m.text().slice(0, 200)}`);
  });
  await page.goto("/masuk");
  await page.getByLabel("Nama pengguna").fill(nama);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/masuk"));
  return { ctx, page };
}

/** Menekan tombol kirim di dialog konfirmasi (dengan alasan bila diminta), lalu menunggu dialog tertutup. */
async function konfirmasi(p: Page, alasan?: string) {
  const d = p.getByRole("dialog");
  await expect(d).toBeVisible();
  if (alasan) await d.getByLabel(/Alasan/).fill(alasan);
  await d.locator('button[type="submit"]').click();
  await expect(d).toBeHidden();
}

/** Memilih opsi <select> berdasarkan sebagian teksnya (nilai opsinya kode yang dibuat otomatis). */
async function pilihTeks(f: Locator, label: string, teks: string) {
  const nilai = await f.getByLabel(label).locator("option", { hasText: teks }).first().getAttribute("value");
  expect(nilai, `opsi "${teks}" di ${label}`).toBeTruthy();
  await f.getByLabel(label).selectOption(nilai as string);
}

const baris = (p: Page, teks: string | RegExp) => p.locator("tr", { hasText: teks });
const kartu = (p: Page, teks: string | RegExp) => p.locator(".kartu", { hasText: teks });
/** Sidebar mengelompokkan menu; grup yang belum aktif tertutup, jadi dibuka dulu sebelum tautannya dicari. */
async function tautanMenu(p: Page, grup: string, label: string) {
  const tombol = p.getByRole("navigation", { name: "Menu utama" }).getByRole("button", { name: new RegExp(`^${grup}`) });
  if ((await tombol.first().getAttribute("aria-expanded")) === "false") await tombol.first().click();
  return p.getByRole("navigation", { name: "Menu utama" }).getByRole("link", { name: new RegExp(`^${label}( \\d+ tertunda)?$`) });
}
const tunggu = (p: Page) => p.waitForLoadState("networkidle");

async function bukaHalaman(p: Page, alamat: string) {
  await p.goto(alamat);
  await expect(p.locator("main h1").first()).toBeVisible();
  await tunggu(p);
}

/** Memeriksa halaman tidak melebar melewati layar (overflow horizontal). */
async function cekLuapan(p: Page, label: string) {
  const luap = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (luap > 1) temuan.push(`${label}: halaman melebar ${luap}px melewati layar`);
}

async function foto(p: Page, peran: string, nama: string) {
  fs.mkdirSync(`${KELUARAN}/${peran}`, { recursive: true });
  await p.screenshot({ path: `${KELUARAN}/${peran}/${nama}.png`, fullPage: true });
  await cekLuapan(p, `${peran}/${nama}`);
}

const slug = (a: string) => (a === "/" ? "dashboard" : a.replace(/^\//, "").replace(/[/?=&]/g, "-"));

const HALAMAN_UTAMA = [
  "/",
  "/konversi/pembelian-peralatan",
  "/konversi/pembelian-perlengkapan",
  "/konversi/nilai-sisa",
  "/konversi/penyusutan",
  "/konversi/kartu-aset",
  "/konversi/pelepasan",
  "/sdm/presensi",
  "/sdm/hitung-gaji",
  "/sdm/distribusi",
  "/pelaporan/jurnal-penyesuaian",
  "/pelaporan/jurnal-umum",
  "/pelaporan/buku-besar",
  "/pelaporan/neraca-saldo",
  "/pelaporan/tutup-periode",
  "/master/konversi",
  "/master/sdm",
];

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  fs.rmSync(KELUARAN, { recursive: true, force: true });
  fs.mkdirSync(KELUARAN, { recursive: true });
  sesi.admin = await bukaSesi(browser, "admin", "admin123", "admin");
  sesi.hrd = await bukaSesi(browser, "hrd", "hrd12345", "hrd");
  sesi.owner = await bukaSesi(browser, "owner", "owner123", "owner");
});

test.afterAll(async () => {
  for (const s of Object.values(sesi)) await s.ctx.close();
  console.log("\n=== ANGKA KUNCI ===\n" + JSON.stringify(angkaKunci, null, 2));
  if (temuan.length) console.log("\n=== TEMUAN TAMPILAN ===\n" + temuan.join("\n"));
  if (galatKonsol.length) console.log("\n=== GALAT KONSOL ===\n" + [...new Set(galatKonsol)].join("\n"));
});

/* ------------------------------------------------------------------ 1. Login dan izin per peran */

test("1a. Admin: menu dan tombol sesuai izin", async () => {
  const p = sesi.admin.page;
  await expect(await tautanMenu(p, "Siklus konversi", "Pembelian Peralatan")).toBeVisible();
  await expect(await tautanMenu(p, "Pengaturan", "Master Konversi")).toBeVisible();
  await expect(await tautanMenu(p, "Pengaturan", "Pengguna")).toHaveCount(0);
  await bukaHalaman(p, "/konversi/pembelian-peralatan");
  await expect(p.getByRole("link", { name: "Pembelian baru" })).toBeVisible();
  const r = baris(p, "BP-2026-0007");
  for (const t of ["Ubah", "Hapus", "Posting"]) await expect(r.getByRole("button", { name: t }).or(r.getByRole("link", { name: t }))).toBeVisible();
  await expect(r.getByRole("button", { name: "Balik" })).toHaveCount(0);
  await bukaHalaman(p, "/pengguna");
  await expect(p.getByText(/bukan untuk peran Admin/)).toBeVisible();
});

test("1b. HRD: menu, tombol, dan pembatasan halaman Owner", async () => {
  const p = sesi.hrd.page;
  await expect(await tautanMenu(p, "Siklus SDM", "Presensi")).toBeVisible();
  await expect(await tautanMenu(p, "Pengaturan", "Master SDM")).toBeVisible();
  await expect(await tautanMenu(p, "Pengaturan", "Pengguna")).toHaveCount(0);
  await bukaHalaman(p, "/konversi/pembelian-peralatan");
  await expect(p.getByRole("link", { name: "Pembelian baru" })).toHaveCount(0);
  await expect(p.getByRole("button", { name: "Posting" })).toHaveCount(0);
  await bukaHalaman(p, "/sdm/presensi");
  await expect(p.getByRole("link", { name: /Input presensi/ })).toBeVisible();
  await bukaHalaman(p, "/master/konversi?tab=supplier");
  await expect(p.getByRole("link", { name: "Supplier baru" })).toHaveCount(0);
  await bukaHalaman(p, "/pengguna");
  await expect(p.getByText(/bukan untuk peran HRD/)).toBeVisible();
  await bukaHalaman(p, "/pelaporan/tutup-periode");
  await expect(p.getByRole("button", { name: /Kunci periode/ })).toHaveCount(0);
});

test("1c. Owner: menu Pengguna ada, posting ada, ubah dan hapus draf tidak ada", async () => {
  const p = sesi.owner.page;
  await expect(await tautanMenu(p, "Pengaturan", "Pengguna")).toBeVisible();
  await bukaHalaman(p, "/konversi/pembelian-peralatan");
  const r = baris(p, "BP-2026-0007");
  await expect(r.getByRole("button", { name: "Posting" })).toBeVisible();
  await expect(r.getByRole("button", { name: "Hapus" })).toHaveCount(0);
  await expect(p.getByRole("link", { name: "Pembelian baru" })).toHaveCount(0);
  await bukaHalaman(p, "/sdm/presensi");
  await expect(p.getByRole("link", { name: /Input presensi/ })).toHaveCount(0);
  await bukaHalaman(p, "/pengguna");
  await expect(p.getByRole("heading", { name: "Pengguna", level: 1 })).toBeVisible();
});

test("1d. Halaman masuk: petunjuk akun demo tampil karena server uji memasang TAMPILKAN_AKUN_DEMO=1", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, locale: "id-ID", timezoneId: "Asia/Jakarta" });
  const p = await ctx.newPage();
  await p.goto("/masuk");
  await expect(p.getByText(/Akun demo: admin \/ admin123/)).toBeVisible();
  await ctx.close();
});

test("1e. Dashboard HRD: tautan cepat SDM membawa periode yang sedang dipilih", async () => {
  const p = sesi.hrd.page;
  // Tautan lama ?periode= dialihkan ke ?bulan=&tahun=; tautan cepat membawa bulan dan tahun yang dipilih.
  await bukaHalaman(p, "/?periode=2026-10");
  await expect(p).toHaveURL(/\/\?bulan=10&tahun=2026$/);
  const cepat = kartu(p, "Tautan cepat");
  await expect(cepat.getByRole("link", { name: "Presensi", exact: true })).toHaveAttribute("href", "/sdm/presensi?bulan=10&tahun=2026");
  await expect(cepat.getByRole("link", { name: "Hitung gaji", exact: true })).toHaveAttribute("href", "/sdm/hitung-gaji?bulan=10&tahun=2026");
  await cepat.getByRole("link", { name: "Distribusi gaji", exact: true }).click();
  await p.waitForURL(/\/sdm\/distribusi\?bulan=10&tahun=2026/);
  await expect(p.locator("#pilih-bulan")).toHaveValue("10");
  await expect(p.locator("#pilih-tahun")).toHaveValue("2026");
});

/* ------------------------------------------------------------------ 2. Admin: pembelian */

let noBeliA = "";
let noBeliB = "";

test("2a. Admin posting draf pembelian 2 HT", async () => {
  const p = sesi.admin.page;
  await bukaHalaman(p, "/konversi/pembelian-peralatan");
  await baris(p, "BP-2026-0007").getByRole("button", { name: "Posting" }).click();
  await konfirmasi(p);
  await expect(baris(p, "BP-2026-0007")).toContainText("Diposting");
});

async function isiPembelianPerlengkapan(p: Page, tanggal: string, qty: string, harga: string) {
  await bukaHalaman(p, "/konversi/pembelian-perlengkapan?form=baru");
  await p.locator("#tanggal").fill(tanggal);
  await p.locator("#baris-0-barang").selectOption({ index: 1 });
  await p.locator("#baris-0-qty").fill(qty);
  await p.locator("#baris-0-harga").fill(harga);
}

test("2b. Admin membuat pembelian perlengkapan baru dengan tambah cepat supplier", async () => {
  const p = sesi.admin.page;
  await isiPembelianPerlengkapan(p, "2026-11-05", "3", "25000");
  await p.getByRole("button", { name: "Supplier baru" }).click();
  await p.locator("#cepat-sup-nama").fill("CV Perlengkapan Uji E2E");
  await p.locator("#cepat-sup-telp").fill("0341555000");
  await p.getByRole("button", { name: "Simpan supplier" }).click();
  await expect(p.locator("#supplierKode")).not.toHaveValue("");
  await expect(p.locator("#supplierKode option:checked")).toContainText("CV Perlengkapan Uji E2E");
  await foto(p, "admin", "form-pembelian-perlengkapan");
  await p.getByRole("button", { name: "Simpan & posting" }).click();
  await konfirmasi(p);
  await p.waitForURL(/lihat=BL-/);
  noBeliA = new URL(p.url()).searchParams.get("lihat") ?? "";
  expect(noBeliA).toMatch(/^BL-2026-\d{4}$/);
  await expect(p.getByText("Diposting").first()).toBeVisible();
});

test("2c. Admin membuat satu pembelian perlengkapan lagi (untuk dibalik Owner)", async () => {
  const p = sesi.admin.page;
  await isiPembelianPerlengkapan(p, "2026-11-06", "1", "10000");
  await p.locator("#supplierKode").selectOption({ index: 1 });
  await p.getByRole("button", { name: "Simpan & posting" }).click();
  await konfirmasi(p);
  await p.waitForURL(/lihat=BL-/);
  noBeliB = new URL(p.url()).searchParams.get("lihat") ?? "";
  expect(noBeliB).not.toBe(noBeliA);
});

test("2d. Owner membalik satu pembelian dengan alasan", async () => {
  const p = sesi.owner.page;
  await bukaHalaman(p, "/konversi/pembelian-perlengkapan");
  await baris(p, noBeliB).getByRole("button", { name: "Balik" }).click();
  await konfirmasi(p, "Jumlah salah input, uji E2E");
  await expect(baris(p, noBeliB)).toContainText("Dibalik");
});

/* ------------------------------------------------------------------ 3. Admin: nilai sisa, penyusutan, jurnal penyesuaian */

/** Mengisi hasil hitung fisik semua perlengkapan dengan `pecahan` dari saldo buku, lalu menyimpan. */
async function isiNilaiSisa(p: Page, pecahan: number) {
  await bukaHalaman(p, "/konversi/nilai-sisa?periode=2026-11");
  const rows = p.locator("table[aria-label='Hitung fisik perlengkapan'] tbody tr");
  const n = await rows.count();
  expect(n).toBeGreaterThanOrEqual(5);
  for (let i = 0; i < n; i++) {
    const saldo = angkaDari(await rows.nth(i).locator("td").nth(2).innerText());
    await rows.nth(i).locator("input").fill(String(Math.floor(saldo * pecahan)));
  }
  await foto(p, "admin", "nilai-sisa-terisi");
  await p.getByRole("button", { name: "Simpan nilai sisa" }).click();
  await expect(p.getByText("Nilai sisa November 2026 sudah diinput")).toBeVisible();
}

test("3a. Admin input nilai sisa November", async () => {
  await isiNilaiSisa(sesi.admin.page, 0.5);
});

test("3b. Admin proses penyusutan November lalu mengajukannya dari halaman Proses Penyusutan", async () => {
  const p = sesi.admin.page;
  await bukaHalaman(p, "/konversi/penyusutan?periode=2026-11");
  await expect(p.getByText("11 belum diproses").first()).toBeVisible();
  await foto(p, "admin", "penyusutan-pratinjau");
  await p.getByRole("button", { name: "Buat jurnal penyusutan" }).click();
  await konfirmasi(p);
  await expect(p.getByText(/Riwayat proses/)).toBeVisible();
  await expect(baris(p, "November 2026").filter({ hasText: "Draf" })).toBeVisible();
  // Panel status periode ini: Draf, belum masuk buku besar, tombol Ajukan untuk Admin.
  const panel = p.getByRole("region", { name: "Jurnal penyusutan November 2026" });
  await expect(panel).toContainText("Draf");
  await expect(panel).toContainText("Belum masuk buku besar");
  await expect(panel.getByRole("button", { name: "Setujui" })).toHaveCount(0);
  await panel.getByRole("button", { name: "Ajukan ke Owner" }).click();
  await konfirmasi(p);
  await expect(panel).toContainText("Diajukan");
  await expect(panel).toContainText("Menunggu keputusan Owner");
  // Admin tidak punya tombol keputusan; kartu ringkasan tidak menyebut beban ini sebagai disetujui.
  await expect(p.getByRole("button", { name: "Setujui" })).toHaveCount(0);
  await expect(p.getByRole("button", { name: "Tolak" })).toHaveCount(0);
  await expect(p.getByText("Status jurnal November 2026").locator("..").locator("..")).toContainText("Diajukan");
});

test("3b2. Owner menolak penyusutan di halamannya (alasan wajib), Admin memproses ulang, Owner menyetujui", async () => {
  const po = sesi.owner.page;
  await bukaHalaman(po, "/konversi/penyusutan?periode=2026-11");
  const panel = po.getByRole("region", { name: "Jurnal penyusutan November 2026" });
  await expect(panel).toContainText("Diajukan");
  await expect(panel.getByRole("button", { name: "Setujui" })).toBeVisible();
  await panel.getByRole("button", { name: "Tolak" }).click();
  await expect(po.getByRole("dialog").locator('button[type="submit"]')).toBeDisabled();
  await konfirmasi(po, "Beban AST-0002 perlu dicek ulang");
  await expect(panel).toContainText("Ditolak");
  await expect(panel).toContainText("Beban AST-0002 perlu dicek ulang");
  await expect(panel).toContainText("Ditolak Owner D'Production");
  await expect(baris(po, "November 2026").filter({ hasText: "Ditolak" })).toContainText("Beban AST-0002 perlu dicek ulang");

  // Jadwal dibuka lagi: Admin melihat alasan dan bisa memproses ulang.
  const pa = sesi.admin.page;
  await bukaHalaman(pa, "/konversi/penyusutan?periode=2026-11");
  await expect(pa.getByRole("region", { name: "Jurnal penyusutan November 2026" })).toContainText("Beban AST-0002 perlu dicek ulang");
  await expect(pa.getByText("11 belum diproses").first()).toBeVisible();
  await pa.getByRole("button", { name: "Buat jurnal penyusutan" }).click();
  await konfirmasi(pa);
  const panelA = pa.getByRole("region", { name: "Jurnal penyusutan November 2026" });
  await expect(panelA).toContainText("Draf");
  await panelA.getByRole("button", { name: "Ajukan ke Owner" }).click();
  await konfirmasi(pa);
  await expect(panelA).toContainText("Diajukan");

  await bukaHalaman(po, "/konversi/penyusutan?periode=2026-11");
  await panel.getByRole("button", { name: "Setujui" }).click();
  await konfirmasi(po);
  await expect(panel).toContainText("Disetujui");
  await expect(panel).toContainText("Sudah masuk buku besar");
  // Riwayat periode ini: satu ditolak (dengan alasan) dan satu disetujui.
  await expect(baris(po, "November 2026").filter({ hasText: "Ditolak" })).toHaveCount(1);
  await expect(baris(po, "November 2026").filter({ hasText: "Disetujui" })).toHaveCount(1);
});

test("3c. Admin mengajukan jurnal nilai sisa ke Owner dari menu Jurnal Penyesuaian", async () => {
  const p = sesi.admin.page;
  await bukaHalaman(p, "/pelaporan/jurnal-penyesuaian?status=DRAFT");
  await expect(p.getByRole("button", { name: "Ajukan ke Owner" })).toHaveCount(1);
  await p.getByRole("button", { name: "Ajukan ke Owner" }).first().click();
  await konfirmasi(p);
  await expect(p.getByRole("button", { name: "Ajukan ke Owner" })).toHaveCount(0);
});

test("3d. Owner menolak jurnal nilai sisa (alasan wajib) di menu Jurnal Penyesuaian", async () => {
  const p = sesi.owner.page;
  await bukaHalaman(p, "/pelaporan/jurnal-penyesuaian?status=DIAJUKAN");
  const opname = kartu(p, "Biaya perlengkapan November 2026");
  await opname.getByRole("button", { name: "Tolak" }).click();
  // Alasan kosong tidak bisa dikirim.
  await expect(p.getByRole("dialog").locator('button[type="submit"]')).toBeDisabled();
  await konfirmasi(p, "Hasil hitung fisik terlalu rendah, hitung ulang");
  await bukaHalaman(p, "/pelaporan/jurnal-penyesuaian?status=DITOLAK");
  await expect(p.getByText("Hasil hitung fisik terlalu rendah")).toBeVisible();
  // Alasan yang sama terbaca di halaman Nilai Sisa beserta status Ditolak.
  await bukaHalaman(p, "/konversi/nilai-sisa?periode=2026-11");
  const panel = p.getByRole("region", { name: "Jurnal biaya perlengkapan November 2026" });
  await expect(panel).toContainText("Ditolak");
  await expect(panel).toContainText("Hasil hitung fisik terlalu rendah");
});

test("3e. Admin input ulang nilai sisa, lalu Owner menyetujui jurnalnya", async () => {
  const pa = sesi.admin.page;
  await isiNilaiSisa(pa, 0.4);
  await bukaHalaman(pa, "/pelaporan/jurnal-penyesuaian?status=DRAFT");
  await pa.getByRole("button", { name: "Ajukan ke Owner" }).first().click();
  await konfirmasi(pa);
  const po = sesi.owner.page;
  await bukaHalaman(po, "/pelaporan/jurnal-penyesuaian?status=DIAJUKAN");
  await kartu(po, "Biaya perlengkapan November 2026").getByRole("button", { name: "Setujui" }).click();
  await konfirmasi(po);
  await bukaHalaman(po, "/pelaporan/jurnal-penyesuaian?status=DISETUJUI");
  await expect(po.getByText("Biaya perlengkapan November 2026").first()).toBeVisible();
  await expect(po.getByText("Penyusutan peralatan November 2026").first()).toBeVisible();
});

/* ------------------------------------------------------------------ 4. Pelepasan */

test("4a. Admin mengajukan pelepasan satu aset", async () => {
  const p = sesi.admin.page;
  await bukaHalaman(p, "/konversi/pelepasan?form=baru");
  await p.locator("#asetKode").selectOption("AST-0004");
  await p.locator("#tanggal").fill("2026-11-12");
  await p.locator("#alasan").selectOption({ label: "Dijual" });
  await p.locator("#hargaJual").fill("600000");
  await foto(p, "admin", "form-pelepasan");
  await p.getByRole("button", { name: "Ajukan ke Owner" }).click();
  await expect(p.getByText("PLP-2026-0002").first()).toBeVisible();
});

test("4b. Owner menolak satu pengajuan dengan alasan, lalu menyetujui yang lain", async () => {
  const p = sesi.owner.page;
  await bukaHalaman(p, "/konversi/pelepasan");
  await baris(p, "PLP-2026-0001").getByRole("button", { name: "Tolak" }).click();
  await konfirmasi(p, "Aset masih dipakai, uji E2E");
  await expect(baris(p, "PLP-2026-0001")).toContainText("Ditolak");
  await baris(p, "PLP-2026-0002").getByRole("button", { name: "Setujui" }).click();
  await konfirmasi(p);
  await expect(baris(p, "PLP-2026-0002")).toContainText("Disetujui");
});

/* ------------------------------------------------------------------ 5. SDM */

test("5a. HRD input presensi November", async () => {
  const p = sesi.hrd.page;
  const karyawan = ["KRY-01", "KRY-02", "KRY-03", "KRY-04", "KRY-05"];
  for (const tanggal of ["2026-11-02", "2026-11-03"]) {
    for (const k of karyawan) {
      await bukaHalaman(p, `/sdm/presensi?tab=harian&periode=2026-11&form=baru`);
      await p.locator("#pr-karyawan").selectOption(k);
      await p.locator("#pr-tanggal").fill(tanggal);
      const alpa = k === "KRY-02" && tanggal === "2026-11-03";
      await p.locator("#pr-absensi").selectOption({ label: alpa ? "Alpa" : "Hadir" });
      if (!alpa) {
        await p.locator("#pr-masuk").fill("08:00");
        await p.locator("#pr-keluar").fill("17:00");
      }
      await p.getByRole("button", { name: "Simpan" }).click();
      await expect(p.locator("#pr-karyawan")).toHaveCount(0);
    }
  }
  await bukaHalaman(p, "/sdm/presensi?periode=2026-11");
  await expect(p.getByText("Rekap presensi · Bulan: November · Tahun: 2026")).toBeVisible();
  await foto(p, "hrd", "presensi-november");
  const sel = (kode: string, i: number) => baris(p, kode).locator("td").nth(i);
  await expect(sel("KRY-01", 3)).toHaveText("2");
  await expect(sel("KRY-02", 3)).toHaveText("1");
  await expect(sel("KRY-02", 7)).toHaveText("1");
});

test("5b. HRD hitung gaji semua karyawan", async () => {
  const p = sesi.hrd.page;
  await bukaHalaman(p, "/sdm/hitung-gaji?periode=2026-11");
  await p.getByRole("button", { name: /Hitung dan simpan semua/ }).click();
  await konfirmasi(p);
  await expect(p.getByText("5 slip tersimpan")).toBeVisible();
  const tfoot = p.locator("table[aria-label='Hitung gaji per karyawan'] tfoot tr");
  const thp = angkaDari(await tfoot.locator("td").nth(3).innerText());
  const pph = angkaDari(await tfoot.locator("td").nth(2).innerText());
  const bruto = angkaDari(await tfoot.locator("td").nth(1).innerText());
  expect(thp).toBe(bruto - pph);
  expect(thp).toBeGreaterThan(20_000_000);
  angkaKunci["Gaji November: bruto"] = bruto;
  angkaKunci["Gaji November: PPh 21"] = pph;
  angkaKunci["Gaji November: THP"] = thp;
  await foto(p, "hrd", "hitung-gaji-november");
});

test("5c. HRD mengajukan distribusi gaji, Owner menyetujui", async () => {
  const p = sesi.hrd.page;
  await bukaHalaman(p, "/sdm/distribusi?periode=2026-11");
  await p.getByRole("button", { name: "Ajukan ke Owner" }).click();
  await konfirmasi(p);
  await expect(p.getByText("PAY-2026-0002").first()).toBeVisible();
  const po = sesi.owner.page;
  await bukaHalaman(po, "/sdm/distribusi?periode=2026-11");
  await baris(po, "PAY-2026-0002").getByRole("button", { name: "Setujui" }).click();
  await konfirmasi(po);
  await expect(baris(po, "PAY-2026-0002")).toContainText("Disetujui");
});

/* ------------------------------------------------------------------ 6. Laporan dan tutup periode */

test("6a. Jurnal umum, buku besar kas, dan neraca saldo November", async () => {
  const p = sesi.owner.page;
  await bukaHalaman(p, "/pelaporan/jurnal-umum?periode=2026-11");
  await expect(p.getByText("PAY-2026-0002").first()).toBeVisible();
  await expect(p.getByText(noBeliA).first()).toBeVisible();
  await expect(p.getByText(/JB-2026-/).first()).toBeVisible();

  // Kas = kas Oktober - pembelian tunai November + pembalik + hasil jual aset - THP gaji.
  await bukaHalaman(p, "/pelaporan/buku-besar?akun=1-110&periode=2026-11");
  const awal = angkaDari(await baris(p, "Saldo awal").locator("td").last().innerText());
  const akhir = angkaDari(await baris(p, "Saldo akhir").locator("td").last().innerText());
  expect(awal).toBe(44_309_657);
  const diharapkan = awal - 1_900_000 - 75_000 - 10_000 + 10_000 + 600_000 - Number(angkaKunci["Gaji November: THP"]);
  expect(akhir).toBe(diharapkan);
  angkaKunci["Kas akhir November"] = akhir;
  await foto(p, "owner", "buku-besar-kas-november");

  // Bawaan = setelah penyesuaian, tampil sebagai neraca lajur: neraca saldo, penyesuaian, setelah penyesuaian.
  await bukaHalaman(p, "/pelaporan/neraca-saldo?periode=2026-11");
  await expect(p.getByRole("heading", { name: "Neraca Saldo Setelah Penyesuaian", level: 1 })).toBeVisible();
  const total = p.locator("table[aria-label='Neraca lajur'] tfoot tr").first().locator("td");
  const [nsDebit, nsKredit, adjDebit, adjKredit, debit, kredit] = await Promise.all([1, 2, 3, 4, 5, 6].map(async (i) => angkaDari(await total.nth(i).innerText())));
  expect(nsDebit).toBe(nsKredit);
  expect(adjDebit).toBe(adjKredit);
  expect(debit).toBe(kredit);
  expect(debit).toBeGreaterThan(145_622_573);
  await expect(p.getByText("Total seimbang")).toBeVisible();
  angkaKunci["Neraca saldo November (debit = kredit)"] = debit;
  angkaKunci["Penyesuaian November (debit = kredit)"] = adjDebit;
  await foto(p, "owner", "neraca-saldo-november");

  // Tahap sebelum = kolom neraca saldo di neraca lajur, dalam tabel debit dan kredit biasa.
  await bukaHalaman(p, "/pelaporan/neraca-saldo?periode=2026-11&tahap=sebelum");
  await expect(p.getByRole("heading", { name: "Neraca Saldo Sebelum Penyesuaian", level: 1 })).toBeVisible();
  const totalSebelum = p.locator("table[aria-label='Neraca saldo'] tfoot tr").first().locator("td");
  expect(angkaDari(await totalSebelum.nth(1).innerText())).toBe(nsDebit);
  expect(angkaDari(await totalSebelum.nth(2).innerText())).toBe(nsKredit);
  await expect(p.getByText("Total seimbang")).toBeVisible();
  await foto(p, "owner", "neraca-saldo-november-sebelum");
});

test("6a2. Tahap penyesuaian: menu urut siklus, buku besar beban penyusutan Oktober sebelum dan setelah", async () => {
  const p = sesi.owner.page;
  await bukaHalaman(p, "/pelaporan/jurnal-penyesuaian");
  await tautanMenu(p, "Jurnal & laporan", "Jurnal Umum");
  await expect(p.getByRole("navigation", { name: "Menu utama" }).first().locator("#grup-pelaporan a")).toHaveText([
    /^Jurnal Umum/, /^Buku Besar/, /^Neraca Saldo/, /^Jurnal Penyesuaian/, /^Tutup Periode/,
  ]);
  await p.getByRole("link", { name: "Lihat setelah penyesuaian" }).click();
  await expect(p.getByRole("heading", { name: "Neraca Saldo Setelah Penyesuaian", level: 1 })).toBeVisible();

  // Sebelum: jurnal penyesuaian Oktober belum dihitung.
  await bukaHalaman(p, "/pelaporan/buku-besar?akun=6-110&periode=2026-10&tahap=sebelum");
  await expect(p.getByRole("heading", { name: "Buku Besar Sebelum Penyesuaian", level: 1 })).toBeVisible();
  await expect(baris(p, "JP-2026-0001")).toHaveCount(0);
  const sebelum = angkaDari(await baris(p, "Saldo akhir").locator("td").last().innerText());

  // Pilihan tahap membawa akun dan periode yang sedang dipilih.
  await p.getByRole("link", { name: "Setelah penyesuaian" }).click();
  await expect(p.getByRole("heading", { name: "Buku Besar Setelah Penyesuaian", level: 1 })).toBeVisible();
  for (const q of [/akun=6-110/, /bulan=10&tahun=2026/, /tahap=setelah/]) await expect(p).toHaveURL(q);
  const jp = baris(p, "JP-2026-0001");
  await expect(jp.getByText("Penyesuaian", { exact: true })).toBeVisible();
  expect(angkaDari(await jp.locator("td").nth(3).innerText())).toBe(1_492_915);
  expect(angkaDari(await baris(p, "Saldo sebelum penyesuaian").locator("td").last().innerText())).toBe(sebelum);
  expect(angkaDari(await baris(p, "Saldo akhir").locator("td").last().innerText())).toBe(sebelum + 1_492_915);
  angkaKunci["Beban penyusutan Oktober sebelum + penyesuaian = setelah"] = `${sebelum} + 1492915`;
});

test("6b. Tutup Oktober lulus, transaksi di Oktober ditolak, buka kembali dengan alasan", async () => {
  const po = sesi.owner.page;
  await bukaHalaman(po, "/pelaporan/tutup-periode");
  // Kunci berurutan: November baru bisa dikunci sesudah Oktober.
  const nov = po.locator(".kartu", { has: po.getByRole("heading", { name: "Bulan: November · Tahun: 2026" }) });
  await expect(nov.getByText("Kunci Oktober 2026 dulu")).toBeVisible();
  await expect(nov.getByRole("button", { name: "Kunci periode" })).toHaveCount(0);
  const okt = po.locator(".kartu", { has: po.getByRole("heading", { name: "Bulan: Oktober · Tahun: 2026" }) });
  await expect(okt.getByText("Belum:", { exact: false })).toHaveCount(0);
  await okt.getByRole("button", { name: "Kunci periode" }).click();
  await konfirmasi(po);
  await expect(okt).toContainText("Terkunci");

  const pa = sesi.admin.page;
  await isiPembelianPerlengkapan(pa, "2026-10-20", "1", "10000");
  await pa.locator("#supplierKode").selectOption({ index: 1 });
  await pa.getByRole("button", { name: "Simpan & posting" }).click();
  await pa.getByRole("dialog").locator('button[type="submit"]').click();
  await expect(pa.getByRole("status")).toContainText(/sudah dikunci/i);
  await pa.getByRole("dialog").getByRole("button", { name: "Batal" }).click();
  await expect(pa).toHaveURL(/form=baru/);

  await bukaHalaman(po, "/pelaporan/tutup-periode");
  const okt2 = po.locator(".kartu", { has: po.getByRole("heading", { name: "Bulan: Oktober · Tahun: 2026" }) });
  await okt2.getByRole("button", { name: "Buka kunci" }).click();
  await konfirmasi(po, "Koreksi uji E2E");
  await expect(okt2).toContainText("Terbuka");
  await foto(po, "owner", "tutup-periode-dibuka-kembali");
});

/* ------------------------------------------------------------------ 7. Master dan pengguna */

type DefTab = { kel: "konversi" | "sdm"; tab: string; label: string; cari: string; nanti?: boolean; isi: (f: Locator) => Promise<void> };

const TAB_MASTER: DefTab[] = [
  { kel: "konversi", tab: "supplier", label: "Supplier", cari: "Supplier Uji E2E", isi: async (f) => f.getByLabel("Nama supplier").fill("Supplier Uji E2E") },
  {
    kel: "konversi", tab: "peralatan", label: "Peralatan", cari: "Peralatan Uji E2E",
    isi: async (f) => {
      await f.getByLabel("Nama peralatan").fill("Peralatan Uji E2E");
      await f.getByLabel("Satuan").fill("unit");
      await f.getByLabel("Kategori aset").selectOption({ index: 1 });
    },
  },
  {
    kel: "konversi", tab: "perlengkapan", label: "Perlengkapan", cari: "Perlengkapan Uji E2E",
    isi: async (f) => {
      await f.getByLabel("Nama perlengkapan").fill("Perlengkapan Uji E2E");
      await f.getByLabel("Satuan").fill("pak");
    },
  },
  {
    kel: "konversi", tab: "kategori", label: "Kategori aset", cari: "Kategori Uji E2E",
    isi: async (f) => {
      await f.getByLabel("Nama kategori").fill("Kategori Uji E2E");
      await f.getByLabel("Masa manfaat").fill("36");
      await f.getByLabel("Residu").fill("5");
      await f.getByLabel("Akun aset").selectOption("1-150");
      await f.getByLabel("Akun akumulasi").selectOption("1-151");
      await f.getByLabel("Akun biaya").selectOption("6-110");
    },
  },
  {
    kel: "konversi", tab: "akun", label: "Bagan akun", cari: "9-990",
    isi: async (f) => {
      await f.getByLabel("Kode akun").fill("9-990");
      await f.getByLabel("Nama akun").fill("Akun Uji E2E");
      await f.getByLabel("Tipe").selectOption("ASET");
      await f.getByLabel("Saldo normal").selectOption("D");
    },
  },
  {
    kel: "sdm", nanti: true, tab: "karyawan", label: "Karyawan", cari: "Karyawan Uji E2E",
    isi: async (f) => {
      await f.getByLabel(/^Nama( \*)?$/).fill("Karyawan Uji E2E");
      await f.getByLabel("Status PTKP").selectOption("TK0");
      await f.getByLabel("Bank").selectOption("BCA");
      await f.getByLabel("No. rekening").fill("1234567890");
    },
  },
  {
    kel: "sdm", nanti: true, tab: "jabatan", label: "Jabatan", cari: "Jabatan Uji E2E",
    isi: async (f) => {
      await f.getByLabel("Nama jabatan").fill("Jabatan Uji E2E");
      await f.getByLabel("Akun biaya gaji").selectOption("6-210");
    },
  },
  {
    kel: "sdm", nanti: true, tab: "golongan", label: "Gaji pokok", cari: "Golongan Uji E2E",
    isi: async (f) => {
      await f.getByLabel("Golongan").fill("Golongan Uji E2E");
      await f.getByLabel("Gaji pokok (Rp)").fill("3000000");
    },
  },
  {
    kel: "sdm", nanti: true, tab: "tunjangan", label: "Tunjangan", cari: "Tunjangan Uji E2E",
    isi: async (f) => {
      await f.getByLabel("Nama tunjangan").fill("Tunjangan Uji E2E");
      await f.getByLabel("Nominal per bulan").fill("100000");
    },
  },
  {
    kel: "sdm", tab: "jadwal", label: "Jadwal kerja", cari: "Jabatan Uji E2E",
    isi: async (f) => {
      await pilihTeks(f, "Jabatan", "Jabatan Uji E2E");
      await f.getByLabel("Jam masuk").fill("08:00");
      await f.getByLabel("Jam keluar").fill("17:00");
      await f.getByLabel("Hari kerja per bulan").fill("22");
    },
  },
];

/** Jabatan, golongan, dan tunjangan ada di tab Struktur gaji Master SDM; jenis lain tetap satu tab per jenis. */
const STRUKTUR = ["jabatan", "jabatanEvent", "golongan", "tunjangan"];
const alamatMaster = (t: { kel: string; tab: string }, baru: boolean) =>
  STRUKTUR.includes(t.tab)
    ? `/master/sdm?tab=struktur&jenis=${t.tab}${baru ? "&form=baru" : ""}`
    : `/master/${t.kel}?tab=${t.tab}${baru ? "&form=baru" : ""}`;

test("7a. Form master dikirim kosong: pesan Indonesia, isian salah pertama difokuskan dan menunjuk pesannya", async () => {
  const p = sesi.owner.page;
  await bukaHalaman(p, "/master/konversi?tab=supplier&form=baru");
  const form = p.getByRole("form", { name: "Form Supplier" });
  await form.getByRole("button", { name: "Simpan" }).click();
  const nama = form.getByLabel("Nama supplier");
  await expect(nama).toBeFocused();
  await expect(nama).toHaveAttribute("aria-invalid", "true");
  await expect(nama).toHaveAccessibleDescription("Nama supplier wajib diisi.");
  await expect(p.getByRole("status")).toContainText("Nama supplier wajib diisi.");
});

/** Tambah satu data lewat form; bila `nanti` kosong, langsung dinonaktifkan lagi. */
for (const t of TAB_MASTER) {
  test(`7. Master ${t.kel}/${t.label}: Owner tambah${t.nanti ? "" : " lalu nonaktifkan"} satu data`, async () => {
    const p = sesi.owner.page;
    await bukaHalaman(p, alamatMaster(t, true));
    const form = p.getByRole("form", { name: `Form ${t.label}` });
    await expect(form).toBeVisible();
    await t.isi(form);
    await form.getByRole("button", { name: "Simpan" }).click();
    await expect(form).toBeHidden();
    await expect(baris(p, t.cari).first()).toBeVisible();
    // Nominal master berversi: nominal awal data baru menjadi pengajuan (berlaku bulan berjalan), Owner menyetujuinya.
    if (STRUKTUR.includes(t.tab)) {
      const ajuan = p.getByRole("list", { name: "Pengajuan nominal menunggu Owner" }).locator("li", { hasText: t.cari });
      await ajuan.getByRole("button", { name: /^Setujui/ }).click();
      await konfirmasi(p);
      await expect(ajuan).toHaveCount(0);
    }
    await foto(p, "owner", `master-${t.tab}`);
    if (!t.nanti) await nonaktifkan(p, t.cari);
  });
}

async function nonaktifkan(p: Page, cari: string) {
  const r = baris(p, cari).first();
  await r.getByRole("button", { name: "Nonaktifkan" }).click();
  await konfirmasi(p);
  await expect(baris(p, cari).first()).toContainText("Nonaktif");
}

/*
 * Setting gaji tidak lagi lewat form master: tautan lama tab Setting gaji dialihkan ke halaman Setting Gaji, Owner
 * mengajukan setting awal (berlaku bulan berjalan) lalu menyetujuinya sendiri.
 */
test("7. Setting gaji: Owner mengajukan setting awal Karyawan Uji E2E lalu menyetujuinya", async () => {
  const p = sesi.owner.page;
  await bukaHalaman(p, "/master/sdm?tab=setgaji&form=baru");
  await expect(p).toHaveURL(/\/sdm\/setting-gaji\?form=baru/);
  const form = p.getByRole("form", { name: "Form pengajuan setting gaji" });
  await pilihTeks(form, "Karyawan", "Karyawan Uji E2E");
  await expect(form.getByLabel("Jenis perubahan")).toHaveValue("SETTING_AWAL");
  await pilihTeks(form, "Jabatan", "Jabatan Uji E2E");
  await pilihTeks(form, "Gaji pokok", "Golongan Uji E2E");
  await form.getByLabel(/Tunjangan Uji E2E/).check();
  await form.getByLabel("Alasan pengajuan").fill("Karyawan baru uji E2E");
  await form.getByRole("button", { name: "Ajukan ke Owner" }).click();
  await expect(form).toBeHidden();
  const ajuan = p.getByRole("list", { name: "Pengajuan setting gaji menunggu Owner" }).locator("li", { hasText: "Karyawan Uji E2E" });
  await ajuan.getByRole("button", { name: /^Setujui/ }).click();
  await konfirmasi(p);
  await expect(baris(p, "Karyawan Uji E2E").first()).toContainText("Golongan Uji E2E");
  await foto(p, "owner", "master-setgaji");
});

// Data yang dipakai jadwal dan setting gaji baru boleh dinonaktifkan setelah keduanya dibuat.
for (const t of TAB_MASTER.filter((x) => x.nanti)) {
  test(`7. Master ${t.kel}/${t.label}: Owner menonaktifkan data uji`, async () => {
    const p = sesi.owner.page;
    await bukaHalaman(p, alamatMaster(t, false));
    await nonaktifkan(p, t.cari);
  });
}

test("7z. Owner menambah pengguna baru, lalu pengguna itu bisa masuk", async ({ browser }) => {
  const p = sesi.owner.page;
  await bukaHalaman(p, "/pengguna?form=baru");
  const form = p.getByRole("form", { name: "Pengguna baru" });
  await form.getByLabel("Nama pengguna").fill("uji.e2e");
  await form.getByLabel("Nama lengkap").fill("Penguji E2E");
  await form.getByLabel("Peran").selectOption({ label: "Admin" });
  await form.getByLabel("Kata sandi").fill("ujicoba123");
  await form.getByRole("button", { name: "Simpan" }).click();
  await expect(p.getByText("@uji.e2e")).toBeVisible();
  const baru = await bukaSesi(browser, "uji.e2e", "ujicoba123", "uji.e2e");
  await expect(baru.page.getByText("Penguji E2E").first()).toBeVisible();
  await expect(await tautanMenu(baru.page, "Pengaturan", "Pengguna")).toHaveCount(0);
  await baru.ctx.close();
});

/* ------------------------------------------------------------------ 8. Tangkapan layar per peran */

for (const peran of ["admin", "hrd", "owner"] as const) {
  test(`8. Screenshot semua halaman utama: ${peran}`, async () => {
    const p = sesi[peran].page;
    const daftar = peran === "owner" ? [...HALAMAN_UTAMA, "/pengguna"] : HALAMAN_UTAMA;
    for (const alamat of daftar) {
      await bukaHalaman(p, alamat);
      await foto(p, peran, slug(alamat));
    }
  });
}

test("8m. Tampilan layar sempit (390px): halaman utama tanpa overflow", async ({ browser }) => {
  const m = await bukaSesi(browser, "hrd", "hrd12345", "hrd-mobile", { width: 390, height: 844 });
  for (const alamat of ["/", "/sdm/hitung-gaji?periode=2026-11", "/sdm/presensi", "/sdm/distribusi?periode=2026-11", "/konversi/pembelian-peralatan", "/pelaporan/neraca-saldo"]) {
    await bukaHalaman(m.page, alamat);
    await foto(m.page, "mobile", slug(alamat));
  }
  // Tabel gaji tampil sebagai kartu ringkas, bukan tabel yang digeser.
  await bukaHalaman(m.page, "/sdm/hitung-gaji?periode=2026-11");
  await expect(m.page.locator("table[aria-label='Hitung gaji per karyawan']")).toBeHidden();
  await expect(m.page.getByLabel("Hitung gaji per karyawan (ringkas)")).toBeVisible();

  // Satu kotak baris untuk teks kode akun = tidak patah ke baris kedua ("1-" dan "140").
  const tidakPatah = async (kode: Locator) => {
    await expect(kode).toBeVisible();
    await expect(kode).toHaveCSS("white-space", "nowrap");
    expect(await kode.evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getClientRects().length; })).toBe(1);
  };
  // Neraca lajur (bawaan, setelah penyesuaian) tampil sebagai kartu ringkas per akun, bukan tabel delapan kolom.
  await bukaHalaman(m.page, "/pelaporan/neraca-saldo?periode=2026-11");
  await expect(m.page.locator("table[aria-label='Neraca lajur']")).toBeHidden();
  const lajurHP = m.page.getByLabel("Neraca lajur (ringkas)");
  await expect(lajurHP).toBeVisible();
  await expect(lajurHP.getByText("Jumlah per kolom")).toBeVisible();
  await tidakPatah(lajurHP.locator(".kode", { hasText: /^1-140$/ }).first());
  await cekLuapan(m.page, "mobile/neraca-saldo");
  // Sebelum penyesuaian: tabel debit dan kredit biasa, digeser di dalam pembungkus bila perlu, halaman tidak melebar.
  await bukaHalaman(m.page, "/pelaporan/neraca-saldo?periode=2026-11&tahap=sebelum");
  await tidakPatah(m.page.locator("td .kode, td.kode", { hasText: /^1-140$/ }).first());
  await cekLuapan(m.page, "mobile/neraca-saldo-sebelum");
  await bukaHalaman(m.page, "/pelaporan/buku-besar?akun=6-110&periode=2026-10&tahap=setelah");
  await cekLuapan(m.page, "mobile/buku-besar-setelah");

  // Laci menu: tertutup = inert (tidak bisa dicapai Tab), Esc menutup, fokus pindah ke tombol tutup lalu kembali.
  const laci = m.page.locator("#laci-menu");
  const buka = m.page.getByRole("button", { name: "Buka menu" });
  await expect(laci).toHaveAttribute("inert", "");
  await buka.focus();
  await m.page.keyboard.press("Shift+Tab");
  expect(await m.page.evaluate(() => !!document.activeElement?.closest("#laci-menu"))).toBe(false);
  // Shift+Tab mendarat di tautan "Lompat ke isi" (menutupi tombol), jadi laci dibuka lewat papan ketik dari tombolnya.
  await buka.focus();
  await m.page.keyboard.press("Enter");
  await expect(m.page.getByRole("button", { name: "Tutup menu" })).toBeFocused();
  await expect(laci).not.toHaveAttribute("inert");
  await m.page.keyboard.press("Escape");
  await expect(laci).toHaveAttribute("inert", "");
  await expect(buka).toBeFocused();
  await m.ctx.close();
});

test("9. Tidak ada galat konsol atau halaman melebar", async () => {
  expect(galatKonsol, galatKonsol.join("\n")).toEqual([]);
  expect(temuan, temuan.join("\n")).toEqual([]);
});
