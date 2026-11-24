/*
 * Uji E2E riwayat setting gaji dan filter Bulan/Tahun.
 *  - HRD membuat karyawan baru, mengajukan setting awal berlaku bulan berjalan, Owner menyetujui, slip bulan berjalan dihitung.
 *  - HRD mengajukan promosi berlaku bulan depan, Owner melihatnya di dashboard dan menyetujui. Slip bulan berjalan dihitung
 *    ulang tetap gaji lama, slip bulan berlaku memakai gaji baru.
 *  - Owner menolak pengajuan lain dengan alasan; riwayat menampilkannya.
 *  - Buku Besar dan Neraca Saldo: tautan lama ?periode= dialihkan, Bulan dan Tahun terpisah, judul layar dan cetak.
 * Memakai karyawan baru sendiri, jadi tidak bergantung pada urutan spec lain. Potret 1440 dan 390 disimpan di POTRET.
 */
import fs from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? 3200}`;
const POTRET = process.env.E2E_POTRET_GAJI ?? "artefak-uji/potret";
const galatKonsol: string[] = [];
const NAMA = "Promosi Uji E2E";
const NOV = { bulan: 11, tahun: 2026 };
const DES = { bulan: 12, tahun: 2026 };

type Sesi = { ctx: BrowserContext; page: Page };
const sesi: Record<"hrd" | "owner", Sesi> = {} as never;
let kode = "";

async function bukaSesi(browser: Browser, nama: string, sandi: string): Promise<Sesi> {
  const ctx = await browser.newContext({ baseURL: BASE, locale: "id-ID", timezoneId: "Asia/Jakarta", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => galatKonsol.push(`[${nama}] pageerror ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) galatKonsol.push(`[${nama}] ${page.url()} ${m.text().slice(0, 200)}`);
  });
  await page.goto("/masuk");
  await page.getByLabel("Nama pengguna").fill(nama);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/masuk"));
  return { ctx, page };
}

const toast = (p: Page) => p.getByRole("status");
async function konfirmasi(p: Page, alasan?: string) {
  const d = p.getByRole("dialog");
  await expect(d).toBeVisible();
  if (alasan) await d.getByLabel(/Alasan/).fill(alasan);
  await d.locator('button[type="submit"]').click();
  await expect(d).toBeHidden();
}
async function pilihTeks(f: Locator, label: string, teks: string) {
  const nilai = await f.getByLabel(label).locator("option", { hasText: teks }).first().getAttribute("value");
  expect(nilai, `opsi "${teks}" di ${label}`).toBeTruthy();
  await f.getByLabel(label).selectOption(nilai as string);
}

/** Potret 1440 dan 390 (dan cetak bila diminta). Di 390 halaman tidak boleh melebar: scrollWidth <= 390. */
async function potret(p: Page, nama: string, opsi: { cetak?: boolean } = {}) {
  fs.mkdirSync(POTRET, { recursive: true });
  for (const lebar of [1440, 390]) {
    await p.setViewportSize({ width: lebar, height: lebar === 390 ? 844 : 900 });
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(400);
    const lebih = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(lebih, `${nama} melebar ${lebih}px di ${lebar}`).toBeLessThanOrEqual(1);
    if (lebar === 390) expect(await p.evaluate(() => document.documentElement.scrollWidth), `${nama} scrollWidth di 390`).toBeLessThanOrEqual(390);
    await p.screenshot({ path: `${POTRET}/${nama}-${lebar}.png`, fullPage: true });
  }
  if (opsi.cetak) {
    await p.emulateMedia({ media: "print" });
    await p.setViewportSize({ width: 794, height: 1123 });
    await p.screenshot({ path: `${POTRET}/${nama}-cetak.png`, fullPage: true });
    await expect(p.getByRole("navigation", { name: "Menu utama" })).toBeHidden();
    await p.emulateMedia({ media: "screen" });
  }
  await p.setViewportSize({ width: 1440, height: 900 });
}

const q = (x: { bulan: number; tahun: number }) => `bulan=${x.bulan}&tahun=${x.tahun}`;

async function isiPresensi(p: Page, tanggal: string, periode: { bulan: number; tahun: number }) {
  await p.goto(`/sdm/presensi?${q(periode)}&tab=harian&form=baru`);
  await p.locator("#pr-karyawan").selectOption(kode);
  await p.locator("#pr-tanggal").fill(tanggal);
  await p.locator("#pr-absensi").selectOption({ label: "Hadir" });
  await p.locator("#pr-masuk").fill("08:00");
  await p.locator("#pr-keluar").fill("17:00");
  await p.getByRole("button", { name: "Simpan" }).click();
  await expect(toast(p)).toContainText("Presensi tersimpan");
  await p.waitForLoadState("networkidle");
}

