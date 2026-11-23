/*
 * Uji E2E Investasi Kas dan label biaya tetap/variabel: akses terlarang (HRD, Kapten), Admin mencatat setoran, Owner
 * melihatnya di "Perlu tindakan" lalu menyetujui, jurnal muncul di Jurnal Umum, dan ringkasan "Dari mana kas dan modal"
 * sama dengan saldo Buku Besar akun Kas dan Modal Pemilik. Ditambah potret 1440 dan 390 (Investasi Kas, Hitung Gaji,
 * slip gaji layar dan cetak, slip fee, ringkasan biaya SDM) di artefak-uji/potret/.
 * Dijalankan sesudah alur.spec.ts dan fee-event.spec.ts di database uji yang sama, jadi nomor dokumen tidak dipatok.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? 3200}`;
const POTRET = process.env.E2E_POTRET_INVESTASI ?? path.resolve(__dirname, "../../artefak-uji/potret");
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
const tungguToast = (p: Page, pola: RegExp) => expect(p.getByRole("status")).toContainText(pola);
const menu = (p: Page) => p.getByRole("navigation", { name: "Menu utama" });

async function konfirmasi(p: Page, alasan?: string) {
  const d = p.getByRole("dialog");
  await expect(d).toBeVisible();
  if (alasan) await d.getByLabel(/Alasan/).fill(alasan);
  await d.locator('button[type="submit"]').click();
  await expect(d).toBeHidden();
}

/**
 * Potret 1440 dan 390 ke artefak-uji/potret/<nama>-<lebar>.png. Di 390 scrollWidth halaman harus <= 390 dan, bila
 * `tanpaGeser`, tidak ada tabel tampil yang menggulir ke samping (daftar harus berupa kartu).
 */
async function potret(p: Page, nama: string, opsi: { tanpaGeser?: boolean; elemen?: Locator } = {}) {
  fs.mkdirSync(POTRET, { recursive: true });
  for (const lebar of [1440, 390]) {
    await p.setViewportSize({ width: lebar, height: lebar === 390 ? 844 : 900 });
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(500);
    const lebarGulir = await p.evaluate(() => document.documentElement.scrollWidth);
    expect(lebarGulir, `${nama} scrollWidth di ${lebar}`).toBeLessThanOrEqual(lebar);
    if (lebar === 390 && opsi.tanpaGeser !== false) {
      const meluap = await p.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("main .bungkus-tabel, main table")]
          .filter((el) => el.checkVisibility() && el.getBoundingClientRect().width > 0)
          .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
          .map((el) => el.getAttribute("aria-label") ?? el.className),
      );
      expect(meluap, `${nama}: tabel meluap atau bergeser di 390`).toEqual([]);
    }
    const file = `${POTRET}/${nama}-${lebar}.png`;
    if (opsi.elemen) await opsi.elemen.screenshot({ path: file });
    else await p.screenshot({ path: file, fullPage: true });
  }
  await p.setViewportSize({ width: 1440, height: 900 });
}

test.describe.configure({ mode: "serial" });

let no = "";
const JUMLAH = 7_500_000;

test.beforeAll(async ({ browser }) => {
  sesi.admin = await bukaSesi(browser, "admin", "admin123");
  sesi.owner = await bukaSesi(browser, "owner", "owner123");
  sesi.hrd = await bukaSesi(browser, "hrd", "hrd12345");
  sesi.kapten = await bukaSesi(browser, "kapten", "kapten123");
});

test.afterAll(async () => {
  for (const s of Object.values(sesi)) await s.ctx.close();
});

test("akses: HRD dan Kapten tidak melihat menu Investasi Kas dan ditolak halamannya", async () => {
  for (const u of ["hrd", "kapten"]) {
    const p = sesi[u].page;
    await p.goto("/");
    await expect(menu(p).getByRole("link", { name: /^Investasi Kas/ })).toHaveCount(0);
    await expect(menu(p).getByRole("button", { name: /^Modal pemilik/ })).toHaveCount(0);
    await p.goto("/modal/investasi-kas");
    await expect(p).toHaveURL(/\/tanpa-akses/);
  }
});

