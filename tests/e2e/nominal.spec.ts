/*
 * Uji E2E riwayat nominal master (gaji pokok berversi), dengan data sendiri supaya tidak bergantung pada spec lain:
 *  - HRD menambah golongan baru; nominal awal berlaku November menjadi pengajuan, Owner menyetujui.
 *  - HRD membuat karyawan baru dengan setting awal memakai golongan itu, presensi November dan Desember, slip November.
 *  - HRD mengajukan kenaikan gaji pokok berlaku bulan depan (Desember); Owner melihatnya di dashboard dan menyetujui.
 *  - Slip November dihitung ulang tetap gaji lama, slip Desember memakai gaji baru, dan slip menyebut versi asalnya.
 * Potret 1440 dan 390 (nominal-*.png) disimpan di POTRET.
 */
import fs from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? 3200}`;
const POTRET = process.env.E2E_POTRET_NOMINAL ?? "artefak-uji/potret";
const galatKonsol: string[] = [];
const GOLONGAN = "Golongan Uji Nominal";
const NAMA = "Nominal Uji E2E";
const NOV = { bulan: 11, tahun: 2026 };
const DES = { bulan: 12, tahun: 2026 };

type Sesi = { ctx: BrowserContext; page: Page };
const sesi: Record<"hrd" | "owner", Sesi> = {} as never;
let kode = "";
let gp = "";

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
const bagian = (p: Page, judul: string) => p.getByRole("region", { name: judul, exact: true });

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

/** Hitung (atau hitung ulang) slip karyawan uji, buka slipnya, dan kembalikan teks baris gaji pokok (nominal + sumber versi). */
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

test("HRD menambah golongan baru: nominal awal November menunggu Owner, lalu disetujui", async () => {
  const p = sesi.hrd.page;
  await p.goto("/master/sdm?tab=struktur&jenis=golongan&form=baru#bagian-golongan");
  const f = p.getByRole("form", { name: "Form Gaji pokok" });
  await f.getByLabel("Golongan").fill(GOLONGAN);
  await f.getByLabel("Gaji pokok (Rp)").fill("4000000");
  await f.getByLabel("Bulan", { exact: true }).selectOption(String(NOV.bulan));
  await f.getByLabel("Tahun", { exact: true }).selectOption(String(NOV.tahun));
  await f.getByRole("button", { name: "Simpan" }).click();
  await expect(toast(p)).toContainText(/Gaji pokok GP-\d+ tersimpan\. Nominal awal NOM-\d{4} \(berlaku November 2026\) menunggu persetujuan Owner/);
  gp = (await toast(p).innerText()).match(/GP-\d+/)![0];

  const o = sesi.owner.page;
  await o.goto("/master/sdm?tab=struktur");
  const ajuan = o.getByRole("list", { name: "Pengajuan nominal menunggu Owner" }).locator("li", { hasText: GOLONGAN });
  await expect(ajuan).toContainText("Belum ada nominal berlaku");
  await ajuan.getByRole("button", { name: /^Setujui/ }).click();
  await konfirmasi(o);
  await expect(toast(o)).toContainText(new RegExp(`disetujui\\. Gaji pokok ${GOLONGAN} berlaku mulai November 2026`));
});

test("karyawan baru memakai golongan itu: setting awal November disetujui, slip November Rp4.000.000", async () => {
  const p = sesi.hrd.page;
  await p.goto("/master/sdm?tab=karyawan&form=baru");
  const fk = p.getByRole("form", { name: "Form Karyawan" });
  await fk.getByLabel(/^Nama( \*)?$/).fill(NAMA);
  await fk.getByLabel("Status PTKP").selectOption("TK0");
  await fk.getByLabel("Bank").selectOption("BRI");
  await fk.getByLabel("No. rekening").fill("1122334455");
  await fk.getByRole("button", { name: "Simpan" }).click();
  await expect(toast(p)).toContainText(/Karyawan KRY-\d+ tersimpan/);
  kode = (await toast(p).innerText()).match(/KRY-\d+/)![0];

  await p.goto(`/sdm/setting-gaji?form=baru&karyawan=${kode}`);
  const f = p.getByRole("form", { name: "Form pengajuan setting gaji" });
  await pilihTeks(f, "Jabatan", "Crew Produksi");
  await pilihTeks(f, "Gaji pokok", GOLONGAN);
  await f.getByLabel("Bulan", { exact: true }).selectOption(String(NOV.bulan));
  await f.getByLabel("Alasan pengajuan").fill("Karyawan baru untuk uji riwayat nominal");
  await f.getByRole("button", { name: "Ajukan ke Owner" }).click();
  await expect(toast(p)).toContainText(/dikirim ke Owner/);
  const o = sesi.owner.page;
  await o.goto("/sdm/setting-gaji");
  await o.getByRole("list", { name: "Pengajuan setting gaji menunggu Owner" }).locator("li", { hasText: NAMA }).getByRole("button", { name: /^Setujui/ }).click();
  await konfirmasi(o);
  await expect(toast(o)).toContainText(/berlaku mulai November 2026/);

  await isiPresensi(p, "2026-11-20", NOV);
  await isiPresensi(p, "2026-12-01", DES);
  const nov = await hitungDanGajiPokok(p, NOV);
  expect(nov).toContain("4.000.000");
  expect(nov).toContain(`Gaji pokok ${GOLONGAN}, berlaku mulai November 2026`);
});

test("HRD mengajukan kenaikan gaji pokok berlaku bulan depan; Owner melihatnya di dashboard dan menyetujui", async () => {
  const p = sesi.hrd.page;
  await p.goto("/master/sdm?tab=struktur");
  const gol = bagian(p, "Golongan (gaji pokok)");
  await gol.getByRole("row", { name: new RegExp(gp) }).getByRole("link", { name: "Ajukan nominal" }).click();
  const f = p.getByRole("form", { name: `Form ajukan perubahan nominal ${GOLONGAN}` });
  await expect(f).toBeVisible();
  await expect(f).toContainText("Berlaku November 2026: Rp4.000.000");
  // Bawaan berlaku bulan depan; nilai awal isian = nominal yang berlaku sekarang.
  await expect(f.getByLabel("Bulan", { exact: true })).toHaveValue(String(DES.bulan));
  await expect(f.getByLabel("Tahun", { exact: true })).toHaveValue(String(DES.tahun));
  await expect(f.getByLabel("Gaji pokok per bulan (Rp)")).toHaveValue("4.000.000");
  await f.getByLabel("Gaji pokok per bulan (Rp)").fill("4500000");
  await expect(f.getByText(/slip gaji mulai Desember 2026 memakai nominal baru.*Rp4\.000\.000 menjadi Rp4\.500\.000/)).toBeVisible();
  await f.getByLabel("Alasan perubahan").fill("Penyesuaian UMK 2027 mulai Desember");
  await potret(p, "nominal-form");
  // Alasan wajib: galat tampil di isiannya.
  await f.getByLabel("Alasan perubahan").fill("");
  await f.getByRole("button", { name: "Ajukan ke Owner" }).click();
  await expect(f.getByText("Tulis alasan perubahan, minimal 5 karakter.")).toBeVisible();
  await f.getByLabel("Alasan perubahan").fill("Penyesuaian UMK 2027 mulai Desember");
  await f.getByRole("button", { name: "Ajukan ke Owner" }).click();
  await expect(toast(p)).toContainText(new RegExp(`Pengajuan NOM-\\d{4} \\(gaji pokok ${GOLONGAN}, berlaku Desember 2026\\) dikirim ke Owner`));
  await expect(gol.getByRole("row", { name: new RegExp(gp) })).toContainText("Menunggu Owner: Rp4.500.000 mulai Desember 2026");

  const o = sesi.owner.page;
  await o.goto("/");
  const tindakan = o.locator(".kartu", { hasText: "Perlu tindakan" });
  await expect(tindakan.getByText(/\d+ pengajuan nominal gaji atau tarif menunggu keputusan/)).toBeVisible();
  await expect(tindakan).toContainText(`Gaji pokok ${GOLONGAN} (berlaku Desember 2026)`);
  await potret(o, "nominal-dashboard-owner");
  await tindakan.locator("li", { hasText: /pengajuan nominal/ }).getByRole("link", { name: /Buka/ }).click();
  await expect(o).toHaveURL(/\/master\/sdm\?tab=struktur$/);
  const ajuan = o.getByRole("list", { name: "Pengajuan nominal menunggu Owner" }).locator("li", { hasText: GOLONGAN });
  await expect(ajuan).toContainText("Rp4.000.000, berlaku sejak November 2026");
  await expect(ajuan).toContainText("Rp4.500.000, berlaku mulai Desember 2026");
  await expect(ajuan).toContainText("Penyesuaian UMK 2027 mulai Desember");
  await potret(o, "nominal-pengajuan-owner");
  await ajuan.getByRole("button", { name: /^Setujui/ }).click();
  await konfirmasi(o);
  await expect(toast(o)).toContainText(new RegExp(`disetujui\\. Gaji pokok ${GOLONGAN} berlaku mulai Desember 2026`));
  // Bulan ini tetap Rp4.000.000, versi berikutnya tampil di kolom riwayat.
  const baris = bagian(o, "Golongan (gaji pokok)").getByRole("row", { name: new RegExp(gp) });
  await expect(baris).toContainText("4.000.000");
  await expect(baris).toContainText("Mulai Desember 2026: Rp4.500.000");
  await baris.getByRole("link", { name: "Riwayat" }).click();
  const riwayat = o.getByRole("table", { name: `Riwayat nominal ${GOLONGAN}` });
  await expect(riwayat.getByRole("row")).toHaveCount(3);
  await expect(riwayat.getByRole("row", { name: /Rp4\.500\.000/ })).toContainText("Disetujui, belum berlaku");
  await potret(o, "nominal-struktur-riwayat");
});

test("slip November dihitung ulang tetap gaji lama, slip Desember memakai gaji baru dan menyebut versinya", async () => {
  const p = sesi.hrd.page;
  const nov = await hitungDanGajiPokok(p, NOV);
  expect(nov).toContain("4.000.000");
  expect(nov).toContain("berlaku mulai November 2026");
  const des = await hitungDanGajiPokok(p, DES);
  expect(des).toContain("4.500.000");
  expect(des).toContain(`Gaji pokok ${GOLONGAN}, berlaku mulai Desember 2026`);
  await potret(p, "nominal-slip", { cetak: true });

  await p.goto(`/sdm/gaji-bulanan?${q(DES)}`);
  await expect(p.getByRole("table", { name: "Gaji per karyawan" }).getByRole("row", { name: new RegExp(NAMA) })).toContainText("estimasi");
  await potret(p, "nominal-gaji-bulanan");
  expect(galatKonsol, galatKonsol.join("\n")).toEqual([]);
});
