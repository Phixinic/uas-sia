/*
 * Uji E2E sumber investasi pada pembelian: Admin memilih cara bayar Investasi dengan sumber Investor (tanpa supplier),
 * pratinjau jurnal berubah ke 3-120 Modal Investor, lalu Simpan & posting. Rincian dan daftar memberi label
 * "Investasi (Investor)", kas tidak berubah, dan ringkasan "Dari mana kas dan modal" sama dengan Buku Besar 3-120.
 * Potret 1440 dan 390 (form, rincian, ringkasan modal) di artefak-uji/potret/. Jalan sesudah investasi-kas.spec.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? 3200}`;
const POTRET = process.env.E2E_POTRET_INVESTASI ?? path.resolve(__dirname, "../../artefak-uji/potret");
const HARGA = 15_000_000;
const galatKonsol: string[] = [];

type Sesi = { ctx: BrowserContext; page: Page };
const sesi: Record<string, Sesi> = {};

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

const angkaDari = (t: string) => Number(t.replace(/[^\d-]/g, ""));

/** Potret 1440 dan 390; di 390 halaman tidak boleh menggulir ke samping. */
async function potret(p: Page, nama: string, elemen?: Locator) {
  fs.mkdirSync(POTRET, { recursive: true });
  for (const lebar of [1440, 390]) {
    await p.setViewportSize({ width: lebar, height: lebar === 390 ? 844 : 900 });
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(500);
    expect(await p.evaluate(() => document.documentElement.scrollWidth), `${nama} scrollWidth di ${lebar}`).toBeLessThanOrEqual(lebar);
    const file = `${POTRET}/${nama}-${lebar}.png`;
    if (elemen) await elemen.screenshot({ path: file });
    else await p.screenshot({ path: file, fullPage: true });
  }
  await p.setViewportSize({ width: 1440, height: 900 });
}

/** Nilai baris ringkasan (angka di kepala item, bukan rincian di dalam <details>). */
const nilaiBaris = async (r: Locator, label: string | RegExp) => angkaDari(await r.locator("li", { hasText: label }).last().locator(":scope > div").first().locator(".angka").last().innerText());

const saldoBuku = async (p: Page, akun: string) => {
  await p.goto(`/pelaporan/buku-besar?akun=${akun}&periode=2026-11`);
  return angkaDari(await p.locator("tr", { hasText: "Saldo akhir" }).first().locator("td").last().innerText());
};

test.describe.configure({ mode: "serial" });

let no = "";
let kasSebelum = 0;
let investorSebelum = 0;

test.beforeAll(async ({ browser }) => {
  sesi.admin = await bukaSesi(browser, "admin", "admin123");
  sesi.owner = await bukaSesi(browser, "owner", "owner123");
});

test.afterAll(async () => {
  for (const s of Object.values(sesi)) await s.ctx.close();
});

test("Admin: Investasi memunculkan Sumber investasi (bawaan Pemilik), Investor mengubah pratinjau ke 3-120", async () => {
  const o = sesi.owner.page;
  kasSebelum = await saldoBuku(o, "1-110");
  investorSebelum = await saldoBuku(o, "3-120");

  const p = sesi.admin.page;
  await p.goto("/konversi/pembelian-peralatan?form=baru");
  await expect(p.locator("#sumberInvestasi")).toHaveCount(0);
  await p.locator("#caraBayar").selectOption("INVESTASI");
  const sumber = p.getByLabel("Sumber investasi");
  await expect(sumber).toBeVisible();
  await expect(sumber).toHaveValue("PEMILIK");
  await expect(p.getByText(/lawan jurnalnya Modal Pemilik 3-110/)).toBeVisible();

  await p.locator("#tanggal").fill("2026-11-12");
  await p.locator("#baris-0-barang").selectOption({ index: 1 });
  await p.locator("#baris-0-qty").fill("1");
  await p.locator("#baris-0-harga").fill(String(HARGA));
  await p.locator("#baris-0-garansi").fill("12");
  const jurnal = p.getByRole("table", { name: "Baris jurnal" });
  await expect(jurnal).toContainText("3-110");

  await sumber.selectOption("INVESTOR");
  await expect(p.getByText(/lawan jurnalnya Modal Investor 3-120/)).toBeVisible();
  await expect(jurnal).toContainText("3-120");
  await expect(jurnal).not.toContainText("3-110");
  await expect(p.locator("#supplierKode option").first()).toHaveText("Tanpa supplier (setoran investor)");
  await potret(p, "pembelian-investasi-investor-form");
});

test("Admin: Simpan & posting; rincian dan daftar berlabel Investasi (Investor), jurnal Kr 3-120", async () => {
  const p = sesi.admin.page;
  await p.getByRole("button", { name: "Simpan & posting" }).click();
  const d = p.getByRole("dialog");
  await expect(d).toBeVisible();
  await d.locator('button[type="submit"]').click();
  await p.waitForURL(/lihat=BP-/);
  no = new URL(p.url()).searchParams.get("lihat") ?? "";
  expect(no).toMatch(/^BP-2026-\d{4}$/);
  await expect(p.getByText("Investasi (Investor)").first()).toBeVisible();
  await expect(p.getByText("Setoran investor").first()).toBeVisible();
  const baris = p.getByRole("row", { name: new RegExp(no) });
  await expect(baris).toContainText("Investasi (Investor)");
  await expect(baris).toContainText("Diposting");
  await potret(p, "pembelian-investasi-investor-rincian");

  await p.goto("/pelaporan/jurnal-umum?periode=2026-11");
  await expect(p.getByText(`Pembelian peralatan ${no}, Setoran investor (Investasi, Investor)`).first()).toBeVisible();
});

test("Owner: kas tetap, Buku Besar 3-120 bertambah, ringkasan modal investor sama dengan buku besar", async () => {
  const p = sesi.owner.page;
  expect(await saldoBuku(p, "1-110")).toBe(kasSebelum);
  const investor = await saldoBuku(p, "3-120");
  expect(investor).toBe(investorSebelum + HARGA);

  await p.goto("/modal/investasi-kas?periode=2026-11");
  const r = p.getByRole("region", { name: "Modal investor dan hibah" });
  expect(await nilaiBaris(r, "Setoran barang (Investasi, sumber Investor)")).toBe(HARGA);
  expect(await nilaiBaris(r, "Modal Investor akhir November 2026")).toBe(investor);
  await expect(r.getByText("sama dengan buku besar")).toHaveCount(2);
  await expect(r.getByText("beda dengan buku besar")).toHaveCount(0);
  await expect(p.getByRole("region", { name: "Modal Pemilik" }).getByText("sama dengan buku besar")).toBeVisible();
  await expect(p.getByRole("region", { name: "Arus kas" }).getByText("sama dengan buku besar")).toBeVisible();
  // Rincian menunjuk dokumen pembeliannya.
  await r.getByText(/Rincian 1 jurnal/).first().click();
  await expect(r.getByText(no).first()).toBeVisible();
  await potret(p, "modal-investor-ringkasan", p.getByRole("region", { name: "Modal Pemilik" }).locator("xpath=.."));
  await potret(p, "investasi-kas-dengan-investor");
});

test("tanpa galat konsol", async () => {
  expect(galatKonsol).toEqual([]);
});
