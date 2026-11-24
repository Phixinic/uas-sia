/*
 * Uji E2E tab Struktur gaji (Master SDM) dan potret halaman status persetujuan penyusutan dan nilai sisa.
 * - Tautan lama ?tab=jabatan, jabatanEvent, golongan, tunjangan dialihkan ke tab Struktur gaji.
 * - HRD mengubah nama golongan (form ubah tanpa nominal) dan mengajukan perubahan gaji pokok; jabatan event hanya bisa
 *   dilihat. Owner mengajukan dan menyetujui perubahan tarif jabatan event (riwayat nominal).
 * - Admin hanya melihat.
 * Dijalankan sesudah alur.spec.ts (urutan nama berkas), jadi penyusutan November sudah diproses (langsung disetujui) dan
 * disetujui. Potret 1440 dan 390 disimpan di E2E_POTRET (bawaan /tmp/sia-e2e/struktur-gaji).
 */
import fs from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? 3200}`;
const POTRET = process.env.E2E_POTRET ?? "/tmp/sia-e2e/struktur-gaji";
const galatKonsol: string[] = [];

type Sesi = { ctx: BrowserContext; page: Page };
const sesi: Record<"admin" | "hrd" | "owner", Sesi> = {} as never;

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

async function buka(p: Page, alamat: string) {
  await p.goto(alamat);
  await expect(p.locator("main h1").first()).toBeVisible();
  await p.waitForLoadState("networkidle");
}

/** Potret 1440 dan 390. Di 390 halaman tidak boleh melebar (scrollWidth <= 390); tabel lebar menggulir di pembungkusnya. */
async function potret(p: Page, nama: string) {
  fs.mkdirSync(POTRET, { recursive: true });
  for (const lebar of [1440, 390]) {
    await p.setViewportSize({ width: lebar, height: lebar === 390 ? 844 : 900 });
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(500);
    const lebih = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(lebih, `${nama} melebar ${lebih}px di ${lebar}`).toBeLessThanOrEqual(1);
    if (lebar === 390) expect(await p.evaluate(() => document.documentElement.scrollWidth), `${nama} scrollWidth di 390`).toBeLessThanOrEqual(390);
    await p.screenshot({ path: `${POTRET}/${nama}-${lebar}.png`, fullPage: true });
  }
  await p.setViewportSize({ width: 1440, height: 900 });
}

const bagian = (p: Page, judul: string) => p.getByRole("region", { name: judul, exact: true });

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  sesi.admin = await bukaSesi(browser, "admin", "admin123");
  sesi.hrd = await bukaSesi(browser, "hrd", "hrd12345");
  sesi.owner = await bukaSesi(browser, "owner", "owner123");
});

test.afterAll(async () => {
  for (const s of Object.values(sesi)) await s.ctx.close();
  if (galatKonsol.length) console.log("Galat konsol:\n" + galatKonsol.join("\n"));
});

test("navigasi Master SDM: empat tab, tautan lama dialihkan ke Struktur gaji", async () => {
  const p = sesi.owner.page;
  await buka(p, "/master/sdm");
  const nav = p.getByRole("navigation", { name: "Jenis master" });
  await expect(nav.getByRole("link")).toHaveText(["Karyawan", "Struktur gaji", "Jadwal kerja", "Setting gaji"]);
  await nav.getByRole("link", { name: "Struktur gaji" }).click();
  await expect(p).toHaveURL(/\/master\/sdm\?tab=struktur/);
  for (const judul of ["Ringkasan struktur gaji", "Jabatan", "Golongan (gaji pokok)", "Tunjangan lain"]) await expect(bagian(p, judul)).toBeVisible();
  // Satu tabel Jabatan dengan kolom Kelompok dan saringan Semua, Inhouse, Event.
  const jab = bagian(p, "Jabatan");
  await expect(jab.getByRole("row", { name: /Kapten Event/ })).toContainText("Event");
  await expect(jab.getByRole("row", { name: /JBT-01/ })).toContainText("Inhouse");
  await jab.getByRole("navigation", { name: "Saring kelompok jabatan" }).getByRole("link", { name: /^Event/ }).click();
  await expect(p).toHaveURL(/kelompok=EVENT/);
  await expect(bagian(p, "Jabatan").getByRole("row", { name: /JBT-01/ })).toHaveCount(0);
  await expect(bagian(p, "Jabatan").getByRole("row", { name: /Kapten Event/ })).toBeVisible();
  await potret(p, "master-jabatan-satu-tabel");
  for (const [lama, judul] of [["jabatan", "Jabatan"], ["jabatanEvent", "Jabatan"], ["golongan", "Golongan (gaji pokok)"], ["tunjangan", "Tunjangan lain"]]) {
    await buka(p, `/master/sdm?tab=${lama}`);
    await expect(p).toHaveURL(new RegExp(`tab=struktur&jenis=${lama}`));
    await expect(bagian(p, judul)).toBeVisible();
  }
  // Tautan lama dengan form tetap membuka form yang sama.
  await buka(p, "/master/sdm?tab=golongan&form=GP-02");
  await expect(p.getByRole("form", { name: "Form Gaji pokok" })).toBeVisible();
  await expect(p.getByRole("form", { name: "Form Gaji pokok" }).getByLabel("Golongan")).toHaveValue("Golongan II");
});

test("HRD mengubah golongan dan mengajukan gaji pokok baru; jabatan event hanya bisa dilihat", async () => {
  const p = sesi.hrd.page;
  await buka(p, "/master/sdm?tab=struktur");
  const gol = bagian(p, "Golongan (gaji pokok)");
  await gol.getByRole("row", { name: /GP-01/ }).getByRole("link", { name: "Ubah" }).click();
  const f = p.getByRole("form", { name: "Form Gaji pokok" });
  await expect(f).toBeVisible();
  // Form ubah tidak memuat nominal: nominal punya riwayat dan diubah lewat pengajuan.
  await expect(f.getByLabel("Gaji pokok (Rp)")).toHaveCount(0);
  await expect(f).toContainText("Ajukan nominal");
  await f.getByRole("button", { name: "Batal" }).click();
  await gol.getByRole("row", { name: /GP-01/ }).getByRole("link", { name: "Ajukan nominal" }).click();
  const fn = p.getByRole("form", { name: "Form ajukan perubahan nominal Golongan I" });
  await fn.getByLabel("Gaji pokok per bulan (Rp)").fill("3950000");
  await fn.getByLabel("Alasan perubahan").fill("Penyesuaian gaji pokok Golongan I");
  await fn.getByRole("button", { name: "Ajukan ke Owner" }).click();
  await expect(fn).toBeHidden();
  // Bulan ini tetap nominal lama; pengajuan tampil di kolom riwayat dan daftar pengajuan.
  await expect(gol.getByRole("row", { name: /GP-01/ })).toContainText("3.800.000");
  await expect(gol.getByRole("row", { name: /GP-01/ })).toContainText("Menunggu Owner: Rp3.950.000 mulai Desember 2026");
  await expect(p.getByRole("list", { name: "Pemakaian per golongan" }).locator("li", { hasText: "Golongan I" }).first()).toContainText("3.800.000");

  const ev = bagian(p, "Jabatan");
  await expect(ev).toContainText("hanya bisa melihat jabatan event");
  await expect(ev.getByRole("row", { name: /Kapten Event/ }).getByRole("link", { name: "Ubah" })).toHaveCount(0);
  await expect(p.getByRole("link", { name: "Jabatan event baru" })).toHaveCount(0);
  await expect(ev.getByRole("link", { name: "Jabatan baru" })).toBeVisible();
  await expect(p.getByRole("button", { name: "Nonaktifkan" })).toHaveCount(0);
  await potret(p, "struktur-gaji-hrd");
});

test("Owner mengajukan dan menyetujui tarif Crew Event baru lewat Struktur gaji", async () => {
  const p = sesi.owner.page;
  await buka(p, "/master/sdm?tab=struktur");
  const ev = bagian(p, "Jabatan");
  await ev.getByRole("row", { name: /JBT-06/ }).getByRole("link", { name: "Ajukan nominal" }).click();
  const f = p.getByRole("form", { name: "Form ajukan perubahan nominal Crew Event" });
  await expect(f).toBeVisible();
  await f.getByLabel("Tarif per jam (Rp)").fill("22000");
  await f.getByLabel("Alasan perubahan").fill("Tarif crew musim akhir tahun");
  await f.getByRole("button", { name: "Ajukan ke Owner" }).click();
  await expect(f).toBeHidden();
  const ajuan = p.getByRole("list", { name: "Pengajuan nominal menunggu Owner" }).locator("li", { hasText: "Crew Event" });
  await ajuan.getByRole("button", { name: /^Setujui/ }).click();
  const d = p.getByRole("dialog");
  await d.locator('button[type="submit"]').click();
  await expect(d).toBeHidden();
  // Tarif bulan ini tetap; tarif baru tampil sebagai versi berikutnya.
  await expect(ev.getByRole("row", { name: /JBT-06/ })).toContainText("20.000");
  await expect(ev.getByRole("row", { name: /JBT-06/ })).toContainText("Mulai Desember 2026: Rp22.000/jam");
  await expect(ev.getByRole("row", { name: /JBT-05/ })).toContainText("200.000");
  await potret(p, "struktur-gaji-owner");
});

test("Admin hanya melihat Struktur gaji", async () => {
  const p = sesi.admin.page;
  await buka(p, "/master/sdm?tab=struktur");
  await expect(p.getByText("hanya bisa melihat struktur gaji")).toBeVisible();
  await expect(p.getByRole("link", { name: /baru$/ })).toHaveCount(0);
  await expect(p.getByRole("link", { name: "Ubah" })).toHaveCount(0);
});

test("potret status persetujuan: Proses Penyusutan (Admin, Owner) dan Nilai Sisa", async () => {
  for (const peran of ["admin", "owner"] as const) {
    const p = sesi[peran].page;
    await buka(p, "/konversi/penyusutan?periode=2026-11");
    const panel = p.getByRole("region", { name: "Jurnal penyusutan November 2026" });
    await expect(panel).toContainText("Disetujui");
    await expect(p.getByRole("region", { name: "Riwayat proses penyusutan" }).getByRole("row", { name: /Disetujui/ }).first()).toContainText("Diproses");
    await potret(p, `penyusutan-status-${peran}`);
  }
  for (const peran of ["admin", "owner"] as const) {
    const p = sesi[peran].page;
    await buka(p, "/konversi/nilai-sisa?periode=2026-11");
    await expect(p.getByRole("region", { name: "Jurnal biaya perlengkapan November 2026" })).toContainText("Disetujui");
    await potret(p, `penyusutan-status-nilai-sisa-${peran}`);
  }
});

test("tidak ada galat konsol", async () => {
  expect(galatKonsol, galatKonsol.join("\n")).toEqual([]);
});