/** Buka pratinjau slip karyawan uji di Gaji Bulanan, lalu kembalikan teks gaji pokok di slipnya. */
async function hitungDanGajiPokok(p: Page, periode: { bulan: number; tahun: number }): Promise<string> {
  // Gaji Bulanan menghitung slip dari bahan terbaru; pratinjau slip karyawan uji menampilkan sumber versi gaji pokok.
  await p.goto(`/sdm/gaji-bulanan?${q(periode)}&slip=${kode}`);
  const slip = p.getByRole("article", { name: `Slip gaji ${NAMA}` });
  return (await slip.getByRole("table", { name: "Gaji tetap" }).getByRole("row", { name: /Gaji pokok/ }).innerText()).replace(/\s+/g, " ");
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  sesi.hrd = await bukaSesi(browser, "hrd", "hrd12345");
  sesi.owner = await bukaSesi(browser, "owner", "owner123");
});

test.afterAll(async () => {
  for (const s of Object.values(sesi)) await s.ctx.close();
  if (galatKonsol.length) console.log("Galat konsol:\n" + galatKonsol.join("\n"));
});

test("HRD: karyawan baru, setting awal berlaku bulan berjalan diajukan lalu disetujui Owner, slip November gaji lama", async () => {
  const p = sesi.hrd.page;
  await p.goto("/master/sdm?tab=karyawan&form=baru");
  const fk = p.getByRole("form", { name: "Form Karyawan" });
  await fk.getByLabel(/^Nama( \*)?$/).fill(NAMA);
  await fk.getByLabel("Status PTKP").selectOption("TK0");
  await fk.getByLabel("Bank").selectOption("BCA");
  await fk.getByLabel("No. rekening").fill("9988776655");
  await fk.getByRole("button", { name: "Simpan" }).click();
  await expect(toast(p)).toContainText(/Karyawan KRY-\d+ tersimpan/);
  kode = (await toast(p).innerText()).match(/KRY-\d+/)![0];

  // Presensi ditolak sebelum ada setting gaji yang disetujui: pilihan karyawannya nonaktif.
  await p.goto(`/sdm/presensi?${q(NOV)}&tab=harian&form=baru`);
  await expect(p.locator("#pr-karyawan").locator(`option[value="${kode}"]`)).toBeDisabled();

  await p.goto(`/sdm/setting-gaji?form=baru&karyawan=${kode}`);
  const f = p.getByRole("form", { name: "Form pengajuan setting gaji" });
  await expect(f.getByLabel("Jenis perubahan")).toHaveValue("SETTING_AWAL");
  await pilihTeks(f, "Jabatan", "Crew Produksi");
  await pilihTeks(f, "Gaji pokok", "Golongan I");
  await f.getByLabel(/Makan/).check();
  await expect(f.getByLabel("Bulan", { exact: true })).toHaveValue(String(NOV.bulan));
  await expect(f.getByLabel("Tahun", { exact: true })).toHaveValue(String(NOV.tahun));
  await f.getByLabel("Alasan pengajuan").fill("Karyawan baru bagian produksi");
  await f.getByRole("button", { name: "Ajukan ke Owner" }).click();
  await expect(toast(p)).toContainText(/Pengajuan SET-\d+ \(setting awal Promosi Uji E2E, berlaku November 2026\) dikirim ke Owner/);

  const o = sesi.owner.page;
  await o.goto("/sdm/setting-gaji");
  const ajuan = o.getByRole("list", { name: "Pengajuan setting gaji menunggu Owner" }).locator("li", { hasText: NAMA });
  await ajuan.getByRole("button", { name: /^Setujui/ }).click();
  await konfirmasi(o);
  await expect(toast(o)).toContainText(/disetujui\. Setting gaji Promosi Uji E2E berlaku mulai November 2026/);

  await isiPresensi(p, "2026-11-20", NOV);
  expect(await hitungDanGajiPokok(p, NOV)).toContain("3.800.000");
});