test("menu: grup Modal pemilik di atas Siklus konversi; label SDM biaya tetap dan biaya variabel", async () => {
  const p = sesi.admin.page;
  await p.goto("/");
  // textContent, bukan innerText: judul grup ditampilkan huruf kapital lewat CSS.
  const judul = (await menu(p).getByRole("button").evaluateAll((el) => el.map((e) => e.textContent ?? ""))).map((t) => t.trim());
  const iModal = judul.findIndex((t) => t.startsWith("Modal pemilik"));
  expect(iModal).toBeGreaterThan(-1);
  expect(iModal).toBeLessThan(judul.findIndex((t) => t.startsWith("Siklus konversi")));
  expect(judul.some((t) => t.startsWith("Siklus SDM: gaji inhouse (biaya tetap)"))).toBe(true);
  expect(judul.some((t) => t.startsWith("Siklus SDM: fee event (biaya variabel)"))).toBe(true);
});

test("Admin mencatat setoran: galat per isian, lalu DIAJUKAN tanpa tombol keputusan", async () => {
  const p = sesi.admin.page;
  await p.goto("/");
  const tombolGrup = menu(p).getByRole("button", { name: /^Modal pemilik/ });
  if ((await tombolGrup.getAttribute("aria-expanded")) === "false") await tombolGrup.click();
  await menu(p).getByRole("link", { name: /^Investasi Kas/ }).click();
  await expect(p.getByRole("heading", { name: "Investasi Kas", level: 1 })).toBeVisible();
  await p.getByRole("link", { name: "Catat setoran" }).click();
  const f = p.getByRole("form", { name: "Catat setoran modal" });
  await f.getByRole("button", { name: "Ajukan ke Owner" }).click();
  await expect(f.getByText("Jumlah setoran harus lebih dari 0.")).toBeVisible();
  await expect(f.getByLabel("Jumlah (Rp)")).toBeFocused();
  await f.getByLabel("Jumlah (Rp)").fill(String(JUMLAH));
  await f.getByLabel("Keterangan atau sumber dana").fill("Setoran pemilik dari rekening pribadi (uji E2E)");
  await expect(f.getByRole("table", { name: "Baris jurnal" })).toContainText("7.500.000");
  await f.getByRole("button", { name: "Ajukan ke Owner" }).click();
  await tungguToast(p, /INV-2026-\d{4} dicatat dan menunggu keputusan Owner/);
  no = (await p.getByRole("status").innerText()).match(/INV-2026-\d{4}/)![0];
  const baris = p.getByRole("table", { name: "Daftar setoran" }).getByRole("row", { name: new RegExp(no) });
  await expect(baris).toContainText("Diajukan");
  await expect(baris.getByRole("button", { name: /Setujui/ })).toHaveCount(0);
});

test("Owner: setoran muncul di Perlu tindakan dan lencana menu, lalu disetujui dengan jurnal Dr Kas, Kr Modal", async () => {
  const p = sesi.owner.page;
  await p.goto("/");
  const tindakan = p.locator(".kartu", { hasText: "Perlu tindakan" });
  await expect(tindakan.getByText(/1 setoran modal menunggu keputusan/)).toBeVisible();
  // Grup menu yang tidak aktif tertutup (tautannya tersembunyi), jadi dibuka dulu sebelum lencana tertundanya diperiksa.
  const grupModal = menu(p).getByRole("button", { name: /^Modal pemilik/ });
  if ((await grupModal.getAttribute("aria-expanded")) === "false") await grupModal.click();
  await expect(menu(p).locator('a[href="/modal/investasi-kas"] [aria-label="1 tertunda"]')).toBeVisible();
  await tindakan.locator("li", { hasText: /setoran modal menunggu keputusan/ }).getByRole("link", { name: /Buka/ }).click();
  await expect(p).toHaveURL(/\/modal\/investasi-kas/);
  const baris = p.getByRole("table", { name: "Daftar setoran" }).getByRole("row", { name: new RegExp(no) });
  await baris.getByRole("button", { name: `Setujui ${no}` }).click();
  await expect(p.getByRole("dialog")).toContainText("Debit Kas Rp7.500.000, Kredit Modal Pemilik Rp7.500.000");
  await konfirmasi(p);
  await tungguToast(p, new RegExp(`${no} disetujui. Jurnal JU-2026-\\d{4} dibuat`));
  await expect(baris).toContainText("Disetujui");
  const jurnal = (await baris.locator(".kode", { hasText: /^JU-2026-/ }).innerText()).trim();
  await p.goto("/pelaporan/jurnal-umum?periode=2026-11");
  const blok = p.getByText(`Setoran modal pemilik ${no}`).first();
  await expect(blok).toBeVisible();
  await expect(p.getByText(jurnal).first()).toBeVisible();
});

test("ringkasan Dari mana kas dan modal = Buku Besar Kas dan Modal Pemilik (November dan kumulatif)", async () => {
  const p = sesi.owner.page;
  await p.goto("/modal/investasi-kas?periode=2026-11");
  const kas = p.getByRole("region", { name: "Arus kas" });
  const modal = p.getByRole("region", { name: "Modal Pemilik" });
  const biaya = p.getByRole("region", { name: "Biaya SDM" });
  // Nilai baris = angka di baris kepala item (bukan angka rincian di dalam <details> yang tertutup).
  const nilaiBaris = async (r: Locator, label: string | RegExp) => angkaDari(await r.locator("li", { hasText: label }).first().locator(":scope > div").first().locator(".angka").last().innerText());
  const kasAkhir = await nilaiBaris(kas, "Saldo kas akhir November 2026");
  const modalAkhir = await nilaiBaris(modal, "Modal Pemilik akhir November 2026");
  expect(await nilaiBaris(modal, "Setoran kas (Investasi Kas)")).toBe(JUMLAH);
  await expect(kas.getByText("sama dengan buku besar")).toBeVisible();
  await expect(modal.getByText("sama dengan buku besar")).toBeVisible();
  await expect(biaya.getByText("sama dengan kas keluar SDM")).toBeVisible();
  // Biaya tetap + biaya variabel - PPh 21 = kas keluar SDM (gaji + fee) di Arus kas.
  const sdm = (await nilaiBaris(kas, "Gaji inhouse (biaya tetap)")) + (await nilaiBaris(kas, "Fee event (biaya variabel)"));
  expect(await nilaiBaris(biaya, "Kas keluar siklus SDM")).toBe(sdm);
  expect((await nilaiBaris(biaya, "Total biaya SDM")) - (await nilaiBaris(biaya, "PPh 21 dipotong"))).toBe(sdm);

  const saldoBuku = async (akun: string) => {
    await p.goto(`/pelaporan/buku-besar?akun=${akun}&periode=2026-11`);
    return angkaDari(await p.locator("tr", { hasText: "Saldo akhir" }).first().locator("td").last().innerText());
  };
  expect(await saldoBuku("1-110")).toBe(kasAkhir);
  expect(await saldoBuku("3-110")).toBe(modalAkhir);

  await p.goto("/modal/investasi-kas");
  const modalSemua = await nilaiBaris(p.getByRole("region", { name: "Modal Pemilik" }), "Total Modal Pemilik");
  expect(modalSemua).toBe(modalAkhir); // tidak ada jurnal modal sesudah November di database uji
  expect(await nilaiBaris(p.getByRole("region", { name: "Modal Pemilik" }), "Setoran kas (Investasi Kas)")).toBe(30_000_000 + 75_000_000 + JUMLAH);
  // Kumulatif: gaji Oktober data contoh = biaya tetap; total biaya - PPh 21 = kas keluar SDM.
  const biayaSemua = p.getByRole("region", { name: "Biaya SDM" });
  expect(await nilaiBaris(biayaSemua, "Biaya tetap: gaji inhouse")).toBeGreaterThanOrEqual(25_904_546 + 5_595_455);
  await expect(biayaSemua.getByText("sama dengan kas keluar SDM")).toBeVisible();
});