test("HRD mengajukan promosi berlaku bulan depan; Owner melihatnya di dashboard dan menyetujui", async () => {
  const p = sesi.hrd.page;
  await p.goto(`/sdm/setting-gaji?form=baru&karyawan=${kode}`);
  const f = p.getByRole("form", { name: "Form pengajuan setting gaji" });
  await expect(f.getByLabel("Jenis perubahan")).toHaveValue("PROMOSI");
  // Bawaan perubahan = bulan depan; slip draf November tidak terdampak.
  await expect(f.getByLabel("Bulan", { exact: true })).toHaveValue(String(DES.bulan));
  await pilihTeks(f, "Jabatan", "Event Manager");
  await pilihTeks(f, "Gaji pokok", "Golongan III");
  await expect(f.getByText(/slip Desember 2026 dan sesudahnya memakai setting ini\. Slip bulan sebelumnya tetap memakai setting lama/)).toBeVisible();
  // Pratinjau pengaman: memilih November menyebut slip draf yang perlu dihitung ulang.
  await f.getByLabel("Bulan", { exact: true }).selectOption(String(NOV.bulan));
  await expect(f.getByText(/Slip draf SLP-2026-11-.* perlu|HRD wajib menghitung ulang/).first()).toBeVisible();
  await f.getByLabel("Bulan", { exact: true }).selectOption(String(DES.bulan));
  await f.getByLabel("Alasan pengajuan").fill("Promosi menjadi Event Manager mulai Desember");
  await potret(p, "gaji-riwayat-form");
  await f.getByRole("button", { name: "Ajukan ke Owner" }).click();
  await expect(toast(p)).toContainText(/promosi Promosi Uji E2E, berlaku Desember 2026\) dikirim ke Owner/);

  const o = sesi.owner.page;
  await o.goto("/");
  const tindakan = o.locator(".kartu", { hasText: "Perlu tindakan" });
  await expect(tindakan.getByText(/\d+ pengajuan setting gaji menunggu keputusan/)).toBeVisible();
  // Grup menu yang tidak aktif tertutup dan menampilkan jumlah tertunda; dibuka dulu untuk melihat lencana Setting Gaji.
  const menu = o.getByRole("navigation", { name: "Menu utama" });
  const grup = menu.getByRole("button", { name: /^Siklus SDM: gaji inhouse/ }).first();
  if ((await grup.getAttribute("aria-expanded")) === "false") await grup.click();
  await expect(menu.getByRole("link", { name: /^Setting Gaji \d+ tertunda$/ })).toBeVisible();
  await potret(o, "gaji-riwayat-dashboard-owner");
  await tindakan.locator("li", { hasText: /pengajuan setting gaji/ }).getByRole("link", { name: /Buka/ }).click();
  await expect(o).toHaveURL(/\/sdm\/setting-gaji$/);
  const ajuan = o.getByRole("list", { name: "Pengajuan setting gaji menunggu Owner" }).locator("li", { hasText: NAMA });
  await expect(ajuan.getByText("Sebelum", { exact: true })).toBeVisible();
  await expect(ajuan.getByText("Sesudah", { exact: true })).toBeVisible();
  await expect(ajuan).toContainText("Golongan I Rp3.800.000");
  await expect(ajuan).toContainText("Golongan III Rp5.800.000");
  await expect(ajuan).toContainText("Berlaku mulai Bulan: Desember · Tahun: 2026");
  await potret(o, "gaji-riwayat-pengajuan-owner");
  await ajuan.getByRole("button", { name: /^Setujui/ }).click();
  await konfirmasi(o);
  await expect(toast(o)).toContainText(/berlaku mulai Desember 2026/);
});

test("slip bulan berjalan dihitung ulang tetap gaji lama, slip bulan berlaku memakai gaji baru", async () => {
  const p = sesi.hrd.page;
  expect(await hitungDanGajiPokok(p, NOV)).toContain("3.800.000");
  await isiPresensi(p, "2026-12-01", DES);
  expect(await hitungDanGajiPokok(p, DES)).toContain("5.800.000");
  await p.goto(`/sdm/gaji-bulanan?${q(DES)}`);
  await expect(p.getByRole("heading", { name: "Gaji Bulanan", level: 1 })).toBeVisible();
  await expect(p.getByText("Bulan: Desember · Tahun: 2026").first()).toBeVisible();
  // Setting yang berlaku tampil per baris: versi promosi berlaku Desember.
  await expect(p.getByRole("table", { name: "Gaji per karyawan" }).getByRole("row", { name: new RegExp(NAMA) })).toContainText("Golongan III");
  await potret(p, "gaji-riwayat-gaji-bulanan");
});