test("potret Investasi Kas Admin dan Owner (1440, 390)", async () => {
  for (const u of ["admin", "owner"]) {
    const p = sesi[u].page;
    await p.goto("/modal/investasi-kas?form=baru");
    if (u === "owner") await p.goto("/modal/investasi-kas");
    await potret(p, `investasi-${u}`);
    // HP: daftar setoran berupa kartu, tabel tersembunyi.
    await p.setViewportSize({ width: 390, height: 844 });
    await expect(p.getByRole("table", { name: "Daftar setoran" })).toBeHidden();
    await expect(p.getByLabel("Daftar setoran (ringkas)")).toBeVisible();
    await p.setViewportSize({ width: 1440, height: 900 });
  }
});

test("potret biaya: Hitung Gaji, slip gaji layar dan cetak, slip fee, ringkasan Biaya SDM", async () => {
  const h = sesi.hrd.page;
  await h.goto("/sdm/hitung-gaji?periode=2026-11");
  await expect(h.getByRole("heading", { name: "Hitung Gaji", level: 1 })).toBeVisible();
  await expect(h.getByText("Biaya tetap").first()).toBeVisible();
  await expect(h.getByText("Komponen tetap, diatur sekali")).toBeVisible();
  await expect(h.getByRole("table", { name: "Kesiapan gaji per karyawan" }).getByRole("row")).toHaveCount(6);
  await potret(h, "biaya-hitung-gaji", { tanpaGeser: false }); // tabel PPh 21 lama tetap menggulir di dalam pembungkusnya

  await h.goto("/sdm/hitung-gaji?periode=2026-10&slip=semua");
  const slip = h.getByRole("article", { name: /^Slip gaji / }).first();
  await expect(slip.getByRole("table", { name: "Komponen tetap (dari Setting Gaji)" })).toBeVisible();
  await expect(slip.getByRole("table", { name: "Penyesuaian bulan ini (dari presensi)" })).toContainText("Total THP");
  await potret(h, "biaya-slip-gaji");
  await h.emulateMedia({ media: "print" });
  await h.setViewportSize({ width: 794, height: 1123 });
  await h.screenshot({ path: `${POTRET}/biaya-slip-gaji-cetak.png`, fullPage: true });
  await expect(h.getByRole("navigation", { name: "Menu utama" })).toBeHidden();
  await h.emulateMedia({ media: "screen" });
  await h.setViewportSize({ width: 1440, height: 900 });

  const o = sesi.owner.page;
  await o.goto("/fee-event/keputusan");
  // Bila spec ini dijalankan sendiri (belum ada laporan fee yang disetujui), Owner menyetujui laporan contoh dulu.
  if (!(await o.getByRole("table", { name: /laporan/i }).getByRole("row", { name: /Disetujui/ }).count())) {
    await o.goto("/fee-event/keputusan?lihat=FEE-2026-0001");
    await o.getByRole("button", { name: "Setujui dan bayar" }).click();
    await o.getByRole("dialog").getByRole("button", { name: "Setujui dan bayar" }).click();
    await tungguToast(o, /FEE-2026-0001 disetujui/);
    await o.goto("/fee-event/keputusan");
  }
  const lihat = o.getByRole("table", { name: /laporan/i }).getByRole("row", { name: /Disetujui/ }).first().getByRole("link", { name: /Lihat|Buka/ });
  const href = await lihat.getAttribute("href");
  await o.goto(`${href}&slip=semua`);
  const sf = o.getByRole("article", { name: /^Slip fee / }).first();
  await expect(sf.getByText("Biaya variabel", { exact: true })).toBeVisible();
  await expect(sf.getByText(/per (jam|hari) x .* = Rp/)).toBeVisible();
  await potret(o, "biaya-slip-fee");

  await o.goto("/modal/investasi-kas?periode=2026-11");
  await potret(o, "biaya-ringkasan", { elemen: o.locator(".kartu", { hasText: "Dari mana kas dan modal" }) });
  expect(galatKonsol, galatKonsol.join("\n")).toEqual([]);
});