test("Owner menolak pengajuan dengan alasan; riwayat per karyawan menampilkannya", async () => {
  const p = sesi.hrd.page;
  await p.goto(`/sdm/setting-gaji?form=baru&karyawan=${kode}`);
  const f = p.getByRole("form", { name: "Form pengajuan setting gaji" });
  await f.getByLabel("Jenis perubahan").selectOption("PENYESUAIAN");
  await f.getByLabel(/Kesehatan/).check();
  // Tahun dipilih dulu; pilihan bulan mengikuti tahun itu.
  await f.getByLabel("Tahun", { exact: true }).selectOption("2027");
  await f.getByLabel("Bulan", { exact: true }).selectOption("1");
  await f.getByLabel("Alasan pengajuan").fill("Tambah tunjangan kesehatan");
  await f.getByRole("button", { name: "Ajukan ke Owner" }).click();
  await expect(toast(p)).toContainText(/berlaku Januari 2027\) dikirim ke Owner/);

  const o = sesi.owner.page;
  await o.goto("/sdm/setting-gaji");
  const ajuan = o.getByRole("list", { name: "Pengajuan setting gaji menunggu Owner" }).locator("li", { hasText: NAMA });
  await ajuan.getByRole("button", { name: /^Tolak/ }).click();
  await konfirmasi(o, "Anggaran tunjangan 2027 belum disetujui");
  await expect(toast(o)).toContainText(/ditolak\. Setting gaji Promosi Uji E2E tidak berubah/);

  await p.goto(`/sdm/setting-gaji?riwayat=${kode}#riwayat`);
  const riwayat = p.getByRole("table", { name: "Riwayat setting gaji" });
  await expect(riwayat.getByRole("row")).toHaveCount(4);
  await expect(riwayat.getByRole("row", { name: /Penyesuaian/ })).toContainText("Ditolak");
  await expect(riwayat.getByRole("row", { name: /Penyesuaian/ })).toContainText("Alasan tolak: Anggaran tunjangan 2027 belum disetujui");
  await expect(riwayat.getByRole("row", { name: /Promosi Uji E2E.*Promosi/ })).toContainText("Owner D'Production");
  await expect(p.getByRole("table", { name: "Setting gaji berlaku" }).getByRole("row", { name: new RegExp(NAMA) })).toContainText("Promosi mulai Desember 2026");
  await potret(p, "gaji-riwayat-setting");
});

test("filter Bulan dan Tahun di Buku Besar: tautan lama dialihkan, pilihan terpisah, judul layar dan cetak", async () => {
  const p = sesi.owner.page;
  await p.goto("/pelaporan/buku-besar?akun=1-110&periode=2026-10&tahap=setelah");
  await expect(p).toHaveURL(/\/pelaporan\/buku-besar\?akun=1-110&tahap=setelah&bulan=10&tahun=2026$/);
  await expect(p.locator("#pilih-bulan")).toHaveValue("10");
  await expect(p.locator("#pilih-tahun")).toHaveValue("2026");
  await expect(p.getByText("Bulan: Oktober · Tahun: 2026").first()).toBeVisible();
  await p.locator("#pilih-bulan").selectOption("11");
  await expect(p).toHaveURL(/akun=1-110/);
  await expect(p).toHaveURL(/bulan=11&tahun=2026/);
  await expect(p.getByText(/Saldo normal debit · Bulan: November · Tahun: 2026/)).toBeVisible();
  // Pilihan Bulan selalu 12 bulan; bulan tanpa data tampil kosong, tidak dialihkan ke bulan lain.
  await expect(p.locator("#pilih-bulan option")).toHaveCount(12);
  await p.locator("#pilih-bulan").selectOption("1");
  await expect(p).toHaveURL(/bulan=1&tahun=2026/);
  await expect(p.locator("#pilih-bulan")).toHaveValue("1");
  await p.locator("#pilih-bulan").selectOption("11");
  await expect(p).toHaveURL(/bulan=11&tahun=2026/);
  // Pilihan tahap membawa bulan dan tahun.
  await p.getByRole("link", { name: "Sebelum penyesuaian" }).click();
  await expect(p).toHaveURL(/bulan=11&tahun=2026/);
  await expect(p).toHaveURL(/tahap=sebelum/);
  await potret(p, "bulan-tahun-buku-besar", { cetak: true });
});

test("filter Bulan dan Tahun di Neraca Saldo: sampai akhir bulan, judul layar dan cetak", async () => {
  const p = sesi.owner.page;
  await p.goto("/pelaporan/neraca-saldo?periode=2026-10");
  await expect(p).toHaveURL(/\/pelaporan\/neraca-saldo\?bulan=10&tahun=2026$/);
  await expect(p.getByLabel("Sampai akhir bulan")).toHaveValue("10");
  await expect(p.getByText("Sampai akhir · Bulan: Oktober · Tahun: 2026")).toBeVisible();
  await p.getByLabel("Sampai akhir bulan").selectOption("11");
  await expect(p).toHaveURL(/bulan=11&tahun=2026/);
  await expect(p.getByText("Sampai akhir · Bulan: November · Tahun: 2026")).toBeVisible();
  await p.emulateMedia({ media: "print" });
  await expect(p.getByText("Saldo sampai akhir periode · Bulan: November · Tahun: 2026")).toBeVisible();
  await p.emulateMedia({ media: "screen" });
  await potret(p, "bulan-tahun-neraca-saldo", { cetak: true });
  expect(galatKonsol, galatKonsol.join("\n")).toEqual([]);
});
